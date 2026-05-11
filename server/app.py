#!/usr/bin/env python3
import base64
import csv
import difflib
import gzip
import hashlib
import hmac
import html as html_lib
import io
import json
import os
import re
import secrets
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from sqlalchemy import case, delete, func, select, text, update
from sqlalchemy.orm import Session

from server.database import SessionLocal, engine
from server.models import (
    Base,
    LeaderboardSnapshot,
    Match,
    MatchMeta,
    MatchPlayerStat,
    OpenAIApiAudit,
    Player,
    Prediction,
    SwapWindow,
    StoreKV,
    User,
    UserHomeReactionAudit,
    UserLoginAudit,
    UserPlayer,
    UserSwap,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    DATABASE_URL = f"sqlite:///{ROOT_DIR / 'server' / 'data' / 'ifl.sqlite3'}"
USING_SQLITE = DATABASE_URL.startswith("sqlite:///")
PORT = int(os.getenv("PORT", "4000"))
CLIENT_DIST = ROOT_DIR / "client" / "dist"
EXPORT_DIR = ROOT_DIR / "server" / "data" / "exports" / "leaderboard"
IST = timezone(timedelta(hours=5, minutes=30))

VALID_KEYS = {"ifl_users", "ifl_master_players", "ifl_master_matches", "ifl_match_stats", "ifl_swap_windows", "ifl_playoffs_predictions", "ifl_allowed_phones", "ifl_global_team_code"}
ADMIN_ONLY_KEYS = {"ifl_users", "ifl_master_players", "ifl_master_matches", "ifl_match_stats", "ifl_swap_windows", "ifl_allowed_phones", "ifl_global_team_code"}
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "ifl@2026")
ADMIN_TOKEN_SECRET = os.getenv("ADMIN_TOKEN_SECRET", "")
ADMIN_TOKEN_TTL_SEC = int(os.getenv("ADMIN_TOKEN_TTL_SEC", "900"))
USER_TOKEN_TTL_SEC = int(os.getenv("USER_TOKEN_TTL_SEC", "900"))
ADMIN_MAX_ATTEMPTS = int(os.getenv("ADMIN_MAX_ATTEMPTS", "5"))
ADMIN_ATTEMPT_WINDOW_SEC = int(os.getenv("ADMIN_ATTEMPT_WINDOW_SEC", "900"))
PREDICTION_LOCK_MINUTES = 30
PREDICTION_POINTS = 50
POINT_RULES = {
    "RUN": 1,
    "CATCH": 5,
    "RUNOUT_STUMPING": 10,
    "WICKET": 20,
    "BONUS_3_WICKETS": 25,
    "BONUS_4_WICKETS": 50,
    "BONUS_5_WICKETS": 100,
    "BONUS_50_RUNS": 25,
    "BONUS_75_RUNS": 50,
    "BONUS_100_RUNS": 100,
    "MAN_OF_MATCH": 50,
    "MATCH_WINNER_PICK": 50,
}
AZURE_OPENAI_ENDPOINT = ""
AZURE_OPENAI_API_KEY = ""
AZURE_OPENAI_DEPLOYMENT = ""
AZURE_OPENAI_API_VERSION = ""
TRUSTED_CRICKET_DOMAINS = (
    "sports.ndtv.com",
    "iplt20.com",
    "www.iplt20.com",
    "cricbuzz.com",
    "www.cricbuzz.com",
    "espncricinfo.com",
    "www.espncricinfo.com",
)
SEARCH_USER_AGENT = "Mozilla/5.0 (compatible; IFLApp/1.0; +https://ifl.local)"
CRICBUZZ_RAPIDAPI_KEY = ""
CRICBUZZ_RAPIDAPI_HOST = ""
CRICBUZZ_MATCH_MAP_PATH = ROOT_DIR / "server" / "data" / "cricbuzz_match_ids_2026.json"

_ADMIN_LOGIN_ATTEMPTS: dict[str, list[int]] = {}


class StaleWriteError(Exception):
    def __init__(self, current_version: str):
        super().__init__("Stale write detected")
        self.current_version = current_version


class LockedPredictionEditError(Exception):
    def __init__(self, details: str):
        super().__init__(details)
        self.details = details


def _effective_token_secret() -> str:
    if ADMIN_TOKEN_SECRET.strip():
        return ADMIN_TOKEN_SECRET
    return f"{ADMIN_USERNAME}:{ADMIN_PASSWORD}:ifl-local-secret"


def _sign_admin_token(payload: dict[str, Any]) -> str:
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    body_b64 = base64.urlsafe_b64encode(body).rstrip(b"=").decode("ascii")
    sig = hmac.new(
        _effective_token_secret().encode("utf-8"),
        body_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode("ascii")
    return f"{body_b64}.{sig_b64}"


def _effective_user_token_secret() -> str:
    return f"{_effective_token_secret()}:user"


def _sign_user_token(payload: dict[str, Any]) -> str:
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    body_b64 = base64.urlsafe_b64encode(body).rstrip(b"=").decode("ascii")
    sig = hmac.new(
        _effective_user_token_secret().encode("utf-8"),
        body_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode("ascii")
    return f"{body_b64}.{sig_b64}"


def _b64decode_padded(value: str) -> bytes:
    pad = "=" * ((4 - (len(value) % 4)) % 4)
    return base64.urlsafe_b64decode((value + pad).encode("ascii"))


def _verify_admin_token(token: str):
    try:
        body_b64, sig_b64 = token.split(".", 1)
    except ValueError:
        return None

    expected_sig = hmac.new(
        _effective_token_secret().encode("utf-8"),
        body_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    try:
        given_sig = _b64decode_padded(sig_b64)
    except Exception:
        return None

    if not hmac.compare_digest(expected_sig, given_sig):
        return None

    try:
        payload = json.loads(_b64decode_padded(body_b64).decode("utf-8"))
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None
    if payload.get("u") != ADMIN_USERNAME:
        return None
    exp = int(payload.get("exp", 0) or 0)
    if exp < int(time.time()):
        return None
    return payload


def _verify_user_token(token: str):
    try:
        body_b64, sig_b64 = token.split(".", 1)
    except ValueError:
        return None

    expected_sig = hmac.new(
        _effective_user_token_secret().encode("utf-8"),
        body_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    try:
        given_sig = _b64decode_padded(sig_b64)
    except Exception:
        return None

    if not hmac.compare_digest(expected_sig, given_sig):
        return None

    try:
        payload = json.loads(_b64decode_padded(body_b64).decode("utf-8"))
    except Exception:
        return None

    if not isinstance(payload, dict):
        return None
    username = str(payload.get("u") or "").strip()
    if not username:
        return None
    exp = int(payload.get("exp", 0) or 0)
    if exp < int(time.time()):
        return None
    return payload


def _hash_user_password(password: str) -> str:
    salt = secrets.token_hex(16)
    iterations = 260000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations)
    return f"pbkdf2_sha256${iterations}${salt}${base64.urlsafe_b64encode(digest).decode('ascii')}"


def _verify_user_password(stored_password: str, candidate: str) -> tuple[bool, bool]:
    value = str(stored_password or "")
    if value.startswith("pbkdf2_sha256$"):
        try:
            _, iter_txt, salt, expected = value.split("$", 3)
            digest = hashlib.pbkdf2_hmac("sha256", candidate.encode("utf-8"), salt.encode("utf-8"), int(iter_txt))
            actual = base64.urlsafe_b64encode(digest).decode("ascii")
            return hmac.compare_digest(actual, expected), False
        except Exception:
            return False, False
    return hmac.compare_digest(value, candidate), True


def _check_admin_login_rate_limit(key: str):
    now = int(time.time())
    cutoff = now - ADMIN_ATTEMPT_WINDOW_SEC
    existing = [t for t in _ADMIN_LOGIN_ATTEMPTS.get(key, []) if t >= cutoff]
    _ADMIN_LOGIN_ATTEMPTS[key] = existing
    if len(existing) >= ADMIN_MAX_ATTEMPTS:
        retry_after = max(1, ADMIN_ATTEMPT_WINDOW_SEC - (now - existing[0]))
        return False, retry_after
    return True, 0


def _record_admin_login_failure(key: str):
    _ADMIN_LOGIN_ATTEMPTS.setdefault(key, []).append(int(time.time()))


def _extract_bearer_token(authorization: str | None) -> str:
    header = str(authorization or "").strip()
    if not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = header[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token required")
    return token


def _log_openai_api_audit(
    *,
    provider: str,
    deployment: str,
    api_type: str,
    use_case: str,
    actor_username: str = "",
    request_chars: int = 0,
    response_chars: int = 0,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    total_tokens: int | None = None,
    duration_ms: int | None = None,
    status: str,
    error_message: str = "",
):
    try:
        with SessionLocal() as db:
            db.add(
                OpenAIApiAudit(
                    provider=provider,
                    deployment=deployment or None,
                    api_type=api_type or None,
                    use_case=use_case or None,
                    actor_username=actor_username or None,
                    request_chars=request_chars or None,
                    response_chars=response_chars or None,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    duration_ms=duration_ms,
                    status=status,
                    error_message=(error_message or "")[:2000] or None,
                )
            )
            db.commit()
    except Exception:
        pass


def _require_user(authorization: str | None) -> str:
    token = _extract_bearer_token(authorization)
    payload = _verify_user_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired user token")
    return str(payload.get("u") or "").strip()


def init_db():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        _ensure_identity_columns(db)
        _ensure_user_players_submitted_at(db)
        _ensure_user_players_frozen_at(db)
        _ensure_user_players_is_deleted(db)
        _ensure_user_swaps_columns(db)
        _ensure_swap_windows_columns(db)
        _migrate_match_stats_from_store_kv(db)
        db.commit()


def _ensure_user_swaps_columns(db: Session):
    if not USING_SQLITE:
        cols = {
            r[0]
            for r in db.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'user_swaps'
                    """
                )
            ).all()
        }
        if "is_validated" not in cols:
            db.execute(text('ALTER TABLE "user_swaps" ADD COLUMN is_validated INTEGER NOT NULL DEFAULT 0'))
            db.execute(text('UPDATE "user_swaps" SET is_validated = 0 WHERE is_validated IS NULL'))
        if "validated_at" not in cols:
            db.execute(text('ALTER TABLE "user_swaps" ADD COLUMN validated_at TIMESTAMP'))
        if "validated_by" not in cols:
            db.execute(text('ALTER TABLE "user_swaps" ADD COLUMN validated_by TEXT'))
        if "is_frozen" not in cols:
            db.execute(text('ALTER TABLE "user_swaps" ADD COLUMN is_frozen INTEGER NOT NULL DEFAULT 0'))
            db.execute(text('UPDATE "user_swaps" SET is_frozen = 0 WHERE is_frozen IS NULL'))
        if "frozen_at" not in cols:
            db.execute(text('ALTER TABLE "user_swaps" ADD COLUMN frozen_at TIMESTAMP'))
        return

    cols = [r[1] for r in db.execute(text("PRAGMA table_info(user_swaps)")).all()]
    if "is_validated" not in cols:
        db.execute(text('ALTER TABLE "user_swaps" ADD COLUMN is_validated INTEGER NOT NULL DEFAULT 0'))
        db.execute(text('UPDATE "user_swaps" SET is_validated = 0 WHERE is_validated IS NULL'))
    if "validated_at" not in cols:
        db.execute(text('ALTER TABLE "user_swaps" ADD COLUMN validated_at TEXT'))
    if "validated_by" not in cols:
        db.execute(text('ALTER TABLE "user_swaps" ADD COLUMN validated_by TEXT'))
    if "is_frozen" not in cols:
        db.execute(text('ALTER TABLE "user_swaps" ADD COLUMN is_frozen INTEGER NOT NULL DEFAULT 0'))
        db.execute(text('UPDATE "user_swaps" SET is_frozen = 0 WHERE is_frozen IS NULL'))
    if "frozen_at" not in cols:
        db.execute(text('ALTER TABLE "user_swaps" ADD COLUMN frozen_at TEXT'))


def _ensure_swap_windows_columns(db: Session):
    if not USING_SQLITE:
        cols = {
            r[0]
            for r in db.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'swap_windows'
                    """
                )
            ).all()
        }
        if "effective_match_id" not in cols:
            db.execute(text('ALTER TABLE "swap_windows" ADD COLUMN effective_match_id INTEGER NOT NULL DEFAULT 0'))
            db.execute(text('UPDATE "swap_windows" SET effective_match_id = 0 WHERE effective_match_id IS NULL'))
        return

    cols = [r[1] for r in db.execute(text("PRAGMA table_info(swap_windows)")).all()]
    if "effective_match_id" not in cols:
        db.execute(text('ALTER TABLE "swap_windows" ADD COLUMN effective_match_id INTEGER NOT NULL DEFAULT 0'))


def _ensure_identity_columns(db: Session):
    if USING_SQLITE:
        return

    def _ensure_autoincrement(table: str, col: str):
        row = db.execute(
            text(
                """
                SELECT column_default, is_identity
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = :table AND column_name = :col
                """
            ),
            {"table": table, "col": col},
        ).first()
        if row is None:
            return

        default_expr = (row[0] or "").strip()
        is_identity = str(row[1] or "").upper() == "YES"
        seq_name = db.execute(text("SELECT pg_get_serial_sequence(:tbl, :col)"), {"tbl": f"public.{table}", "col": col}).scalar()

        if seq_name is None and not is_identity:
            seq_name = f"public.{table}_{col}_seq"
            db.execute(text(f'CREATE SEQUENCE IF NOT EXISTS "{table}_{col}_seq"'))
            db.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" SET DEFAULT nextval(\'{seq_name}\')'))
            db.execute(text(f'ALTER SEQUENCE "{table}_{col}_seq" OWNED BY "{table}"."{col}"'))
        elif not is_identity and "nextval(" not in default_expr and seq_name:
            db.execute(text(f'ALTER TABLE "{table}" ALTER COLUMN "{col}" SET DEFAULT nextval(\'{seq_name}\')'))

        # Ensure next generated id is always above current max(id).
        if seq_name:
            db.execute(text(f"SELECT setval('{seq_name}', COALESCE((SELECT MAX(\"{col}\") FROM \"{table}\"), 0) + 1, false)"))

    _ensure_autoincrement("users", "id")
    _ensure_autoincrement("activity_feed", "id")
    _ensure_autoincrement("swap_windows", "id")
    _ensure_autoincrement("user_swaps", "id")


def _ensure_user_players_submitted_at(db: Session):
    if not USING_SQLITE:
        row = db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'user_players'
                  AND column_name = 'submitted_at'
                """
            )
        ).first()
        if row is None:
            db.execute(text('ALTER TABLE "user_players" ADD COLUMN submitted_at TIMESTAMP'))
        return
    cols = [r[1] for r in db.execute(text("PRAGMA table_info(user_players)")).all()]
    if "submitted_at" not in cols:
        db.execute(text('ALTER TABLE "user_players" ADD COLUMN submitted_at TEXT'))


def _ensure_user_players_is_deleted(db: Session):
    if not USING_SQLITE:
        row = db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'user_players'
                  AND column_name = 'is_deleted'
                """
            )
        ).first()
        if row is None:
            db.execute(text('ALTER TABLE "user_players" ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0'))
            db.execute(text('UPDATE "user_players" SET is_deleted = 0 WHERE is_deleted IS NULL'))
        return
    cols = [r[1] for r in db.execute(text("PRAGMA table_info(user_players)")).all()]
    if "is_deleted" not in cols:
        db.execute(text('ALTER TABLE "user_players" ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0'))
        db.execute(text('UPDATE "user_players" SET is_deleted = 0 WHERE is_deleted IS NULL'))


def _ensure_user_players_frozen_at(db: Session):
    if not USING_SQLITE:
        row = db.execute(
            text(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'user_players'
                  AND column_name = 'frozen_at'
                """
            )
        ).first()
        if row is None:
            db.execute(text('ALTER TABLE "user_players" ADD COLUMN frozen_at TIMESTAMP'))
        return
    cols = [r[1] for r in db.execute(text("PRAGMA table_info(user_players)")).all()]
    if "frozen_at" not in cols:
        db.execute(text('ALTER TABLE "user_players" ADD COLUMN frozen_at TEXT'))


def _iso_stamp(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _store_match_ts(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    s = str(value).strip()
    if not s:
        return ""
    parsed = _parse_store_datetime(s)
    return parsed.strftime("%Y-%m-%d %H:%M") if parsed else s


def _parse_store_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).strip()
    if not s:
        return None
    for fmt in (
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
    ):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def _now_ist() -> datetime:
    return datetime.now(IST)


def _league_ts(value: datetime | None = None) -> str:
    dt = value or _now_ist()
    if dt.tzinfo is not None:
        dt = dt.astimezone(IST).replace(tzinfo=None)
    return dt.strftime("%Y-%m-%d %H:%M")


def _prediction_lock_ts(match_date: Any) -> str:
    dt = _parse_store_datetime(match_date)
    if dt is None:
        return ""
    return _league_ts(dt - timedelta(minutes=PREDICTION_LOCK_MINUTES))


def _prediction_locked(match_date: Any, now_ts: str | None = None) -> bool:
    lock_ts = _prediction_lock_ts(match_date)
    if not lock_ts:
        return True
    return (now_ts or _league_ts()) >= lock_ts


def _normalize_team_pick(value: Any) -> str:
    raw = str(value or "").strip().upper()
    if not raw:
        return ""
    collapsed = re.sub(r"[^A-Z0-9]+", "", raw)
    aliases = {
        "KXIP": "PBKS",
        "PUNJABKINGS": "PBKS",
        "ROYALCHALLENGERSBANGALORE": "RCB",
        "ROYALCHALLENGERSBENGALURU": "RCB",
        "DELHICAPITALS": "DC",
        "MUMBAIINDIANS": "MI",
        "CHENNAISUPERKINGS": "CSK",
        "KOLKATAKNIGHTRIDERS": "KKR",
        "SUNRISERSHYDERABAD": "SRH",
        "RAJASTHANROYALS": "RR",
        "GUJARATTITANS": "GT",
        "LUCKNOWSUPERGIANTS": "LSG",
    }
    return aliases.get(collapsed, aliases.get(raw, raw))


def _refresh_prediction_results(db: Session, match_id: int, winner_val: str | None) -> None:
    winner = _normalize_team_pick(winner_val or "")
    now = datetime.utcnow()
    if not winner or winner == "NR":
        db.execute(
            update(Prediction)
            .where(Prediction.match_id == int(match_id))
            .values(is_correct=None, points_awarded=0, updated_at=now)
        )
        return
    for row in db.scalars(select(Prediction).where(Prediction.match_id == int(match_id))).all():
        normalized_pick = _normalize_team_pick(row.pick or "")
        is_correct = normalized_pick == winner
        row.is_correct = 1 if is_correct else 0
        row.points_awarded = PREDICTION_POINTS if is_correct else 0
        row.updated_at = now


def _score_player_performance(stat: MatchPlayerStat | dict[str, Any] | None) -> int:
    if stat is None:
        return 0
    if isinstance(stat, dict):
        runs = _to_non_negative_int(stat.get("runs"), 0)
        catches = _to_non_negative_int(stat.get("catches"), 0)
        runouts = _to_non_negative_int(stat.get("runouts"), 0)
        wickets = _to_non_negative_int(stat.get("wickets"), 0)
    else:
        runs = _to_non_negative_int(getattr(stat, "runs", 0), 0)
        catches = _to_non_negative_int(getattr(stat, "catches", 0), 0)
        runouts = _to_non_negative_int(getattr(stat, "runouts", 0), 0)
        wickets = _to_non_negative_int(getattr(stat, "wickets", 0), 0)

    bonus_runs = 0
    if runs >= 100:
        bonus_runs = POINT_RULES["BONUS_100_RUNS"]
    elif runs >= 75:
        bonus_runs = POINT_RULES["BONUS_75_RUNS"]
    elif runs >= 50:
        bonus_runs = POINT_RULES["BONUS_50_RUNS"]

    bonus_wickets = 0
    if wickets >= 5:
        bonus_wickets = POINT_RULES["BONUS_5_WICKETS"]
    elif wickets >= 4:
        bonus_wickets = POINT_RULES["BONUS_4_WICKETS"]
    elif wickets >= 3:
        bonus_wickets = POINT_RULES["BONUS_3_WICKETS"]

    return (
        runs * POINT_RULES["RUN"]
        + catches * POINT_RULES["CATCH"]
        + runouts * POINT_RULES["RUNOUT_STUMPING"]
        + wickets * POINT_RULES["WICKET"]
        + bonus_runs
        + bonus_wickets
    )


def _recompute_all_user_points(db: Session) -> dict[str, Any]:
    users = db.scalars(select(User).order_by(User.id)).all()
    matches = db.scalars(select(Match).order_by(Match.match_date, Match.id)).all()
    predictions = db.scalars(select(Prediction).order_by(Prediction.user_id, Prediction.match_id)).all()
    stats = db.scalars(select(MatchPlayerStat).order_by(MatchPlayerStat.match_id, MatchPlayerStat.player_id)).all()
    metas = db.scalars(select(MatchMeta).order_by(MatchMeta.match_id)).all()
    swap_windows = {
        int(w.id): _to_non_negative_int(w.effective_match_id, 0)
        for w in db.scalars(select(SwapWindow)).all()
    }

    user_base_players: dict[int, set[int]] = {}
    user_submitted_at: dict[int, dict[int, datetime | None]] = {}
    for row in db.scalars(select(UserPlayer).where(UserPlayer.is_deleted == 0)).all():
        uid = int(row.user_id)
        user_base_players.setdefault(uid, set()).add(int(row.player_id))
        user_submitted_at.setdefault(uid, {})[int(row.player_id)] = _parse_store_datetime(row.submitted_at)

    user_swap_rows: dict[int, list[dict[str, Any]]] = {}
    for row in db.scalars(
        select(UserSwap)
        .where(UserSwap.is_deleted == 0, UserSwap.is_frozen == 1, UserSwap.is_validated == 1)
        .order_by(UserSwap.user_id, UserSwap.window_id, UserSwap.id)
    ).all():
        uid = int(row.user_id)
        eff = _to_non_negative_int(swap_windows.get(int(row.window_id)), 0)
        if eff <= 0:
            continue
        rows = user_swap_rows.setdefault(uid, [])
        current = rows[-1] if rows and int(rows[-1]["window_id"]) == int(row.window_id) else None
        if current is None:
            current = {"window_id": int(row.window_id), "eff": eff, "out": [], "in": []}
            rows.append(current)
        current["out"].append(int(row.out_player_id))
        current["in"].append(int(row.in_player_id))
    for rows in user_swap_rows.values():
        rows.sort(key=lambda item: (int(item["eff"]), int(item["window_id"])))

    predictions_by_user_match: dict[tuple[int, int], Prediction] = {
        (int(row.user_id), int(row.match_id)): row for row in predictions
    }
    stats_by_match: dict[int, dict[int, MatchPlayerStat]] = {}
    for row in stats:
        stats_by_match.setdefault(int(row.match_id), {})[int(row.player_id)] = row
    motm_by_match = {
        int(row.match_id): _to_non_negative_int(row.motm_player_id, 0)
        for row in metas
        if _to_non_negative_int(row.motm_player_id, 0) > 0
    }

    updated = 0
    now = datetime.utcnow()
    details: list[dict[str, Any]] = []
    for user in users:
        uid = int(user.id)
        base_ids = set(user_base_players.get(uid, set()))
        submitted_map = user_submitted_at.get(uid, {})
        swap_rows = user_swap_rows.get(uid, [])
        total_points = 0

        for match in matches:
            match_id = int(match.id)
            match_dt = _parse_store_datetime(match.match_date)
            effective_squad = set(base_ids)
            for row in swap_rows:
                if match_id >= int(row["eff"]):
                    for pid in row["out"]:
                        effective_squad.discard(int(pid))
                    for pid in row["in"]:
                        effective_squad.add(int(pid))

            match_points = 0
            for pid, stat in (stats_by_match.get(match_id) or {}).items():
                if int(pid) not in effective_squad:
                    continue
                submitted_at = submitted_map.get(int(pid))
                if submitted_at is not None and match_dt is not None and match_dt < submitted_at:
                    continue
                match_points += _score_player_performance(stat)

            motm_pid = _to_non_negative_int(motm_by_match.get(match_id), 0)
            if motm_pid > 0 and motm_pid in effective_squad:
                submitted_at = submitted_map.get(motm_pid)
                if not (submitted_at is not None and match_dt is not None and match_dt < submitted_at):
                    match_points += POINT_RULES["MAN_OF_MATCH"]

            pred = predictions_by_user_match.get((uid, match_id))
            if pred is not None:
                match_points += _to_non_negative_int(pred.points_awarded, 0)

            total_points += match_points

        if int(user.points or 0) != int(total_points):
            user.points = int(total_points)
            user.updated_at = now
            updated += 1
        details.append({"username": str(user.username), "team_name": str(user.team_name or user.username), "points": int(total_points)})

    db.commit()
    return {"ok": True, "updated": updated, "users": details}


def _parse_export_date(date_str: str | None) -> str:
    if not date_str:
        return _now_ist().strftime("%Y-%m-%d")
    try:
        return datetime.strptime(str(date_str), "%Y-%m-%d").strftime("%Y-%m-%d")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid date: {date_str}") from exc


def _leaderboard_rows(db: Session) -> list[dict[str, Any]]:
    users = []
    for row in db.scalars(select(User).order_by(User.points.desc(), User.updated_at.asc(), User.username.asc())).all():
        predictions_count = int(db.scalar(select(func.count()).select_from(Prediction).where(Prediction.user_id == row.id)) or 0)
        active_players = int(
            db.scalar(
                select(func.count()).select_from(UserPlayer).where(UserPlayer.user_id == row.id, UserPlayer.is_deleted == 0)
            )
            or 0
        )
        users.append(
            {
                "username": str(row.username),
                "team_name": str(row.team_name or row.username),
                "points": int(row.points or 0),
                "predictions_count": predictions_count,
                "active_players": active_players,
                "squad_submitted": bool(row.squad_submitted),
                "squad_validated": bool(row.squad_validated),
                "squad_frozen": bool(row.squad_frozen),
                "updated_at": _iso_stamp(row.updated_at),
            }
        )
    for idx, row in enumerate(users, start=1):
        row["rank"] = idx
    return users


def _write_leaderboard_export(export_date: str | None = None) -> dict[str, str]:
    stamp = _parse_export_date(export_date)
    generated_at = _now_ist().strftime("%Y-%m-%d %H:%M:%S %Z")
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = EXPORT_DIR / f"leaderboard-{stamp}.csv"
    json_path = EXPORT_DIR / f"leaderboard-{stamp}.json"

    with SessionLocal() as db:
        rows = _leaderboard_rows(db)
        _upsert_leaderboard_snapshot(db, stamp, rows)
        prev_ranks = _prev_rank_map(db, stamp)

    for row in rows:
        prev_rank = prev_ranks.get(row["username"])
        if prev_rank is None:
            row["rank_change"] = 0
            row["rank_direction"] = "new"
        else:
            delta = prev_rank - row["rank"]
            row["rank_change"] = int(delta)
            row["rank_direction"] = "up" if delta > 0 else "down" if delta < 0 else "same"

    csv_buffer = io.StringIO()
    writer = csv.DictWriter(
        csv_buffer,
        fieldnames=[
            "rank",
            "team_name",
            "username",
            "points",
            "predictions_count",
            "active_players",
            "squad_submitted",
            "squad_validated",
            "squad_frozen",
            "rank_change",
            "rank_direction",
            "updated_at",
            "generated_at",
        ],
    )
    writer.writeheader()
    for row in rows:
        writer.writerow({**row, "generated_at": generated_at})
    csv_path.write_text(csv_buffer.getvalue(), encoding="utf-8")

    json_path.write_text(
        json.dumps({"date": stamp, "generated_at": generated_at, "rows": rows}, indent=2),
        encoding="utf-8",
    )
    return {"csv": str(csv_path), "json": str(json_path), "date": stamp}


def _upsert_leaderboard_snapshot(db: Session, stamp: str, rows: list[dict[str, Any]]):
    now = datetime.utcnow()
    payload = json.dumps(rows, separators=(",", ":"), ensure_ascii=True)
    existing = db.get(LeaderboardSnapshot, stamp)
    if existing is None:
        db.add(LeaderboardSnapshot(date=stamp, rows_json=payload, created_at=now, updated_at=now))
    else:
        existing.rows_json = payload
        existing.updated_at = now
    db.commit()


def _prev_rank_map(db: Session, stamp: str) -> dict[str, int]:
    try:
        prev_date = (datetime.strptime(stamp, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    except Exception:
        return {}
    prev = db.get(LeaderboardSnapshot, prev_date)
    if prev is None:
        return {}
    try:
        rows = json.loads(prev.rows_json or "[]")
    except Exception:
        return {}
    ranks = {}
    if isinstance(rows, list):
        for r in rows:
            if isinstance(r, dict) and "username" in r and "rank" in r:
                try:
                    ranks[str(r["username"])] = int(r["rank"])
                except Exception:
                    continue
    return ranks


def _compute_store_key_version(db: Session, key: str) -> str:
    if key == "ifl_users":
        payload = {
            "users_count": int(db.scalar(select(func.count()).select_from(User)) or 0),
            "users_updated": _iso_stamp(db.scalar(select(func.max(User.updated_at)))),
            "user_players_count": int(db.scalar(select(func.count()).select_from(UserPlayer).where(UserPlayer.is_deleted == 0)) or 0),
            "user_players_created": _iso_stamp(db.scalar(select(func.max(UserPlayer.created_at)).where(UserPlayer.is_deleted == 0))),
            "predictions_count": int(db.scalar(select(func.count()).select_from(Prediction)) or 0),
            "predictions_updated": _iso_stamp(db.scalar(select(func.max(Prediction.updated_at)))),
        }
    elif key == "ifl_master_players":
        payload = {
            "players_count": int(db.scalar(select(func.count()).select_from(Player)) or 0),
            "players_updated": _iso_stamp(db.scalar(select(func.max(Player.updated_at)))),
        }
    elif key == "ifl_master_matches":
        payload = {
            "matches_count": int(db.scalar(select(func.count()).select_from(Match)) or 0),
            "matches_updated": _iso_stamp(db.scalar(select(func.max(Match.updated_at)))),
        }
    elif key == "ifl_match_stats":
        payload = {
            "stats_count": int(db.scalar(select(func.count()).select_from(MatchPlayerStat)) or 0),
            "stats_updated": _iso_stamp(db.scalar(select(func.max(MatchPlayerStat.updated_at)))),
            "meta_count": int(db.scalar(select(func.count()).select_from(MatchMeta)) or 0),
            "meta_updated": _iso_stamp(db.scalar(select(func.max(MatchMeta.updated_at)))),
        }
    elif key == "ifl_swap_windows":
        payload = {
            "windows_count": int(db.scalar(select(func.count()).select_from(SwapWindow)) or 0),
            "windows_updated": _iso_stamp(db.scalar(select(func.max(SwapWindow.created_at)))),
        }
    elif key in {"ifl_allowed_phones", "ifl_global_team_code", "ifl_playoffs_predictions"}:
        row = db.get(StoreKV, key)
        value_json = row.value_json if row is not None else ""
        payload = {
            "updated": _iso_stamp(row.updated_at if row is not None else ""),
            "value_hash": hashlib.sha256(value_json.encode("utf-8")).hexdigest()[:16],
        }
    else:
        payload = {"key": key}

    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:24]


def _read_store_versions(db: Session) -> dict[str, str]:
    return {k: _compute_store_key_version(db, k) for k in sorted(VALID_KEYS)}


def _bool_from_db(value):
    if value is None:
        return None
    return bool(value)


def _to_non_negative_int(value, default=0):
    try:
        return max(0, int(value))
    except Exception:
        return default


def _fetch_existing_users_snapshot(db: Session):
    users = {}
    users_by_id = {}
    for r in db.scalars(select(User).order_by(User.username)).all():
        uname = str(r.username)
        users[uname] = {
            "id": int(r.id),
            "teamName": r.team_name or uname,
            "points": int(r.points or 0),
            "predictions": {},
        }
        users_by_id[int(r.id)] = uname

    for r in db.scalars(select(Prediction).order_by(Prediction.user_id, Prediction.match_id)).all():
        uname = users_by_id.get(int(r.user_id))
        if not uname:
            continue
        users[uname]["predictions"][str(r.match_id)] = {
            "pick": str(r.pick or ""),
            "correct": _bool_from_db(r.is_correct),
            "pts": int(r.points_awarded or 0),
        }

    return users


def _resolve_user_swap_rows(user: dict[str, Any], swap_windows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    swap_map = user.get("swapWindows")
    if isinstance(swap_map, dict):
        for wid, val in swap_map.items():
            window = next((sw for sw in swap_windows if str(sw.get("id")) == str(wid)), None)
            eff = _to_non_negative_int((window or {}).get("effective_match_id"), 0)
            out_ids = [int(x) for x in (val.get("out") or []) if _to_non_negative_int(x, 0) > 0] if isinstance(val, dict) else []
            in_ids = [int(x) for x in (val.get("in") or []) if _to_non_negative_int(x, 0) > 0] if isinstance(val, dict) else []
            if eff > 0 and out_ids and in_ids:
                rows.append({"windowId": _to_non_negative_int(wid, 0), "eff": eff, "out": out_ids, "in": in_ids})
    return sorted(rows, key=lambda row: int(row.get("eff") or 0))


def _effective_squad_ids_for_match(base_ids: list[int], swap_rows: list[dict[str, Any]], match_id: int) -> list[int]:
    squad = set(int(x) for x in base_ids if _to_non_negative_int(x, 0) > 0)
    for row in swap_rows:
        if int(match_id) >= int(row.get("eff") or 0):
            for pid in row.get("out") or []:
                squad.discard(int(pid))
            for pid in row.get("in") or []:
                squad.add(int(pid))
    return sorted(squad)


def _player_country_bucket(player: dict[str, Any] | None) -> str:
    country = str((player or {}).get("country") or "").strip().lower()
    return "IND" if country == "india" else "INTL"


def _question_needs_trusted_web(question: str) -> bool:
    q = str(question or "").strip().lower()
    if not q:
        return False
    internal_terms = (
        "active players",
        "differential",
        "move up",
        "prediction split",
        "rate my team",
        "my team",
        "my squad",
        "my rank",
        "affect my team",
        "affect me",
    )
    if any(term in q for term in internal_terms):
        return False
    web_terms = (
        "news",
        "latest",
        "scorecard",
        "score",
        "what happened",
        "happened",
        "injury",
        "headline",
        "summarize the latest",
        "current stats",
        "live",
        "recent form",
        "in-form",
        "watch right now",
        "injured",
        "injury",
        "might not play",
        "may not play",
        "unavailable",
        "availability",
        "ruled out",
        "fitness",
        "doubtful",
    )
    return any(term in q for term in web_terms)


def _question_is_winner_chance(question: str) -> bool:
    q = str(question or "").strip().lower()
    if not q:
        return False
    chance_terms = (
        "who has better chance of winning",
        "who has a better chance of winning",
        "better chance of winning",
        "more likely to win",
        "likely to win",
        "who will win",
        "which team will win",
        "winning chance",
        "chance of winning",
    )
    return any(term in q for term in chance_terms)


def _build_ifl_guru_context(username: str) -> dict[str, Any]:
    store = read_store()
    users = store.get("ifl_users", {})
    matches = store.get("ifl_master_matches", [])
    players = store.get("ifl_master_players", [])
    match_stats = store.get("ifl_match_stats", {})
    swap_windows = store.get("ifl_swap_windows", [])
    user = users.get(username) if isinstance(users, dict) else None
    if not isinstance(user, dict):
        raise HTTPException(status_code=404, detail="user not found")

    player_by_id = {int(p.get("id")): p for p in players if isinstance(p, dict) and _to_non_negative_int(p.get("id"), 0) > 0}
    leaderboard = sorted(
        [
            {
                "username": str(un),
                "teamName": str((u or {}).get("teamName") or un),
                "points": int((u or {}).get("points") or 0),
            }
            for un, u in users.items()
            if isinstance(u, dict)
        ],
        key=lambda row: (-int(row["points"]), row["teamName"]),
    )
    rank = next((idx + 1 for idx, row in enumerate(leaderboard) if row["username"] == username), 0)
    leader = leaderboard[0] if leaderboard else None

    now_ts = _league_ts()
    sorted_matches = sorted(matches, key=lambda m: _store_match_ts((m or {}).get("date")))
    target_match = next(
        (
            m for m in sorted_matches
            if not str((m or {}).get("winner") or "").strip()
            and _prediction_locked((m or {}).get("date"), now_ts)
        ),
        None,
    )
    if target_match is None:
        target_match = next(
            (
                m for m in sorted_matches
                if not str((m or {}).get("winner") or "").strip()
            ),
            None,
        )

    base_ids = [int(x) for x in (user.get("players") or []) if _to_non_negative_int(x, 0) > 0]
    swap_rows = _resolve_user_swap_rows(user, swap_windows if isinstance(swap_windows, list) else [])
    target_match_id = _to_non_negative_int((target_match or {}).get("id"), 0)
    effective_ids = _effective_squad_ids_for_match(base_ids, swap_rows, target_match_id) if target_match_id > 0 else base_ids

    player_totals: dict[int, int] = {}
    for _, ms in (match_stats or {}).items():
        if not isinstance(ms, dict):
            continue
        players_map = ms.get("players") or {}
        if isinstance(players_map, dict):
            for pid, stat in players_map.items():
                npid = _to_non_negative_int(pid, 0)
                if npid <= 0:
                    continue
                player_totals[npid] = player_totals.get(npid, 0) + _score_player_performance(stat if isinstance(stat, dict) else {})
        motm_pid = _to_non_negative_int(ms.get("motmPlayerId"), 0)
        if motm_pid > 0:
            player_totals[motm_pid] = player_totals.get(motm_pid, 0) + POINT_RULES["MAN_OF_MATCH"]

    active_players = []
    ownership: dict[int, int] = {}
    no_players_in_match_squads: list[str] = []
    if target_match_id > 0:
        active_teams = {str(target_match.get("teamAabbr") or "").upper(), str(target_match.get("teamBabbr") or "").upper()}
        for _, other_user in users.items():
            if not isinstance(other_user, dict):
                continue
            other_base = [int(x) for x in (other_user.get("players") or []) if _to_non_negative_int(x, 0) > 0]
            other_swaps = _resolve_user_swap_rows(other_user, swap_windows if isinstance(swap_windows, list) else [])
            other_effective_ids = _effective_squad_ids_for_match(other_base, other_swaps, target_match_id)
            has_match_team_player = False
            for pid in other_effective_ids:
                player = player_by_id.get(int(pid))
                if not player:
                    continue
                if str(player.get("team") or "").upper() in active_teams:
                    has_match_team_player = True
                ownership[int(pid)] = ownership.get(int(pid), 0) + 1
            if not has_match_team_player:
                other_name = str((other_user or {}).get("teamName") or "").strip()
                if other_name:
                    no_players_in_match_squads.append(other_name)
        for pid in effective_ids:
            player = player_by_id.get(int(pid))
            if not player:
                continue
            if str(player.get("team") or "").upper() not in active_teams:
                continue
            active_players.append(
                {
                    "id": int(pid),
                    "name": str(player.get("name") or f"#{pid}"),
                    "team": str(player.get("team") or ""),
                    "role": str(player.get("role") or ""),
                    "country": str(player.get("country") or ""),
                    "ownedBy": int(ownership.get(int(pid), 0)),
                    "totalPoints": int(player_totals.get(int(pid), 0)),
                }
            )
    active_players.sort(key=lambda row: (row["ownedBy"], -row["totalPoints"], row["name"]))

    squad_players = [player_by_id.get(int(pid)) for pid in effective_ids]
    squad_players = [p for p in squad_players if isinstance(p, dict)]
    squad_bowlers = sum(1 for p in squad_players if str(p.get("role") or "").upper() == "BOWL")
    squad_all_rounders = sum(1 for p in squad_players if str(p.get("role") or "").upper() == "ALL")
    squad_intl = sum(1 for p in squad_players if str(p.get("country") or "").strip().lower() != "india")
    active_avg_form = round(sum(int(p.get("totalPoints") or 0) for p in active_players) / len(active_players), 1) if active_players else 0
    differential_active = [p for p in active_players if int(p.get("ownedBy") or 0) > 0 and int(p.get("ownedBy") or 0) <= 3]
    unique_active = [p for p in active_players if int(p.get("ownedBy") or 0) == 1]
    popular_active = [p for p in active_players if int(p.get("ownedBy") or 0) > 3]
    team_rating = {
        "coveragePlayers": len(active_players),
        "differentialPlayers": len(differential_active),
        "uniquePlayers": len(unique_active),
        "activeAverageForm": active_avg_form,
        "squadBowlers": squad_bowlers,
        "squadAllRounders": squad_all_rounders,
        "squadInternational": squad_intl,
    }

    current_window = None
    for w in (swap_windows if isinstance(swap_windows, list) else []):
        if not isinstance(w, dict):
            continue
        start_at = _parse_store_datetime(w.get("start_at"))
        lock_at = _parse_store_datetime(w.get("lock_at"))
        if start_at is not None and lock_at is not None:
            now_dt = _parse_store_datetime(now_ts)
            if now_dt is not None and start_at <= now_dt < lock_at:
                current_window = {
                    "id": _to_non_negative_int(w.get("id"), 0),
                    "name": str(w.get("name") or f"Window {_to_non_negative_int(w.get('id'), 0)}"),
                    "start_at": str(w.get("start_at") or ""),
                    "lock_at": str(w.get("lock_at") or ""),
                    "effective_match_id": _to_non_negative_int(w.get("effective_match_id"), 0),
                }
                break

    squad_players_enriched = []
    for p in squad_players:
        pid = _to_non_negative_int(p.get("id"), 0)
        squad_players_enriched.append(
            {
                "id": pid,
                "name": str(p.get("name") or f"#{pid}"),
                "team": str(p.get("team") or ""),
                "role": str(p.get("role") or ""),
                "country": str(p.get("country") or ""),
                "bucket": _player_country_bucket(p),
                "totalPoints": int(player_totals.get(pid, 0)),
                "ownedBy": int(ownership.get(pid, 0)),
            }
        )
    squad_players_enriched.sort(key=lambda row: (row["totalPoints"], row["ownedBy"], row["name"]))

    pool_players = []
    effective_set = set(effective_ids)
    for p in players:
        if not isinstance(p, dict):
            continue
        pid = _to_non_negative_int(p.get("id"), 0)
        if pid <= 0 or pid in effective_set:
            continue
        pool_players.append(
            {
                "id": pid,
                "name": str(p.get("name") or f"#{pid}"),
                "team": str(p.get("team") or ""),
                "role": str(p.get("role") or ""),
                "country": str(p.get("country") or ""),
                "bucket": _player_country_bucket(p),
                "totalPoints": int(player_totals.get(pid, 0)),
                "ownedBy": int(ownership.get(pid, 0)),
            }
        )

    def _valid_swap_in(out_player: dict[str, Any], in_player: dict[str, Any]) -> bool:
        next_bowlers = squad_bowlers
        if str(out_player.get("role") or "").upper() == "BOWL":
            next_bowlers -= 1
        if str(in_player.get("role") or "").upper() == "BOWL":
            next_bowlers += 1
        next_intl = squad_intl
        if str(out_player.get("bucket") or "") == "INTL":
            next_intl -= 1
        if str(in_player.get("bucket") or "") == "INTL":
            next_intl += 1
        return next_bowlers >= 6 and next_intl <= 8

    swap_suggestions = []
    for out_player in squad_players_enriched[:6]:
        candidates = []
        ranked_pool = sorted(
            pool_players,
            key=lambda row: (
                0 if str(row.get("role") or "").upper() == str(out_player.get("role") or "").upper() else 1,
                0 if str(row.get("bucket") or "") == str(out_player.get("bucket") or "") else 1,
                -int(row.get("totalPoints") or 0),
                int(row.get("ownedBy") or 0),
                row.get("name") or "",
            ),
        )
        for in_player in ranked_pool:
            if not _valid_swap_in(out_player, in_player):
                continue
            candidates.append(
                {
                    "id": int(in_player["id"]),
                    "name": str(in_player["name"]),
                    "team": str(in_player["team"]),
                    "role": str(in_player["role"]),
                    "country": str(in_player["country"]),
                    "totalPoints": int(in_player["totalPoints"]),
                    "ownedBy": int(in_player["ownedBy"]),
                }
            )
            if len(candidates) >= 5:
                break
        swap_suggestions.append(
            {
                "swapOut": {
                    "id": int(out_player["id"]),
                    "name": str(out_player["name"]),
                    "team": str(out_player["team"]),
                    "role": str(out_player["role"]),
                    "country": str(out_player["country"]),
                    "totalPoints": int(out_player["totalPoints"]),
                    "ownedBy": int(out_player["ownedBy"]),
                },
                "suggestedIns": candidates,
            }
        )

    rank_climb_context: dict[str, Any] = {}
    if rank > 1 and target_match_id > 0:
        above_row = leaderboard[rank - 2] if rank - 2 >= 0 and rank - 2 < len(leaderboard) else None
        above_user = users.get(str((above_row or {}).get("username") or "")) if isinstance(users, dict) else None
        active_teams = {str((target_match or {}).get("teamAabbr") or "").upper(), str((target_match or {}).get("teamBabbr") or "").upper()}
        above_base = [int(x) for x in ((above_user or {}).get("players") or []) if _to_non_negative_int(x, 0) > 0] if isinstance(above_user, dict) else []
        above_swaps = _resolve_user_swap_rows(above_user, swap_windows if isinstance(swap_windows, list) else []) if isinstance(above_user, dict) else []
        above_effective = _effective_squad_ids_for_match(above_base, above_swaps, target_match_id) if above_base else []
        my_active_ids = {
            int(pid) for pid in effective_ids
            if str((player_by_id.get(int(pid)) or {}).get("team") or "").upper() in active_teams
        }
        above_active_ids = {
            int(pid) for pid in above_effective
            if str((player_by_id.get(int(pid)) or {}).get("team") or "").upper() in active_teams
        }
        my_only = [str((player_by_id.get(pid) or {}).get("name") or "") for pid in sorted(my_active_ids - above_active_ids)]
        above_only = [str((player_by_id.get(pid) or {}).get("name") or "") for pid in sorted(above_active_ids - my_active_ids)]
        my_pred = str((((user.get("predictions") or {}).get(str(target_match_id)) or {}).get("pick")) or "").upper()
        above_pred = (
            str((((above_user or {}).get("predictions") or {}).get(str(target_match_id)) or {}).get("pick") or "").upper()
            if isinstance(above_user, dict)
            else ""
        )
        rank_climb_context = {
            "teamAbove": str((above_row or {}).get("teamName") or ""),
            "gapToAbove": max(0, int((above_row or {}).get("points") or 0) - int(user.get("points") or 0)),
            "yourOnlyActivePlayers": [name for name in my_only if name],
            "aboveOnlyActivePlayers": [name for name in above_only if name],
            "yourPrediction": my_pred,
            "abovePrediction": above_pred,
            "predictionSwing": POINT_RULES["MATCH_WINNER_PICK"] if my_pred and above_pred and my_pred != above_pred else 0,
        }

    recent_results = []
    completed_matches = [m for m in sorted_matches if str((m or {}).get("winner") or "").strip()]
    for m in completed_matches[-5:]:
        mid = str(m.get("id"))
        pred = (user.get("predictions") or {}).get(mid) or {}
        recent_results.append(
            {
                "matchId": _to_non_negative_int(m.get("id"), 0),
                "teams": f"{m.get('teamAabbr', '')} vs {m.get('teamBabbr', '')}".strip(),
                "winner": str(m.get("winner") or ""),
                "yourPick": str(pred.get("pick") or ""),
                "predictionPoints": int(pred.get("pts") or 0),
                "predictionCorrect": pred.get("correct"),
                "scored": bool(match_stats.get(mid)),
            }
        )

    return {
        "username": username,
        "teamName": str(user.get("teamName") or username),
        "points": int(user.get("points") or 0),
        "rank": int(rank or 0),
        "leaderGap": max(0, int((leader or {}).get("points") or 0) - int(user.get("points") or 0)) if leader and leader.get("username") != username else 0,
        "leaderTeam": str((leader or {}).get("teamName") or ""),
        "targetMatch": target_match,
        "activePlayers": active_players,
        "differentialActivePlayers": differential_active,
        "uniqueActivePlayers": unique_active,
        "playersAtPlay": {
            "targetMatch": {
                "id": target_match_id,
                "teams": f"{str((target_match or {}).get('teamAabbr') or '')} vs {str((target_match or {}).get('teamBabbr') or '')}".strip(),
            } if target_match_id > 0 else {},
            "yourMatchdayExposure": active_players,
            "uniquePlayers": unique_active,
            "differentialPlayers": differential_active,
            "popularPlayers": popular_active,
            "totalActivePlayers": len(active_players),
            "uniqueCount": len(unique_active),
            "differentialCount": len(differential_active),
            "popularCount": len(popular_active),
            "totalActiveAccumulatedPoints": sum(int(p.get("totalPoints") or 0) for p in active_players),
            "noPlayersInThisSquad": sorted(no_players_in_match_squads, key=lambda x: x.lower()),
            "noPlayersInThisSquadCount": len(no_players_in_match_squads),
        },
        "teamRating": team_rating,
        "swapAdvice": {
            "currentWindow": current_window,
            "squadShape": {
                "totalPlayers": len(squad_players_enriched),
                "bowlers": squad_bowlers,
                "allRounders": squad_all_rounders,
                "international": squad_intl,
            },
            "weakestSquadPlayers": squad_players_enriched[:6],
            "bestPoolCandidates": sorted(pool_players, key=lambda row: (-int(row["totalPoints"]), int(row["ownedBy"]), row["name"]))[:12],
            "singleSwapSuggestions": swap_suggestions,
        },
        "rankClimbContext": rank_climb_context,
        "recentResults": recent_results,
        "squadSize": len(base_ids),
        "predictionCount": len(user.get("predictions") or {}),
    }


class _DuckDuckGoResultsParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.results: list[dict[str, str]] = []
        self._capture_link = False
        self._capture_snippet = False
        self._current: dict[str, str] | None = None

    def handle_starttag(self, tag, attrs):
        attrs_map = dict(attrs)
        classes = str(attrs_map.get("class") or "")
        if tag == "a" and "result__a" in classes:
            href = str(attrs_map.get("href") or "").strip()
            self._current = {"url": href, "title": "", "snippet": ""}
            self.results.append(self._current)
            self._capture_link = True
        elif self.results and "result__snippet" in classes:
            self._capture_snippet = True

    def handle_endtag(self, tag):
        if tag == "a" and self._capture_link:
            self._capture_link = False
        if self._capture_snippet and tag in {"a", "div", "span"}:
            self._capture_snippet = False

    def handle_data(self, data):
        text = str(data or "").strip()
        if not text:
            return
        if self._capture_link and self._current is not None:
            self._current["title"] = f"{self._current.get('title', '')} {text}".strip()
        elif self._capture_snippet and self.results:
            last = self.results[-1]
            if not last.get("snippet"):
                last["snippet"] = text


def _trusted_cricket_domain(url: str) -> str:
    try:
        host = (urllib.parse.urlparse(str(url)).hostname or "").lower()
    except Exception:
        return ""
    for domain in TRUSTED_CRICKET_DOMAINS:
        if host == domain or host.endswith(f".{domain}"):
            return domain
    return ""


def _decode_ddg_result_url(url: str) -> str:
    raw = str(url or "").strip()
    if not raw:
        return ""
    try:
        parsed = urllib.parse.urlparse(raw)
        if "duckduckgo.com" in (parsed.netloc or ""):
            qs = urllib.parse.parse_qs(parsed.query or "")
            uddg = qs.get("uddg")
            if uddg and uddg[0]:
                return urllib.parse.unquote(uddg[0])
    except Exception:
        return raw
    return raw


def _fetch_url_text(url: str, timeout: int = 12) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": SEARCH_USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def _clean_html_text(raw_html: str) -> str:
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", raw_html)
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = html_lib.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _fetch_source_snippet(url: str) -> dict[str, Any]:
    try:
        raw_html = _fetch_url_text(url, timeout=10)
    except Exception:
        return {"title": "", "snippet": "", "detailed_text": "", "text_length": 0}
    title_match = re.search(r"(?is)<title[^>]*>(.*?)</title>", raw_html)
    title = _clean_html_text(title_match.group(1))[:180] if title_match else ""
    meta_match = re.search(
        r'(?is)<meta[^>]+(?:name|property)=["\'](?:description|og:description)["\'][^>]+content=["\'](.*?)["\']',
        raw_html,
    )
    text = _clean_html_text(raw_html)
    snippet = _clean_html_text(meta_match.group(1))[:420] if meta_match else ""
    if not snippet:
        snippet = text[:420]
    return {
        "title": title,
        "snippet": snippet,
        "detailed_text": text[:3000],
        "text_length": len(text),
    }


def _trusted_source_name(domain: str) -> str:
    host = str(domain or "").lower()
    if "sports.ndtv.com" in host:
        return "NDTV Sports"
    if "iplt20.com" in host:
        return "IPL Official"
    if "cricbuzz.com" in host:
        return "Cricbuzz"
    return "ESPNcricinfo"


def _format_cricbuzz_lookup_date(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    candidates = [raw]
    if "T" not in raw and " " in raw:
        candidates.append(raw.replace(" ", "T", 1))
    for candidate in candidates:
        try:
            dt = datetime.fromisoformat(candidate)
            return dt.strftime("%a, %d %b %Y")
        except Exception:
            continue
    for fmt in ("%a, %d %b %Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d %b %Y", "%d %B %Y"):
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.strftime("%a, %d %b %Y")
        except Exception:
            continue
    return raw


def _load_cricbuzz_match_map() -> list[dict[str, Any]]:
    try:
        raw = CRICBUZZ_MATCH_MAP_PATH.read_text(encoding="utf-8")
        data = json.loads(raw)
    except Exception:
        return []
    return data if isinstance(data, list) else []


def _lookup_cricbuzz_match_id(match: Match) -> int:
    rows = _load_cricbuzz_match_map()
    wanted_date = _format_cricbuzz_lookup_date(str(match.match_date or ""))
    team_a = str(match.team_a_abbr or "").strip().upper()
    team_b = str(match.team_b_abbr or "").strip().upper()
    for row in rows:
        if _format_cricbuzz_lookup_date(str(row.get("date") or "")) != wanted_date:
            continue
        row_a = str(row.get("team1") or "").strip().upper()
        row_b = str(row.get("team2") or "").strip().upper()
        if {row_a, row_b} == {team_a, team_b}:
            return _to_non_negative_int(row.get("matchId"), 0)
    return 0


def _fetch_cricbuzz_rapidapi_scorecard(match_id: int, insecure: bool = False) -> dict[str, Any]:
    if not CRICBUZZ_RAPIDAPI_KEY:
        raise HTTPException(status_code=503, detail="AI scoring draft is not configured yet. Add CRICBUZZ_RAPIDAPI_KEY on the server.")
    url = f"https://{CRICBUZZ_RAPIDAPI_HOST}/mcenter/v1/{int(match_id)}/scard"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "identity",
            "Content-Type": "application/json",
            "x-rapidapi-host": CRICBUZZ_RAPIDAPI_HOST,
            "x-rapidapi-key": CRICBUZZ_RAPIDAPI_KEY,
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw_bytes = resp.read()
            content_encoding = str(resp.headers.get("Content-Encoding") or "")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=502, detail=f"Cricbuzz RapidAPI scorecard fetch failed: {body or exc.reason}") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Cricbuzz RapidAPI scorecard fetch failed: {exc}") from exc
    if content_encoding.lower() == "gzip":
        try:
            raw_bytes = gzip.decompress(raw_bytes)
        except Exception:
            pass
    try:
        return json.loads(raw_bytes.decode("utf-8", errors="ignore"))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Cricbuzz RapidAPI returned invalid JSON: {exc}") from exc


def _search_trusted_cricket_sources(question: str, context: dict[str, Any], limit: int = 5, preferred_url: str = "") -> list[dict[str, Any]]:
    target_match = context.get("targetMatch") if isinstance(context.get("targetMatch"), dict) else {}
    team_a = str((target_match or {}).get("teamAabbr") or "").strip()
    team_b = str((target_match or {}).get("teamBabbr") or "").strip()
    extra = f" {team_a} {team_b}" if team_a or team_b else ""
    q_lower = str(question or "").lower()
    injury_search = any(term in q_lower for term in ("injured", "injury", "might not play", "may not play", "availability", "ruled out", "fitness", "doubtful", "unavailable"))
    stats_leader_search = any(
        term in q_lower
        for term in (
            "orange cap",
            "purple cap",
            "most runs",
            "most wickets",
            "leading run scorer",
            "leading wicket taker",
            "top scorer",
            "top wicket",
            "stats leader",
            "run charts",
            "wicket charts",
        )
    )
    scorecard_search = any(
        term in q_lower
        for term in (
            "scorecard",
            "winner",
            "player stats",
            "man of the match",
            "match report",
            "full scorecard",
        )
    )
    results: list[dict[str, Any]] = []
    seen: set[str] = set()
    if stats_leader_search:
        search_domains = ("iplt20.com", "espncricinfo.com", "cricbuzz.com")
    elif scorecard_search:
        search_domains = ("sports.ndtv.com", "cricbuzz.com", "espncricinfo.com", "iplt20.com")
    else:
        search_domains = ("iplt20.com", "cricbuzz.com", "espncricinfo.com")

    preferred = str(preferred_url or "").strip()
    preferred_domain = _trusted_cricket_domain(preferred)
    if preferred and preferred_domain:
        fetched = _fetch_source_snippet(preferred)
        title = fetched.get("title") or preferred
        snippet = fetched.get("snippet") or ""
        results.append(
            {
                "title": title[:180],
                "url": preferred,
                "domain": preferred_domain,
                "source": _trusted_source_name(preferred_domain),
                "snippet": snippet[:420],
                "detailed_text": fetched.get("detailed_text", "")[:3000],
                "text_length": _to_non_negative_int(fetched.get("text_length"), 0),
                "score": 100,
            }
        )
        seen.add(preferred)

    for domain in search_domains:
        if injury_search:
            query = f"{question} IPL injury availability playing xi{extra} site:{domain}".strip()
        elif stats_leader_search and "iplt20.com" in domain:
            query = f"{question} IPL 2026 stats site:{domain}/stats/2026".strip()
        else:
            query = f"{question} IPL{extra} site:{domain}".strip()
        url = "https://html.duckduckgo.com/html/?" + urllib.parse.urlencode({"q": query})
        try:
            html_text = _fetch_url_text(url, timeout=10)
        except Exception:
            continue
        parser = _DuckDuckGoResultsParser()
        try:
            parser.feed(html_text)
        except Exception:
            continue
        for row in parser.results:
            final_url = _decode_ddg_result_url(row.get("url", ""))
            trusted_domain = _trusted_cricket_domain(final_url)
            if not trusted_domain or final_url in seen:
                continue
            seen.add(final_url)
            fetched = _fetch_source_snippet(final_url)
            title = row.get("title") or fetched.get("title") or final_url
            snippet = row.get("snippet") or fetched.get("snippet") or ""
            haystack = f"{title} {snippet}".lower()
            score = 10
            if team_a and team_a.lower() in haystack:
                score += 3
            if team_b and team_b.lower() in haystack:
                score += 3
            if "scorecard" in haystack:
                score += 2
            if "live" in haystack:
                score += 1
            if scorecard_search:
                if "sports.ndtv.com" in trusted_domain:
                    score += 8
                elif "cricbuzz.com" in trusted_domain:
                    score += 6
                elif "espncricinfo.com" in trusted_domain:
                    score += 4
                elif "iplt20.com" in trusted_domain:
                    score += 1
                if "player of the match" in haystack or "man of the match" in haystack:
                    score += 4
                if "scorecard" in haystack:
                    score += 4
                if "match tied" in haystack or "won the super over" in haystack:
                    score += 3
                if "batsman" in haystack and "bowling" in haystack:
                    score += 4
            if stats_leader_search:
                if "orange cap" in haystack or "purple cap" in haystack:
                    score += 4
                if "most runs" in haystack or "most wickets" in haystack or "stats" in haystack:
                    score += 3
                if "iplt20.com/stats/2026" in final_url:
                    score += 8
                elif "espncricinfo.com" in trusted_domain:
                    score += 4
                elif "cricbuzz.com" in trusted_domain:
                    score += 2
            if injury_search:
                if "injury" in haystack or "injured" in haystack:
                    score += 4
                if "availability" in haystack or "ruled out" in haystack or "fitness" in haystack or "doubtful" in haystack:
                    score += 3
                if "playing xi" in haystack or "team news" in haystack:
                    score += 2
            source_name = _trusted_source_name(trusted_domain)
            results.append(
                {
                    "title": title[:180],
                    "url": final_url,
                    "domain": trusted_domain,
                    "source": source_name,
                    "snippet": snippet[:420],
                    "detailed_text": fetched.get("detailed_text", "")[:3000],
                    "text_length": _to_non_negative_int(fetched.get("text_length"), 0),
                    "score": score,
                }
            )
            if len(results) >= limit * 2:
                break
        if len(results) >= limit * 2:
            break

    results.sort(key=lambda row: (-int(row.get("score") or 0), row.get("source") or "", row.get("title") or ""))
    trimmed = results[:limit]
    for idx, row in enumerate(trimmed, start=1):
        row["rank"] = idx
    return trimmed


def _azure_openai_hybrid_answer(question: str, context: dict[str, Any], actor_username: str = "") -> dict[str, Any]:
    if not AZURE_OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="IFL GURU is not configured yet. Add AZURE_OPENAI_API_KEY on the server.")

    needs_web = _question_needs_trusted_web(question)
    sources = _search_trusted_cricket_sources(question, context) if needs_web else []
    context_for_model = json.loads(json.dumps(context, ensure_ascii=False))
    rank_ctx = context_for_model.get("rankClimbContext")
    if isinstance(rank_ctx, dict):
        rank_ctx.pop("yourPrediction", None)
        rank_ctx.pop("abovePrediction", None)
        rank_ctx.pop("predictionSwing", None)
    recent = context_for_model.get("recentResults")
    if isinstance(recent, list):
        for row in recent:
            if isinstance(row, dict):
                row.pop("yourPick", None)
                row.pop("predictionPoints", None)
                row.pop("predictionCorrect", None)

    system_text = (
        "You are IFL GURU, an IPL-only assistant inside a fantasy league app. "
        "Answer only questions about the Indian Premier League, current IPL news, IPL stats, match insights, "
        "fantasy implications, and the user's IFL standing or squad context. "
        "If the question is not about IPL or IFL, refuse briefly and redirect to IPL-related help. "
        "Use the provided user context to personalize the answer. "
        "For internal IFL questions such as active players, rank movement, differential picks, or rating the team, answer directly from the provided user context without saying web sources are missing. "
        "If the user asks about player swaps, use swapAdvice from context to suggest practical swap-out and swap-in options that fit the current team balance rules. "
        "Use only the provided trusted cricket source snippets for current-news or current-stats claims. "
        "If the snippets are insufficient for a web-dependent question, say so clearly instead of guessing. "
        "Be concrete and use exact player names, ownership counts, rank gaps, and prediction counts when available. "
        "Do not mention prediction split, crowd prediction trends, the user's prediction, or player-specific prediction angles. "
        "For injury or availability questions, answer only from trusted source snippets and clearly separate confirmed absences from uncertainty or fitness doubts. "
        "For IPL news, scorecard, form, injury, or availability questions, always treat the 2026 IPL season as the default current season and explicitly mention 'IPL 2026' or '2026 season' in the response. "
        "Keep answers concise, practical, and factual. Prefer short bullets only when useful."
    )
    sources_text = "\n\n".join(
        [
            f"[Source {idx + 1}] {src.get('source')} | {src.get('title')}\n"
            f"URL: {src.get('url')}\n"
            f"Snippet: {src.get('snippet')}"
            for idx, src in enumerate(sources)
        ]
    ) or ("No trusted web sources were found for this question." if needs_web else "Web search was not used because this is an internal IFL-context question.")
    user_text = (
        f"User question:\n{question.strip()}\n\n"
        f"User IFL context:\n{json.dumps(context_for_model, ensure_ascii=False, indent=2)}\n\n"
        f"Trusted cricket source snippets:\n{sources_text}\n\n"
        "Requirements:\n"
        "- Stay focused on IPL/IFL only.\n"
        "- Personalize using the user's team, rank, active players, and match context when relevant.\n"
        "- For internal questions, use the provided IFL context first and be specific.\n"
        "- For players-at-play style questions, use playersAtPlay, yourMatchdayExposure, uniquePlayers, differentialPlayers, totalActiveAccumulatedPoints, and noPlayersInThisSquad.\n"
        "- For live/current news or stats, cite the provided trusted sources in the prose naturally.\n"
        "- For differential questions, use ownedBy counts from activePlayers and differentialActivePlayers.\n"
        "- For move-up or rank questions, use rankClimbContext, teamAbove, gapToAbove, and active-player edges; do not mention prediction angles.\n"
        "- For winner-chance questions, answer from trusted cricket sources and match context, not from crowd prediction split.\n"
        "- For rate-my-team questions, use teamRating and explain in terms of coverage, form, and differentials.\n"
        "- For swap questions, use swapAdvice.currentWindow, weakestSquadPlayers, bestPoolCandidates, and singleSwapSuggestions.\n"
        "- For swap questions, prefer 1 to 3 practical suggestions and mention that final swap submission must still satisfy 20 players, at least 6 bowlers, and at most 8 international players.\n"
        "- For injury or might-not-play questions, cite the trusted sources, mention whether the player is confirmed out, doubtful, or just under watch, and avoid overstating uncertain reports.\n"
        "- For news-style questions, explicitly mention that the answer is based on IPL 2026 / the 2026 season.\n"
        "- If the answer depends on uncertain or unavailable live data, say so clearly.\n"
    )

    payload = {
        "messages": [
            {"role": "system", "content": system_text},
            {"role": "user", "content": user_text},
        ],
        "temperature": 0.2,
        "top_p": 0.9,
        "max_tokens": 1024,
    }
    url = (
        f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/"
        f"{urllib.parse.quote(AZURE_OPENAI_DEPLOYMENT, safe='')}/chat/completions"
        f"?api-version={urllib.parse.quote(AZURE_OPENAI_API_VERSION, safe='')}"
    )
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "api-key": AZURE_OPENAI_API_KEY,
        },
        method="POST",
    )
    request_chars = len(system_text) + len(user_text)
    started_at = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        _log_openai_api_audit(
            provider="azure-openai",
            deployment=AZURE_OPENAI_DEPLOYMENT,
            api_type="chat.completions",
            use_case="ifl_guru",
            actor_username=actor_username,
            request_chars=request_chars,
            duration_ms=int((time.time() - started_at) * 1000),
            status=f"http_{exc.code}",
            error_message=details or str(exc.reason or exc),
        )
        if exc.code == 429:
            retry_after = None
            headers = getattr(exc, "headers", None)
            if headers is not None:
                retry_after = headers.get("retry-after") or headers.get("x-ratelimit-reset-requests")
            retry_hint = ""
            if retry_after:
                retry_hint = f" Please try again in about {retry_after} seconds."
            else:
                retry_hint = " Please try again shortly."
            raise HTTPException(
                status_code=429,
                detail=f"IFL GURU is temporarily unavailable because the Azure OpenAI usage limit has been reached.{retry_hint}",
            ) from exc
        raise HTTPException(status_code=502, detail=f"Azure OpenAI request failed: {details or exc.reason}") from exc
    except Exception as exc:
        _log_openai_api_audit(
            provider="azure-openai",
            deployment=AZURE_OPENAI_DEPLOYMENT,
            api_type="chat.completions",
            use_case="ifl_guru",
            actor_username=actor_username,
            request_chars=request_chars,
            duration_ms=int((time.time() - started_at) * 1000),
            status="error",
            error_message=str(exc),
        )
        raise HTTPException(status_code=502, detail=f"Azure OpenAI request failed: {exc}") from exc

    try:
        data = json.loads(raw)
    except Exception as exc:
        _log_openai_api_audit(
            provider="azure-openai",
            deployment=AZURE_OPENAI_DEPLOYMENT,
            api_type="chat.completions",
            use_case="ifl_guru",
            actor_username=actor_username,
            request_chars=request_chars,
            response_chars=len(raw),
            duration_ms=int((time.time() - started_at) * 1000),
            status="invalid_json",
            error_message="Azure OpenAI returned invalid JSON",
        )
        raise HTTPException(status_code=502, detail="Azure OpenAI returned invalid JSON") from exc

    choices = data.get("choices") or []
    answer = ""
    if choices and isinstance(choices[0], dict):
        msg = choices[0].get("message") or {}
        answer = str(msg.get("content") or "").strip()
    if not answer:
        usage = data.get("usage") or {}
        _log_openai_api_audit(
            provider="azure-openai",
            deployment=AZURE_OPENAI_DEPLOYMENT,
            api_type="chat.completions",
            use_case="ifl_guru",
            actor_username=actor_username,
            request_chars=request_chars,
            response_chars=len(raw),
            prompt_tokens=_to_non_negative_int(usage.get("prompt_tokens"), 0) or None,
            completion_tokens=_to_non_negative_int(usage.get("completion_tokens"), 0) or None,
            total_tokens=_to_non_negative_int(usage.get("total_tokens"), 0) or None,
            duration_ms=int((time.time() - started_at) * 1000),
            status="empty_answer",
            error_message="Azure OpenAI returned an empty answer",
        )
        raise HTTPException(status_code=502, detail="Azure OpenAI returned an empty answer")
    usage = data.get("usage") or {}
    _log_openai_api_audit(
        provider="azure-openai",
        deployment=AZURE_OPENAI_DEPLOYMENT,
        api_type="chat.completions",
        use_case="ifl_guru",
        actor_username=actor_username,
        request_chars=request_chars,
        response_chars=len(raw),
        prompt_tokens=_to_non_negative_int(usage.get("prompt_tokens"), 0) or None,
        completion_tokens=_to_non_negative_int(usage.get("completion_tokens"), 0) or None,
        total_tokens=_to_non_negative_int(usage.get("total_tokens"), 0) or None,
        duration_ms=int((time.time() - started_at) * 1000),
        status="success",
    )

    return {
        "answer": answer,
        "sources": sources,
        "searchMode": "trusted-hybrid" if needs_web else "internal-context",
        "model": AZURE_OPENAI_DEPLOYMENT,
    }


def _normalize_name_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(name or "").lower())


def _player_name_tokens(name: str) -> list[str]:
    raw_tokens = [tok for tok in re.split(r"[^a-z0-9]+", str(name or "").lower()) if tok]
    alias_map = {
        "mohd": "mohammed",
        "md": "mohammed",
        "mhd": "mohammed",
        "mohammad": "mohammed",
        "mohd.": "mohammed",
        "muhammad": "mohammed",
    }
    return [alias_map.get(tok, tok) for tok in raw_tokens]


def _player_name_lookup_keys(name: str) -> set[str]:
    tokens = _player_name_tokens(name)
    keys = set()
    if tokens:
        keys.add("".join(tokens))
        if len(tokens) > 2:
            reduced = [tok for tok in tokens if tok not in {"singh", "kumar"}]
            if reduced:
                keys.add("".join(reduced))
        if len(tokens) >= 2:
            keys.add(f"{tokens[0]}{tokens[-1]}")
    keys.add(_normalize_name_key(name))
    return {k for k in keys if k}


def _resolve_fixture_player_name(raw_name: str, players: list[Player]) -> str:
    wanted = str(raw_name or "").strip()
    if not wanted:
        return ""
    lookup_keys = _player_name_lookup_keys(wanted)
    exact_map: dict[str, str] = {}
    player_meta: list[tuple[str, str, list[str]]] = []
    for p in players:
        pname = str(p.name or "").strip()
        keys = _player_name_lookup_keys(pname)
        for key in keys:
            exact_map.setdefault(key, pname)
        player_meta.append((pname, "".join(_player_name_tokens(pname)), _player_name_tokens(pname)))

    for key in lookup_keys:
        if key in exact_map:
            return exact_map[key]

    wanted_tokens = _player_name_tokens(wanted)
    wanted_key = "".join(wanted_tokens)
    wanted_last = wanted_tokens[-1] if wanted_tokens else ""
    best_name = ""
    best_score = 0.0
    for pname, pkey, ptokens in player_meta:
        score = difflib.SequenceMatcher(None, wanted_key, pkey).ratio()
        if wanted_last and ptokens and ptokens[-1] == wanted_last:
            score += 0.08
        if wanted_tokens and ptokens and wanted_tokens[0][:1] == ptokens[0][:1]:
            score += 0.03
        if len(wanted_tokens) > 1 and len(ptokens) > 1 and set(wanted_tokens) & set(ptokens):
            score += 0.03
        if score > best_score:
            best_score = score
            best_name = pname
    return best_name if best_score >= 0.86 else wanted


def _extract_first_json_object(raw_text: str) -> str:
    text = str(raw_text or "").strip()
    if not text:
        raise ValueError("Empty model response")
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    if start < 0:
        raise ValueError("No JSON object found")
    depth = 0
    in_string = False
    escape = False
    for idx in range(start, len(text)):
        ch = text[idx]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:idx + 1]
    raise ValueError("Incomplete JSON object")


def _generate_admin_scoring_draft(match: Match, players: list[Player], preferred_url: str = "", actor_username: str = "") -> dict[str, Any]:
    if not AZURE_OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="AI scoring draft is not configured yet. Add AZURE_OPENAI_API_KEY on the server.")
    match_id = _lookup_cricbuzz_match_id(match)
    if match_id <= 0:
        raise HTTPException(status_code=404, detail=f"No Cricbuzz match id mapping found for Match {match.id}: {match.team_a_abbr} vs {match.team_b_abbr} on {_format_cricbuzz_lookup_date(str(match.match_date or ''))}")

    scorecard_payload = _fetch_cricbuzz_rapidapi_scorecard(match_id)
    raw_json_text = json.dumps(scorecard_payload, ensure_ascii=False, separators=(",", ":"))
    pretty_json_text = json.dumps(scorecard_payload, ensure_ascii=False, indent=2)
    sources = [
        {
            "title": f"Cricbuzz RapidAPI scorecard JSON for match {match_id}",
            "url": f"https://{CRICBUZZ_RAPIDAPI_HOST}/mcenter/v1/{match_id}/scard",
            "domain": CRICBUZZ_RAPIDAPI_HOST,
            "source": "Cricbuzz RapidAPI",
            "snippet": raw_json_text[:420],
            "detailed_text": pretty_json_text[:3000],
            "text_length": len(pretty_json_text),
            "score": 1000,
            "rank": 1,
        }
    ]

    sources_text = (
        f"[Source 1] Cricbuzz RapidAPI | Match {match_id}\n"
        f"URL: https://{CRICBUZZ_RAPIDAPI_HOST}/mcenter/v1/{match_id}/scard\n"
        f"Snippet: {raw_json_text[:420]}\n"
        f"Detailed excerpt ({len(pretty_json_text)} chars total): {pretty_json_text[:12000]}"
    )
    system_text = (
        "You are converting structured Cricbuzz scorecard JSON into a fantasy scoring import JSON for a custom IPL-style app. "
        "Output only valid JSON. Do not add markdown. Do not explain anything. "
        'Required output format: {"winner":"TEAM_ABBR","motm":"Player Name","players":[{"name":"Player Name","runs":0,"catches":0,"runouts":0,"wickets":0}]}. '
        "Read the supplied JSON carefully. Extract winner from the match status, including super over results. "
        "Extract runs from batsman rows and wickets from bowler rows. "
        "Infer catches from dismissals like 'c Fielder b Bowler' and 'c & b Bowler'. "
        "Count stumpings and run outs inside runouts because the schema has no separate stumping field. "
        "Merge batting, bowling, and fielding contributions for the same player. "
        "Include the full player list that can be inferred from the scorecard JSON, even if some players have only one type of contribution. "
        "Use these IPL team abbreviations when setting winner: CSK=Chennai Super Kings, DC=Delhi Capitals, GT=Gujarat Titans, KKR=Kolkata Knight Riders, LSG=Lucknow Super Giants, MI=Mumbai Indians, PBKS=Punjab Kings, RCB=Royal Challengers Bengaluru, RR=Rajasthan Royals, SRH=Sunrisers Hyderabad, NR=No Result. "
        "If the scorecard JSON does not contain a reliable man of the match field, leave motm as an empty string. "
        "Prefer explicit JSON facts over inference. Return only JSON."
    )
    user_text = (
        "Convert this Cricbuzz scorecard JSON into the required JSON.\n\n"
        f"Resolved Cricbuzz match id: {match_id}\n"
        f"Match: {match.team_a_abbr} v {match.team_b_abbr}\n"
        f"Date: {match.match_date}\n"
        f"Venue: {match.venue}\n\n"
        f"Structured scorecard source:\n{sources_text}\n\n"
        "Return only the JSON object."
    )
    request_chars = len(system_text) + len(user_text)
    started_at = time.time()
    azure_mode = "responses" if ("preview" in str(AZURE_OPENAI_API_VERSION or "").lower() or str(AZURE_OPENAI_DEPLOYMENT or "").lower().startswith("gpt-5")) else "chat"
    if azure_mode == "responses":
        payload = {
            "model": AZURE_OPENAI_DEPLOYMENT,
            "input": [
                {"role": "system", "content": system_text},
                {"role": "user", "content": user_text},
            ],
            "max_output_tokens": 2200,
        }
        url = f"{AZURE_OPENAI_ENDPOINT}/openai/responses?api-version={urllib.parse.quote(AZURE_OPENAI_API_VERSION, safe='')}"
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {AZURE_OPENAI_API_KEY}"}
        api_type = "responses"
    else:
        payload = {
            "messages": [
                {"role": "system", "content": system_text},
                {"role": "user", "content": user_text},
            ],
            "temperature": 0.1,
            "top_p": 0.9,
            "max_tokens": 2200,
        }
        url = (
            f"{AZURE_OPENAI_ENDPOINT}/openai/deployments/"
            f"{urllib.parse.quote(AZURE_OPENAI_DEPLOYMENT, safe='')}/chat/completions"
            f"?api-version={urllib.parse.quote(AZURE_OPENAI_API_VERSION, safe='')}"
        )
        headers = {"Content-Type": "application/json", "api-key": AZURE_OPENAI_API_KEY}
        api_type = "chat.completions"
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    request_chars = len(system_text) + len(user_text)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        _log_openai_api_audit(
            provider="azure-openai",
            deployment=AZURE_OPENAI_DEPLOYMENT,
            api_type=api_type,
            use_case="admin_scoring_draft",
            actor_username=actor_username,
            request_chars=request_chars,
            duration_ms=int((time.time() - started_at) * 1000),
            status=f"http_{exc.code}",
            error_message=details or str(exc.reason or exc),
        )
        if exc.code == 429:
            raise HTTPException(status_code=429, detail="AI scoring draft is temporarily unavailable because the Azure OpenAI usage limit has been reached. Please try again shortly.") from exc
        raise HTTPException(status_code=502, detail=f"Azure OpenAI scoring draft request failed: {details or exc.reason}") from exc
    except Exception as exc:
        _log_openai_api_audit(
            provider="azure-openai",
            deployment=AZURE_OPENAI_DEPLOYMENT,
            api_type=api_type,
            use_case="admin_scoring_draft",
            actor_username=actor_username,
            request_chars=request_chars,
            duration_ms=int((time.time() - started_at) * 1000),
            status="error",
            error_message=str(exc),
        )
        raise HTTPException(status_code=502, detail=f"Azure OpenAI scoring draft request failed: {exc}") from exc

    try:
        data = json.loads(raw)
        if azure_mode == "responses":
            output = data.get("output")
            texts: list[str] = []
            if isinstance(output, list):
                for item in output:
                    if not isinstance(item, dict):
                        continue
                    content = item.get("content")
                    if isinstance(content, list):
                        for part in content:
                            if isinstance(part, dict):
                                text = part.get("text")
                                if isinstance(text, str) and text.strip():
                                    texts.append(text)
            answer = "\n".join(texts).strip()
        else:
            choices = data.get("choices") or []
            message = choices[0].get("message") if choices and isinstance(choices[0], dict) else {}
            answer = str((message or {}).get("content") or "").strip()
        draft_text = _extract_first_json_object(answer)
        parsed = json.loads(draft_text)
    except Exception as exc:
        _log_openai_api_audit(
            provider="azure-openai",
            deployment=AZURE_OPENAI_DEPLOYMENT,
            api_type=api_type,
            use_case="admin_scoring_draft",
            actor_username=actor_username,
            request_chars=request_chars,
            response_chars=len(raw),
            duration_ms=int((time.time() - started_at) * 1000),
            status="invalid_json",
            error_message=str(exc),
        )
        raise HTTPException(status_code=502, detail=f"AI scoring draft returned invalid JSON: {exc}") from exc

    cleaned_players: list[dict[str, Any]] = []
    for row in parsed.get("players", []) if isinstance(parsed, dict) else []:
        if not isinstance(row, dict):
            continue
        raw_name = str(row.get("name") or "").strip()
        if not raw_name:
            continue
        resolved_name = _resolve_fixture_player_name(raw_name, players)
        cleaned = {
            "name": resolved_name or raw_name,
            "runs": _to_non_negative_int(row.get("runs"), 0),
            "catches": _to_non_negative_int(row.get("catches"), 0),
            "runouts": _to_non_negative_int(row.get("runouts"), 0),
            "wickets": _to_non_negative_int(row.get("wickets"), 0),
        }
        cleaned_players.append(cleaned)
    parsed = parsed if isinstance(parsed, dict) else {}
    parsed["players"] = cleaned_players
    parsed["winner"] = str(parsed.get("winner") or "").strip()
    parsed["motm"] = _resolve_fixture_player_name(str(parsed.get("motm") or "").strip(), players)

    usage = data.get("usage") or {}
    _log_openai_api_audit(
        provider="azure-openai",
        deployment=AZURE_OPENAI_DEPLOYMENT,
        api_type=api_type,
        use_case="admin_scoring_draft",
        actor_username=actor_username,
        request_chars=request_chars,
        response_chars=len(raw),
        prompt_tokens=_to_non_negative_int(usage.get("prompt_tokens"), 0) or None,
        completion_tokens=_to_non_negative_int(usage.get("completion_tokens"), 0) or None,
        total_tokens=_to_non_negative_int(usage.get("total_tokens"), 0) or None,
        duration_ms=int((time.time() - started_at) * 1000),
        status="success",
    )
    return {
        "draftText": json.dumps(parsed, ensure_ascii=False, indent=2),
        "draft": parsed,
        "sources": sources,
        "model": AZURE_OPENAI_DEPLOYMENT,
        "searchMode": "cricbuzz-rapidapi-json",
        "resolvedMatchId": match_id,
    }
def _migrate_match_stats_from_store_kv(db: Session):
    if db.scalars(select(MatchPlayerStat.match_id).limit(1)).first() is not None:
        return

    legacy = db.get(StoreKV, "ifl_match_stats")
    if legacy is None:
        return

    try:
        parsed = json.loads(legacy.value_json)
    except Exception:
        return
    if not isinstance(parsed, dict):
        return

    valid_match_ids = {int(x) for x in db.scalars(select(Match.id)).all()}
    valid_player_ids = {int(x) for x in db.scalars(select(Player.id)).all()}
    now = datetime.utcnow()
    for match_id, stat in parsed.items():
        mid = _to_non_negative_int(match_id, -1)
        if mid < 0 or mid not in valid_match_ids:
            continue
        if not isinstance(stat, dict):
            continue
        players = stat.get("players", {})
        if isinstance(players, dict):
            for player_id, pstat in players.items():
                pid = _to_non_negative_int(player_id, -1)
                if pid < 0 or pid not in valid_player_ids or not isinstance(pstat, dict):
                    continue
                db.merge(
                    MatchPlayerStat(
                        match_id=mid,
                        player_id=pid,
                        runs=_to_non_negative_int(pstat.get("runs", 0), 0),
                        catches=_to_non_negative_int(pstat.get("catches", 0), 0),
                        runouts=_to_non_negative_int(pstat.get("runouts", 0), 0),
                        wickets=_to_non_negative_int(pstat.get("wickets", 0), 0),
                        created_at=now,
                        updated_at=now,
                    )
                )

        motm_player_id = stat.get("motmPlayerId")
        motm = _to_non_negative_int(motm_player_id, -1)
        if motm > 0 and motm in valid_player_ids:
            db.merge(MatchMeta(match_id=mid, motm_player_id=motm, updated_at=now))

    db.execute(delete(StoreKV).where(StoreKV.key == "ifl_match_stats"))


def read_store():
    with SessionLocal() as db:
        players = [
            {"id": int(p.id), "team": p.team, "name": p.name, "role": p.role, "country": p.country}
            for p in db.scalars(select(Player).order_by(Player.id)).all()
        ]

        matches = [
            {
                "id": int(m.id),
                "date": m.match_date,
                "teamA": m.team_a,
                "teamAabbr": m.team_a_abbr,
                "teamB": m.team_b,
                "teamBabbr": m.team_b_abbr,
                "venue": m.venue,
                "winner": m.winner or "",
            }
            for m in db.scalars(select(Match).order_by(Match.match_date, Match.id)).all()
        ]

        users = {}
        users_by_id = {}
        for r in db.scalars(select(User).order_by(User.username)).all():
            u = {
                "teamName": r.team_name,
                "teamLogo": r.team_logo or "",
                "players": [],
                "points": int(r.points or 0),
                "predictions": {},
                "swapWindows": {},
                "squadSubmitted": _bool_from_db(r.squad_submitted) is True,
                "squadValidated": _bool_from_db(r.squad_validated) is True,
                "squadFrozen": _bool_from_db(r.squad_frozen) is True,
            }
            users[r.username] = u
            users_by_id[int(r.id)] = u

        for r in db.scalars(
            select(UserPlayer)
            .where(UserPlayer.is_deleted == 0)
            .order_by(UserPlayer.user_id, UserPlayer.player_id)
        ).all():
            u = users_by_id.get(int(r.user_id))
            if u is not None:
                u["players"].append(int(r.player_id))
                if r.submitted_at is not None:
                    u.setdefault("playerSubmittedAt", {})[str(r.player_id)] = _store_match_ts(r.submitted_at)
                if getattr(r, "frozen_at", None) is not None:
                    u.setdefault("playerFrozenAt", {})[str(r.player_id)] = _store_match_ts(r.frozen_at)

        for r in db.scalars(select(Prediction).order_by(Prediction.user_id, Prediction.match_id)).all():
            u = users_by_id.get(int(r.user_id))
            if u is None:
                continue
            u["predictions"][str(r.match_id)] = {
                "pick": r.pick,
                "correct": _bool_from_db(r.is_correct),
                "pts": int(r.points_awarded or 0),
            }

        for r in db.scalars(
            select(UserSwap)
            .where(UserSwap.is_deleted == 0, UserSwap.is_frozen == 1, UserSwap.is_validated == 1)
            .order_by(UserSwap.user_id, UserSwap.window_id, UserSwap.id)
        ).all():
            u = users_by_id.get(int(r.user_id))
            if u is None:
                continue
            sw = u.setdefault("swapWindows", {})
            win = sw.setdefault(str(r.window_id), {"out": [], "in": []})
            win["out"].append(int(r.out_player_id))
            win["in"].append(int(r.in_player_id))

        match_stats = {}
        for r in db.scalars(select(MatchPlayerStat).order_by(MatchPlayerStat.match_id, MatchPlayerStat.player_id)).all():
            mid = str(int(r.match_id))
            pid = str(int(r.player_id))
            if mid not in match_stats:
                match_stats[mid] = {"players": {}, "motmPlayerId": ""}
            match_stats[mid]["players"][pid] = {
                "runs": _to_non_negative_int(r.runs, 0),
                "catches": _to_non_negative_int(r.catches, 0),
                "runouts": _to_non_negative_int(r.runouts, 0),
                "wickets": _to_non_negative_int(r.wickets, 0),
            }
        for r in db.scalars(select(MatchMeta).order_by(MatchMeta.match_id)).all():
            mid = str(int(r.match_id))
            if mid not in match_stats:
                match_stats[mid] = {"players": {}, "motmPlayerId": ""}
            motm = _to_non_negative_int(r.motm_player_id, 0)
            match_stats[mid]["motmPlayerId"] = motm if motm > 0 else ""

        swap_windows = [
            {
                "id": int(w.id),
                "name": w.name,
                "start_at": w.start_at,
                "lock_at": w.lock_at,
                "end_at": w.end_at,
                "effective_match_id": _to_non_negative_int(w.effective_match_id, 0),
            }
            for w in db.scalars(select(SwapWindow).order_by(SwapWindow.start_at, SwapWindow.id)).all()
        ]

        allowed_row = db.get(StoreKV, "ifl_allowed_phones")
        allowed_phones = []
        if allowed_row is not None:
            try:
                parsed = json.loads(allowed_row.value_json)
                if isinstance(parsed, list):
                    allowed_phones = [str(x) for x in parsed]
            except Exception:
                allowed_phones = []

        team_code_row = db.get(StoreKV, "ifl_global_team_code")
        global_team_code = "IFL2026"
        if team_code_row is not None:
            try:
                parsed = json.loads(team_code_row.value_json)
                if isinstance(parsed, str) and parsed.strip():
                    global_team_code = parsed.strip().upper()
            except Exception:
                global_team_code = "IFL2026"

        playoffs_row = db.get(StoreKV, "ifl_playoffs_predictions")
        playoff_preds = {}
        if playoffs_row is not None:
            try:
                parsed = json.loads(playoffs_row.value_json)
                if isinstance(parsed, dict):
                    playoff_preds = {str(k): v for k, v in parsed.items()}
            except Exception:
                playoff_preds = {}

    return {
        "ifl_users": users,
        "ifl_master_players": players,
        "ifl_master_matches": matches,
        "ifl_match_stats": match_stats,
        "ifl_swap_windows": swap_windows,
        "ifl_playoffs_predictions": playoff_preds,
        "ifl_allowed_phones": allowed_phones,
        "ifl_global_team_code": global_team_code,
    }


def _safe_public_user_payload(username: str) -> dict[str, Any] | None:
    try:
        store = read_store()
    except Exception:
        return None
    users = store.get("ifl_users", {})
    if not isinstance(users, dict):
        return None
    user = users.get(str(username))
    return user if isinstance(user, dict) else None


def _safe_bootstrap_actor(authorization: str | None) -> str | None:
    header = str(authorization or "").strip()
    if not header.lower().startswith("bearer "):
        return None
    token = header[7:].strip()
    if not token:
        return None
    if _verify_admin_token(token) is not None:
        return "admin"
    if _verify_user_token(token) is not None:
        return "user"
    return None


def read_public_store():
    store = read_store()
    public_users: dict[str, dict[str, Any]] = {}
    users = store.get("ifl_users", {})
    if isinstance(users, dict):
        for username, raw_user in users.items():
            user = raw_user if isinstance(raw_user, dict) else {}
            public_users[str(username)] = {
                "teamName": str(user.get("teamName") or "Untitled Team"),
                "teamLogo": str(user.get("teamLogo") or ""),
                "points": int(user.get("points") or 0),
                "lastEarned": int(user.get("lastEarned") or 0),
                "squadSubmitted": _bool_from_db(user.get("squadSubmitted")),
                "squadValidated": _bool_from_db(user.get("squadValidated")),
                "squadFrozen": _bool_from_db(user.get("squadFrozen")),
            }

    return {
        "ifl_users": public_users,
        "ifl_master_players": store.get("ifl_master_players", []),
        "ifl_master_matches": store.get("ifl_master_matches", []),
        "ifl_match_stats": store.get("ifl_match_stats", {}),
        "ifl_swap_windows": store.get("ifl_swap_windows", []),
    }


def write_key(key, value, expected_version: str | None = None):
    with SessionLocal() as db:
        now = datetime.utcnow()
        current_version = _compute_store_key_version(db, key)
        if expected_version and expected_version != current_version:
            raise StaleWriteError(current_version)

        if key == "ifl_master_players":
            players = value if isinstance(value, list) else []
            incoming_ids: set[int] = set()
            for p in players:
                try:
                    pid = int(p.get("id", 0))
                except Exception:
                    continue
                if pid <= 0:
                    continue
                incoming_ids.add(pid)
                row = db.get(Player, pid)
                if row is None:
                    db.add(
                        Player(
                            id=pid,
                            team=str(p.get("team", "")),
                            name=str(p.get("name", "")),
                            role=str(p.get("role", "")),
                            country=str(p.get("country", "India")),
                            created_at=now,
                            updated_at=now,
                        )
                    )
                else:
                    row.team = str(p.get("team", ""))
                    row.name = str(p.get("name", ""))
                    row.role = str(p.get("role", ""))
                    row.country = str(p.get("country", "India"))
                    row.updated_at = now
            if incoming_ids:
                db.execute(delete(Player).where(Player.id.not_in(incoming_ids)))
            else:
                db.execute(delete(Player))
            db.commit()
            return _compute_store_key_version(db, key)

        if key == "ifl_master_matches":
            matches = value if isinstance(value, list) else []
            incoming_ids: set[int] = set()
            changed_winners: dict[int, str | None] = {}
            for m in matches:
                try:
                    mid = int(m.get("id", 0))
                except Exception:
                    continue
                if mid <= 0:
                    continue
                incoming_ids.add(mid)
                winner_val = str(m.get("winner")) if m.get("winner") else None
                row = db.get(Match, mid)
                if row is None:
                    db.add(
                        Match(
                            id=mid,
                            match_date=str(m.get("date", "")),
                            team_a=str(m.get("teamA", "")),
                            team_a_abbr=str(m.get("teamAabbr", "")),
                            team_b=str(m.get("teamB", "")),
                            team_b_abbr=str(m.get("teamBabbr", "")),
                            venue=str(m.get("venue", "")),
                            winner=winner_val,
                            created_at=now,
                            updated_at=now,
                        )
                    )
                    if winner_val:
                        changed_winners[mid] = winner_val
                else:
                    old_winner = str(row.winner or "")
                    row.match_date = str(m.get("date", ""))
                    row.team_a = str(m.get("teamA", ""))
                    row.team_a_abbr = str(m.get("teamAabbr", ""))
                    row.team_b = str(m.get("teamB", ""))
                    row.team_b_abbr = str(m.get("teamBabbr", ""))
                    row.venue = str(m.get("venue", ""))
                    row.winner = winner_val
                    row.updated_at = now
                    if old_winner != str(winner_val or ""):
                        changed_winners[mid] = winner_val
            if incoming_ids:
                db.execute(delete(Match).where(Match.id.not_in(incoming_ids)))
            else:
                db.execute(delete(Match))
            db.commit()
            if changed_winners:
                for mid, winner_val in changed_winners.items():
                    _refresh_prediction_results(db, mid, winner_val)
                db.commit()
            return _compute_store_key_version(db, key)

        if key == "ifl_users":
            users = value if isinstance(value, dict) else {}

            def _safe_user(raw_user: Any) -> dict[str, Any]:
                return raw_user if isinstance(raw_user, dict) else {}

            def _safe_predictions(raw_preds: Any) -> dict[str, Any]:
                return raw_preds if isinstance(raw_preds, dict) else {}

            old_users_snapshot = _fetch_existing_users_snapshot(db)
            new_users_snapshot = {
                str(username): {
                    "teamName": str(_safe_user(user).get("teamName", "Untitled Team")),
                    "points": int(_safe_user(user).get("points", 0) or 0),
                    # Preserve existing predictions in snapshots to avoid false activity when ifl_users is saved.
                    "predictions": (old_users_snapshot.get(str(username), {}) or {}).get("predictions", {}),
                }
                for username, user in users.items()
            }
            valid_player_ids = {int(x) for x in db.scalars(select(Player.id)).all()}
            valid_match_ids = {int(x) for x in db.scalars(select(Match.id)).all()}
            match_dates = {
                int(r.id): str(r.match_date or "")
                for r in db.scalars(select(Match)).all()
            }
            existing_users = {u.username: u for u in db.scalars(select(User)).all()}
            user_id_map = {}

            for username, user in users.items():
                uname = str(username)
                u = _safe_user(user)
                row = existing_users.get(uname)
                if row is None:
                    row = User(
                        username=uname,
                        password=str(u.get("password", "")),
                        team_name=str(u.get("teamName", "Untitled Team")),
                        team_logo=str(u.get("teamLogo", "")),
                        points=int(u.get("points", 0) or 0),
                        squad_submitted=1 if bool(u.get("squadSubmitted", False)) else 0,
                        squad_validated=1 if bool(u.get("squadValidated", False)) else 0,
                        squad_frozen=1 if bool(u.get("squadFrozen", False)) else 0,
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(row)
                    db.flush()
                else:
                    if "password" in u and str(u.get("password", "")).strip():
                        row.password = str(u.get("password", ""))
                    row.team_name = str(u.get("teamName", "Untitled Team"))
                    row.team_logo = str(u.get("teamLogo", ""))
                    row.points = int(u.get("points", 0) or 0)
                    row.squad_submitted = 1 if bool(u.get("squadSubmitted", False)) else 0
                    row.squad_validated = 1 if bool(u.get("squadValidated", False)) else 0
                    row.squad_frozen = 1 if bool(u.get("squadFrozen", False)) else 0
                    row.updated_at = now
                user_id_map[uname] = int(row.id)

            for username, user in users.items():
                uid = user_id_map.get(username)
                if uid is None:
                    continue
                u = _safe_user(user)
                existing_predictions = {
                    int(r.match_id): (str(r.pick or "").strip(), r)
                    for r in db.scalars(select(Prediction).where(Prediction.user_id == uid)).all()
                }
                seen_players = set()
                existing_rows = {
                    int(r.player_id): r
                    for r in db.scalars(select(UserPlayer).where(UserPlayer.user_id == uid)).all()
                }
                incoming_ids = set()
                squad_frozen = bool(u.get("squadFrozen", False))
                player_frozen_map = u.get("playerFrozenAt") or {}
                for pid in u.get("players", []) or []:
                    try:
                        npid = int(pid)
                    except Exception:
                        continue
                    if npid in seen_players or npid not in valid_player_ids:
                        continue
                    seen_players.add(npid)
                    incoming_ids.add(npid)
                    submitted_at = None
                    frozen_at = None
                    raw = (u.get("playerSubmittedAt") or {}).get(npid) or (u.get("playerSubmittedAt") or {}).get(str(npid))
                    submitted_at = _parse_store_datetime(raw)
                    raw_frozen = player_frozen_map.get(npid) or player_frozen_map.get(str(npid))
                    frozen_at = _parse_store_datetime(raw_frozen)
                    if squad_frozen and frozen_at is None:
                        frozen_at = now
                    row = existing_rows.get(npid)
                    if row is None:
                        db.add(UserPlayer(user_id=uid, player_id=npid, created_at=now, submitted_at=submitted_at, frozen_at=frozen_at, is_deleted=0))
                    else:
                        row.is_deleted = 0
                        row.submitted_at = submitted_at
                        row.frozen_at = frozen_at
                # Mark missing players as deleted.
                for pid, row in existing_rows.items():
                    if pid not in incoming_ids:
                        row.is_deleted = 1
                # Predictions are no longer updated via ifl_users payloads.
                # Use /api/user/prediction for isolated per-match updates.

            db.commit()
            return _compute_store_key_version(db, key)

        if key == "ifl_match_stats":
            payload = value if isinstance(value, dict) else {}
            valid_match_ids = {int(x) for x in db.scalars(select(Match.id)).all()}
            valid_player_ids = {int(x) for x in db.scalars(select(Player.id)).all()}
            for match_id, stat in payload.items():
                mid = _to_non_negative_int(match_id, -1)
                if mid < 0 or mid not in valid_match_ids or not isinstance(stat, dict):
                    continue
                # Replace scoring for this match only (entity-level), not full-table.
                db.execute(delete(MatchPlayerStat).where(MatchPlayerStat.match_id == mid))
                db.execute(delete(MatchMeta).where(MatchMeta.match_id == mid))
                players = stat.get("players", {})
                if isinstance(players, dict):
                    for player_id, pstat in players.items():
                        pid = _to_non_negative_int(player_id, -1)
                        if pid < 0 or pid not in valid_player_ids or not isinstance(pstat, dict):
                            continue
                        db.add(
                            MatchPlayerStat(
                                match_id=mid,
                                player_id=pid,
                                runs=_to_non_negative_int(pstat.get("runs", 0), 0),
                                catches=_to_non_negative_int(pstat.get("catches", 0), 0),
                                runouts=_to_non_negative_int(pstat.get("runouts", 0), 0),
                                wickets=_to_non_negative_int(pstat.get("wickets", 0), 0),
                                created_at=now,
                                updated_at=now,
                            )
                        )
                motm = _to_non_negative_int(stat.get("motmPlayerId"), -1)
                if motm > 0 and motm in valid_player_ids:
                    db.add(MatchMeta(match_id=mid, motm_player_id=motm, updated_at=now))

            db.execute(delete(StoreKV).where(StoreKV.key == "ifl_match_stats"))
            db.commit()
            return _compute_store_key_version(db, key)

        if key == "ifl_swap_windows":
            windows = value if isinstance(value, list) else []
            incoming_ids: set[int] = set()
            for w in windows:
                try:
                    wid = int(w.get("id", 0))
                except Exception:
                    continue
                if wid <= 0:
                    continue
                incoming_ids.add(wid)
                row = db.get(SwapWindow, wid)
                if row is None:
                    db.add(
                        SwapWindow(
                            id=wid,
                            name=str(w.get("name", f"Window {wid}")),
                            start_at=str(w.get("start_at", "")),
                            lock_at=str(w.get("lock_at", "")),
                            end_at=str(w.get("end_at", "")),
                            effective_match_id=_to_non_negative_int(w.get("effective_match_id"), 0),
                            created_at=now,
                        )
                    )
                else:
                    row.name = str(w.get("name", row.name))
                    row.start_at = str(w.get("start_at", row.start_at))
                    row.lock_at = str(w.get("lock_at", row.lock_at))
                    row.end_at = str(w.get("end_at", row.end_at))
                    row.effective_match_id = _to_non_negative_int(w.get("effective_match_id", row.effective_match_id), 0)
            if incoming_ids:
                db.execute(delete(SwapWindow).where(SwapWindow.id.not_in(incoming_ids)))
            else:
                db.execute(delete(SwapWindow))
            db.commit()
            return _compute_store_key_version(db, key)

        if key in {"ifl_allowed_phones", "ifl_global_team_code", "ifl_playoffs_predictions"}:
            payload: Any = value
            if key == "ifl_allowed_phones":
                payload = [str(x) for x in value] if isinstance(value, list) else []
            if key == "ifl_global_team_code":
                payload = str(value or "").strip().upper() or "IFL2026"
            if key == "ifl_playoffs_predictions":
                payload = value if isinstance(value, dict) else {}
            db.merge(StoreKV(key=key, value_json=json.dumps(payload), updated_at=now))
            db.commit()
            return _compute_store_key_version(db, key)

        raise ValueError(f"Invalid key: {key}")


def _require_admin(authorization: str | None):
    auth = (authorization or "").strip()
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Admin authorization required")
    token = auth[7:].strip()
    if _verify_admin_token(token) is None:
        raise HTTPException(status_code=401, detail="Admin authorization required")


def _require_admin_username(authorization: str | None) -> str:
    auth = (authorization or "").strip()
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Admin authorization required")
    token = auth[7:].strip()
    payload = _verify_admin_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Admin authorization required")
    return str(payload.get("u") or ADMIN_USERNAME)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def api_no_store_middleware(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


@app.get("/api/health")
def api_health():
    return {"ok": True}


@app.get("/api/bootstrap")
def api_bootstrap(authorization: str | None = Header(default=None)):
    try:
        actor = _safe_bootstrap_actor(authorization)
        store = read_store() if actor else read_public_store()
        with SessionLocal() as db:
            versions = _read_store_versions(db)
        return {"store": store, "versions": versions}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": "Failed to bootstrap store", "details": str(exc)})


@app.get("/api/admin/session")
def api_admin_session(authorization: str | None = Header(default=None)):
    auth = (authorization or "").strip()
    if not auth.lower().startswith("bearer "):
        return JSONResponse(status_code=401, content={"ok": False, "error": "Unauthorized"})
    token = auth[7:].strip()
    if _verify_admin_token(token) is None:
        return JSONResponse(status_code=401, content={"ok": False, "error": "Unauthorized"})
    return {"ok": True, "username": ADMIN_USERNAME}


@app.post("/api/user/register")
def api_user_register(payload: dict[str, Any]):
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    team_name = str(payload.get("team_name") or "").strip()
    team_code = str(payload.get("team_code") or "").strip().upper()
    if not username or not password or not team_name or not team_code:
        raise HTTPException(status_code=400, detail="username, password, team_name and team_code are required")

    with SessionLocal() as db:
        allowed_phones: list[str] = []
        allowed_row = db.get(StoreKV, "ifl_allowed_phones")
        if allowed_row is not None:
            try:
                parsed = json.loads(allowed_row.value_json)
                if isinstance(parsed, list):
                    allowed_phones = [str(x).strip() for x in parsed]
            except Exception:
                allowed_phones = []

        team_code_row = db.get(StoreKV, "ifl_global_team_code")
        required_code = "IFL2026"
        if team_code_row is not None:
            try:
                parsed = json.loads(team_code_row.value_json)
                if isinstance(parsed, str) and parsed.strip():
                    required_code = parsed.strip().upper()
            except Exception:
                required_code = "IFL2026"

        if team_code != required_code:
            raise HTTPException(status_code=400, detail="Invalid team code")
        if allowed_phones and username not in allowed_phones:
            raise HTTPException(status_code=403, detail="Phone number is not allowed by admin")
        if db.scalar(select(User).where(User.username == username)) is not None:
            raise HTTPException(status_code=409, detail="User already exists")

        now = datetime.utcnow()
        db.add(
            User(
                username=username,
                password=_hash_user_password(password),
                team_name=team_name,
                team_logo="",
                points=0,
                squad_submitted=0,
                squad_validated=0,
                squad_frozen=0,
                created_at=now,
                updated_at=now,
            )
        )
        db.commit()

    token = _sign_user_token({"u": username, "iat": int(time.time()), "exp": int(time.time()) + USER_TOKEN_TTL_SEC})
    user_payload = _safe_public_user_payload(username) or {"teamName": team_name, "teamLogo": "", "players": [], "points": 0, "predictions": {}}
    return {"ok": True, "username": username, "token": token, "expiresInSec": USER_TOKEN_TTL_SEC, "user": user_payload}


@app.post("/api/user/login")
def api_user_login(payload: dict[str, Any]):
    username = str(payload.get("username") or "").strip()
    password = str(payload.get("password") or "")
    team_code = str(payload.get("team_code") or "").strip().upper()
    if not username or not password or not team_code:
        raise HTTPException(status_code=400, detail="username, password and team_code are required")

    with SessionLocal() as db:
        team_code_row = db.get(StoreKV, "ifl_global_team_code")
        required_code = "IFL2026"
        if team_code_row is not None:
            try:
                parsed = json.loads(team_code_row.value_json)
                if isinstance(parsed, str) and parsed.strip():
                    required_code = parsed.strip().upper()
            except Exception:
                required_code = "IFL2026"
        if team_code != required_code:
            raise HTTPException(status_code=400, detail="Invalid team code")

        row = db.scalar(select(User).where(User.username == username))
        if row is None:
            raise HTTPException(status_code=404, detail="User not found")
        ok, should_upgrade = _verify_user_password(str(row.password or ""), password)
        if not ok:
            raise HTTPException(status_code=401, detail="Wrong password")
        if should_upgrade:
            row.password = _hash_user_password(password)
            row.updated_at = datetime.utcnow()
            db.commit()

    token = _sign_user_token({"u": username, "iat": int(time.time()), "exp": int(time.time()) + USER_TOKEN_TTL_SEC})
    user_payload = _safe_public_user_payload(username)
    if user_payload is None:
        raise HTTPException(status_code=500, detail="Failed to load user state")
    return {"ok": True, "username": username, "token": token, "expiresInSec": USER_TOKEN_TTL_SEC, "user": user_payload}


@app.post("/api/user/update")
def api_user_update(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    username = _require_user(authorization)
    patch = payload.get("patch") if isinstance(payload.get("patch"), dict) else {}
    allowed_patch_keys = {"teamName", "teamLogo", "squadSubmitted", "players", "playerSubmittedAt"}
    unknown_patch_keys = sorted(set(patch.keys()) - allowed_patch_keys)
    if unknown_patch_keys:
        raise HTTPException(status_code=400, detail=f"Unsupported update fields: {', '.join(unknown_patch_keys)}")

    with SessionLocal() as db:
        row = db.scalar(select(User).where(User.username == username))
        if row is None:
            raise HTTPException(status_code=404, detail="user not found")
        now = datetime.utcnow()
        roster_update_requested = any(k in patch for k in ("players", "playerSubmittedAt", "squadSubmitted"))

        if "teamName" in patch:
            team_name = str(patch.get("teamName") or "").strip()
            if not team_name:
                raise HTTPException(status_code=400, detail="Team name cannot be empty")
            row.team_name = team_name
        if "teamLogo" in patch:
            row.team_logo = str(patch.get("teamLogo") or "")
        if roster_update_requested and bool(row.squad_frozen):
            raise HTTPException(status_code=400, detail="Team is frozen and cannot be changed")

        existing_rows = db.scalars(select(UserPlayer).where(UserPlayer.user_id == int(row.id))).all()
        existing_by_pid = {int(r.player_id): r for r in existing_rows}

        normalized_players: list[int] | None = None
        if "players" in patch:
            next_players = patch.get("players") if isinstance(patch.get("players"), list) else []
            valid_player_ids = {int(x) for x in db.scalars(select(Player.id)).all()}
            normalized_players = []
            seen: set[int] = set()
            for raw_pid in next_players:
                pid = _to_non_negative_int(raw_pid, 0)
                if pid <= 0 or pid not in valid_player_ids or pid in seen:
                    continue
                normalized_players.append(pid)
                seen.add(pid)
            if len(normalized_players) > 20:
                raise HTTPException(status_code=400, detail="Team cannot have more than 20 players")

        effective_players = normalized_players if normalized_players is not None else [
            int(pid) for pid, upr in existing_by_pid.items() if int(upr.is_deleted or 0) == 0
        ]
        should_submit = bool(patch.get("squadSubmitted")) if "squadSubmitted" in patch else bool(row.squad_submitted)

        if should_submit:
            if len(effective_players) != 20:
                raise HTTPException(status_code=400, detail="Select exactly 20 players before submitting")
            validation_players = db.scalars(select(Player).where(Player.id.in_(effective_players))).all()
            bowlers = sum(1 for p in validation_players if str(p.role).upper() == "BOWL")
            intl = sum(1 for p in validation_players if str(p.country or "").strip().lower() != "india")
            if bowlers < 6:
                raise HTTPException(status_code=400, detail="Minimum 6 bowlers required before submitting")
            if intl > 8:
                raise HTTPException(status_code=400, detail="Maximum 8 international players allowed")

        if "squadSubmitted" in patch:
            row.squad_submitted = 1 if bool(patch.get("squadSubmitted")) else 0

        if normalized_players is not None:
            submitted_map = patch.get("playerSubmittedAt") if isinstance(patch.get("playerSubmittedAt"), dict) else {}
            keep_ids = set(normalized_players)
            for pid, upr in existing_by_pid.items():
                if pid in keep_ids:
                    upr.is_deleted = 0
                    submitted_at = str(submitted_map.get(str(pid), submitted_map.get(pid, "")) or "").strip()
                    if submitted_at:
                        upr.submitted_at = _parse_store_datetime(submitted_at)
                else:
                    upr.is_deleted = 1
            for pid in normalized_players:
                if pid in existing_by_pid:
                    continue
                submitted_at = str(submitted_map.get(str(pid), submitted_map.get(pid, "")) or "").strip()
                db.add(
                    UserPlayer(
                        user_id=int(row.id),
                        player_id=pid,
                        created_at=now,
                        submitted_at=_parse_store_datetime(submitted_at) if submitted_at else None,
                        is_deleted=0,
                        frozen_at=None,
                    )
                )
        row.updated_at = now
        db.commit()

    user_payload = _safe_public_user_payload(username)
    if user_payload is None:
        raise HTTPException(status_code=500, detail="Failed to load user state")
    return {"ok": True, "username": username, "user": user_payload}


@app.post("/api/user/swaps")
def api_user_swaps(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    username = _require_user(authorization)
    pairs = payload.get("pairs")
    if not isinstance(pairs, list) or not pairs:
        raise HTTPException(status_code=400, detail="pairs must be a non-empty list")
    window_id = _to_non_negative_int(payload.get("window_id"), 0)
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            raise HTTPException(status_code=404, detail="user not found")
        if window_id <= 0:
            raise HTTPException(status_code=400, detail="window_id is required")
        window = db.get(SwapWindow, window_id)
        if window is None:
            raise HTTPException(status_code=404, detail="swap window not found")
        win_start = _parse_store_datetime(window.start_at)
        win_lock = _parse_store_datetime(window.lock_at)
        now_ist = datetime.now(IST).replace(tzinfo=None)
        if not win_start or not win_lock or not (win_start <= now_ist < win_lock):
            raise HTTPException(status_code=400, detail="swap window is locked")

        effective_match_id = _to_non_negative_int(window.effective_match_id, 0)
        if effective_match_id <= 0:
            now_ts = _store_match_ts(datetime.now(IST))
            next_match = db.scalar(
                select(Match)
                .where(Match.match_date >= now_ts)
                .order_by(Match.match_date, Match.id)
            )
            if next_match is None:
                last_match = db.scalar(select(Match).order_by(Match.match_date.desc(), Match.id.desc()))
                effective_match_id = int(last_match.id) if last_match is not None else 0
            else:
                effective_match_id = int(next_match.id)

        out_ids: list[int] = []
        in_ids: list[int] = []
        for pair in pairs:
            if not isinstance(pair, dict):
                continue
            out_pid = _to_non_negative_int(pair.get("out_player_id"), 0)
            in_pid = _to_non_negative_int(pair.get("in_player_id"), 0)
            if out_pid > 0 and in_pid > 0:
                out_ids.append(out_pid)
                in_ids.append(in_pid)
        if not out_ids or not in_ids or len(out_ids) != len(in_ids):
            raise HTTPException(status_code=400, detail="invalid swap pairs")

        player_rows = db.scalars(select(Player).where(Player.id.in_(set(out_ids + in_ids)))).all()
        player_by_id = {int(p.id): p for p in player_rows}
        if any(pid not in player_by_id for pid in out_ids + in_ids):
            raise HTTPException(status_code=400, detail="invalid player in swaps")

        # Validate against the latest effective squad before this window, not just the original base squad.
        current_squad_ids = [
            int(pid)
            for (pid,) in db.execute(
                select(UserPlayer.player_id)
                .where(UserPlayer.user_id == int(user.id), UserPlayer.is_deleted == 0)
            ).all()
        ]
        prior_swap_rows: list[dict[str, Any]] = []
        for row in db.scalars(
            select(UserSwap)
            .where(
                UserSwap.user_id == int(user.id),
                UserSwap.is_deleted == 0,
                UserSwap.is_frozen == 1,
                UserSwap.is_validated == 1,
            )
            .order_by(UserSwap.window_id, UserSwap.id)
        ).all():
            if int(row.window_id) == int(window_id):
                continue
            prior_window = db.get(SwapWindow, int(row.window_id))
            prior_eff = _to_non_negative_int(prior_window.effective_match_id if prior_window is not None else 0, 0)
            if prior_eff <= 0:
                continue
            if prior_eff > effective_match_id or (prior_eff == effective_match_id and int(row.window_id) >= int(window_id)):
                continue
            current = prior_swap_rows[-1] if prior_swap_rows and int(prior_swap_rows[-1]["window_id"]) == int(row.window_id) else None
            if current is None:
                current = {"window_id": int(row.window_id), "eff": prior_eff, "out": [], "in": []}
                prior_swap_rows.append(current)
            current["out"].append(int(row.out_player_id))
            current["in"].append(int(row.in_player_id))
        prior_swap_rows.sort(key=lambda item: (int(item["eff"]), int(item["window_id"])))
        current_set = set(int(pid) for pid in current_squad_ids)
        for row in prior_swap_rows:
            for pid in row.get("out", []):
                current_set.discard(int(pid))
            for pid in row.get("in", []):
                current_set.add(int(pid))
        out_set = set(out_ids)
        in_set = set(in_ids)
        if not out_set.issubset(current_set):
            raise HTTPException(status_code=400, detail="swap-out players must be from your squad")
        if in_set & (current_set - out_set):
            raise HTTPException(status_code=400, detail="swap-in players must not already be in your squad")
        next_set = (current_set - out_set) | in_set
        if len(next_set) != 20:
            raise HTTPException(status_code=400, detail="team must have exactly 20 players after swap")
        next_players = db.scalars(select(Player).where(Player.id.in_(next_set))).all()
        bowlers = sum(1 for p in next_players if str(p.role).upper() == "BOWL")
        intl = sum(1 for p in next_players if str(p.country or "").strip().lower() != "india")
        if bowlers < 6:
            raise HTTPException(status_code=400, detail="team must have at least 6 bowlers after swap")
        if intl > 8:
            raise HTTPException(status_code=400, detail="team must have at most 8 international players after swap")

        db.query(UserSwap).filter(
            UserSwap.user_id == int(user.id),
            UserSwap.window_id == window_id,
            UserSwap.is_deleted == 0,
            UserSwap.is_frozen == 0,
        ).update({UserSwap.is_deleted: 1}, synchronize_session=False)

        created = 0
        now = datetime.utcnow()
        for pair in pairs:
            if not isinstance(pair, dict):
                continue
            out_pid = _to_non_negative_int(pair.get("out_player_id"), 0)
            in_pid = _to_non_negative_int(pair.get("in_player_id"), 0)
            if out_pid <= 0 or in_pid <= 0:
                continue
            db.add(
                UserSwap(
                    user_id=int(user.id),
                    window_id=window_id,
                    out_player_id=out_pid,
                    in_player_id=in_pid,
                    created_at=now,
                    is_frozen=0,
                    is_validated=1,
                    validated_at=now,
                    validated_by="auto",
                )
            )
            created += 1
        if created == 0:
            raise HTTPException(status_code=400, detail="no valid swap pairs provided")
        db.commit()

    return {"ok": True, "created": created, "effective_match_id": effective_match_id}


@app.post("/api/user/prediction")
def api_user_prediction(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    username = _require_user(authorization)
    match_id = _to_non_negative_int(payload.get("match_id"), 0)
    pick = str(payload.get("pick") or "").strip().upper()
    if match_id <= 0:
        raise HTTPException(status_code=400, detail="match_id is required")
    if not pick:
        raise HTTPException(status_code=400, detail="pick is required")

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            raise HTTPException(status_code=404, detail="user not found")
        match = db.get(Match, match_id)
        if match is None:
            raise HTTPException(status_code=404, detail="match not found")
        if pick not in {str(match.team_a_abbr).upper(), str(match.team_b_abbr).upper()}:
            raise HTTPException(status_code=400, detail="pick must be one of the match teams")
        now_ts = _league_ts()
        if _prediction_locked(str(match.match_date or ""), now_ts):
            raise HTTPException(
                status_code=400,
                detail=f"Prediction for Match {match_id} is locked after {_prediction_lock_ts(str(match.match_date or ''))} IST",
            )

        now = datetime.utcnow()
        row = db.scalar(select(Prediction).where(Prediction.user_id == int(user.id), Prediction.match_id == match_id))
        if row is None:
            db.add(
                Prediction(
                    user_id=int(user.id),
                    match_id=match_id,
                    pick=pick,
                    is_correct=None,
                    points_awarded=0,
                    created_at=now,
                    updated_at=now,
                )
            )
        else:
            row.pick = pick
            row.is_correct = None
            row.points_awarded = 0
            row.updated_at = now
        db.commit()

        refreshed = db.scalar(select(Prediction).where(Prediction.user_id == int(user.id), Prediction.match_id == match_id))

    return {"ok": True, "match_id": match_id, "pick": pick, "updated_at": _iso_stamp(refreshed.updated_at if refreshed else now)}


@app.post("/api/user/ifl-guru")
def api_user_ifl_guru(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    _require_user(authorization)
    raise HTTPException(status_code=410, detail="IFL GURU is not available in the SQLite non-AI edition.")


@app.post("/api/admin/scoring/draft-json")
def api_admin_scoring_draft_json(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    _require_admin(authorization)
    raise HTTPException(status_code=410, detail="AI scoring draft is not available in the SQLite non-AI edition. Use manual import or manual scoring entry.")


@app.post("/api/user/login-audit")
def api_user_login_audit(payload: dict[str, Any], request: Request, authorization: str | None = Header(default=None)):
    username = _require_user(authorization)

    login_meta = payload.get("login_meta") if isinstance(payload.get("login_meta"), dict) else {}
    forwarded_for = str(request.headers.get("x-forwarded-for") or "").strip()
    ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else "")

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            raise HTTPException(status_code=404, detail="user not found")

        db.add(
            UserLoginAudit(
                user_id=int(user.id),
                username=username,
                device_type=str(login_meta.get("device_type") or "").strip()[:20] or None,
                browser=str(login_meta.get("browser") or "").strip()[:60] or None,
                os=str(login_meta.get("os") or "").strip()[:60] or None,
                platform=str(login_meta.get("platform") or "").strip()[:120] or None,
                language=str(login_meta.get("language") or "").strip()[:20] or None,
                screen_width=_to_non_negative_int(login_meta.get("screen_width"), 0) or None,
                screen_height=_to_non_negative_int(login_meta.get("screen_height"), 0) or None,
                user_agent=str(login_meta.get("user_agent") or "").strip()[:1000] or None,
                ip_address=ip_address[:64] or None,
            )
        )
        db.commit()
    return {"ok": True}


@app.post("/api/user/home-reaction-analytics")
def api_user_home_reaction_analytics(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    username = _require_user(authorization)
    events = payload.get("events") if isinstance(payload.get("events"), list) else []
    session_id = str(payload.get("session_id") or "").strip()[:80] or None
    if not events:
        return {"ok": True, "written": 0}

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            raise HTTPException(status_code=404, detail="user not found")

        written = 0
        for raw in events[:500]:
            if not isinstance(raw, dict):
                continue
            reaction_id = str(raw.get("reaction_id") or "").strip()[:40]
            if not reaction_id:
                continue
            clicked_at_raw = str(raw.get("clicked_at") or "").strip()
            clicked_at = None
            if clicked_at_raw:
                try:
                    clicked_at = datetime.fromisoformat(clicked_at_raw.replace("Z", "+00:00"))
                    if clicked_at.tzinfo is not None:
                        clicked_at = clicked_at.astimezone(timezone.utc).replace(tzinfo=None)
                except Exception:
                    clicked_at = None

            db.add(
                UserHomeReactionAudit(
                    user_id=int(user.id),
                    username=username,
                    session_id=session_id,
                    reaction_id=reaction_id,
                    reaction_text=str(raw.get("reaction_text") or "").strip()[:2000] or None,
                    emoji=str(raw.get("emoji") or "").strip()[:16] or None,
                    favorite_team=str(raw.get("favorite_team") or "").strip().upper()[:10] or None,
                    rival_team=str(raw.get("rival_team") or "").strip().upper()[:10] or None,
                    clicked_at=clicked_at,
                )
            )
            written += 1
        db.commit()

    return {"ok": True, "written": written}


@app.post("/api/user/swaps/reset")
def api_user_swaps_reset(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    username = _require_user(authorization)
    window_id = _to_non_negative_int(payload.get("window_id"), 0)
    if window_id <= 0:
        raise HTTPException(status_code=400, detail="window_id is required")

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            raise HTTPException(status_code=404, detail="user not found")
        updated = (
            db.query(UserSwap)
            .filter(UserSwap.user_id == int(user.id), UserSwap.window_id == window_id, UserSwap.is_deleted == 0)
            .update({UserSwap.is_deleted: 1}, synchronize_session=False)
        )
        db.commit()
    return {"ok": True, "deleted": int(updated or 0)}


@app.post("/api/user/swaps/list")
def api_user_swaps_list(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    username = _require_user(authorization)
    window_id = _to_non_negative_int(payload.get("window_id"), 0)
    if window_id <= 0:
        raise HTTPException(status_code=400, detail="window_id is required")
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            raise HTTPException(status_code=404, detail="user not found")
        window = db.get(SwapWindow, window_id)
        rows = [
            {
                "id": int(s.id),
                "out_player_id": int(s.out_player_id),
                "in_player_id": int(s.in_player_id),
                "effective_match_id": _to_non_negative_int(window.effective_match_id if window else 0, 0),
                "created_at": _store_match_ts(s.created_at) if s.created_at else "",
                "is_validated": int(s.is_validated or 0),
                "is_frozen": int(s.is_frozen or 0),
            }
            for s in db.scalars(
                select(UserSwap)
                .where(UserSwap.user_id == int(user.id), UserSwap.window_id == window_id, UserSwap.is_deleted == 0)
                .order_by(UserSwap.created_at, UserSwap.id)
            ).all()
        ]
    return {"rows": rows}


@app.post("/api/user/swaps/freeze")
def api_user_swaps_freeze(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    username = _require_user(authorization)
    window_id = _to_non_negative_int(payload.get("window_id"), 0)
    if window_id <= 0:
        raise HTTPException(status_code=400, detail="window_id is required")
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            raise HTTPException(status_code=404, detail="user not found")
        now = datetime.utcnow()
        updated = (
            db.query(UserSwap)
            .filter(UserSwap.user_id == int(user.id), UserSwap.window_id == window_id, UserSwap.is_deleted == 0)
            .update({UserSwap.is_frozen: 1, UserSwap.frozen_at: now}, synchronize_session=False)
        )
        db.commit()
    return {"ok": True, "frozen": int(updated or 0)}


@app.get("/api/admin/swaps")
def api_admin_swaps(authorization: str | None = Header(default=None)):
    _require_admin(authorization)
    with SessionLocal() as db:
        users = {int(u.id): str(u.username) for u in db.scalars(select(User)).all()}
        windows = {
            int(w.id): {
                "id": int(w.id),
                "name": w.name,
                "start_at": w.start_at,
                "lock_at": w.lock_at,
                "end_at": w.end_at,
                "effective_match_id": _to_non_negative_int(w.effective_match_id, 0),
            }
            for w in db.scalars(select(SwapWindow)).all()
        }
        rows = []
        for s in db.scalars(
            select(UserSwap)
            .where(UserSwap.is_deleted == 0)
            .order_by(UserSwap.created_at.desc(), UserSwap.id.desc())
        ).all():
            rows.append(
                {
                    "id": int(s.id),
                    "user_id": int(s.user_id),
                    "username": users.get(int(s.user_id), ""),
                    "window": windows.get(int(s.window_id), {"id": int(s.window_id)}),
                    "out_player_id": int(s.out_player_id),
                    "in_player_id": int(s.in_player_id),
                    "effective_match_id": windows.get(int(s.window_id), {}).get("effective_match_id", 0),
                    "created_at": _store_match_ts(s.created_at) if s.created_at else "",
                    "is_validated": int(s.is_validated or 0),
                    "is_frozen": int(s.is_frozen or 0),
                    "frozen_at": _store_match_ts(s.frozen_at) if s.frozen_at else "",
                    "validated_at": _store_match_ts(s.validated_at) if s.validated_at else "",
                    "validated_by": s.validated_by or "",
                }
            )
    return {"rows": rows}


@app.get("/api/admin/login-audit")
def api_admin_login_audit(limit: int = 100, authorization: str | None = Header(default=None)):
    _require_admin(authorization)
    n = max(1, min(int(limit), 500))
    with SessionLocal() as db:
        rows = db.scalars(
            select(UserLoginAudit)
            .order_by(UserLoginAudit.created_at.desc(), UserLoginAudit.id.desc())
            .limit(n)
        ).all()

        summary_rows = db.execute(
            select(
                UserLoginAudit.device_type,
                func.count().label("count"),
            )
            .group_by(UserLoginAudit.device_type)
        ).all()

    summary = {
        str(device_type or "unknown"): int(count or 0)
        for device_type, count in summary_rows
    }
    return {
        "summary": summary,
        "rows": [
            {
                "id": int(r.id),
                "user_id": int(r.user_id),
                "username": r.username,
                "device_type": r.device_type or "",
                "browser": r.browser or "",
                "os": r.os or "",
                "platform": r.platform or "",
                "language": r.language or "",
                "screen_width": r.screen_width,
                "screen_height": r.screen_height,
                "user_agent": r.user_agent or "",
                "ip_address": r.ip_address or "",
                "created_at": _store_match_ts(r.created_at) if r.created_at else "",
            }
            for r in rows
        ],
    }


@app.post("/api/admin/recompute-points")
def api_admin_recompute_points(authorization: str | None = Header(default=None)):
    _require_admin(authorization)
    with SessionLocal() as db:
        result = _recompute_all_user_points(db)
    return result


@app.post("/api/admin/users/points")
def api_admin_update_user_points(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    _require_admin(authorization)
    points_map = payload.get("points")
    if not isinstance(points_map, dict):
        raise HTTPException(status_code=400, detail="points must be a map of username to points")
    updated = 0
    now = datetime.utcnow()
    with SessionLocal() as db:
        for username, pts in points_map.items():
            uname = str(username)
            row = db.scalar(select(User).where(User.username == uname))
            if row is None:
                continue
            row.points = _to_non_negative_int(pts, 0)
            row.updated_at = now
            updated += 1
        db.commit()
    return {"ok": True, "updated": updated}


@app.post("/api/admin/swaps/validate")
def api_admin_swaps_validate(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    admin_user = _require_admin_username(authorization)
    username = str(payload.get("username") or "").strip()
    window_id = _to_non_negative_int(payload.get("window_id"), 0)
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    if window_id <= 0:
        raise HTTPException(status_code=400, detail="window_id is required")
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            raise HTTPException(status_code=404, detail="user not found")
        now = datetime.utcnow()
        updated = (
            db.query(UserSwap)
            .filter(UserSwap.user_id == int(user.id), UserSwap.window_id == window_id, UserSwap.is_deleted == 0)
            .update(
                {
                    UserSwap.is_validated: 1,
                    UserSwap.validated_at: now,
                    UserSwap.validated_by: admin_user,
                },
                synchronize_session=False,
            )
        )
        db.commit()
    return {"ok": True, "updated": int(updated or 0)}


@app.post("/api/admin/swaps/reject")
def api_admin_swaps_reject(payload: dict[str, Any], authorization: str | None = Header(default=None)):
    _require_admin(authorization)
    username = str(payload.get("username") or "").strip()
    window_id = _to_non_negative_int(payload.get("window_id"), 0)
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    if window_id <= 0:
        raise HTTPException(status_code=400, detail="window_id is required")
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        if user is None:
            raise HTTPException(status_code=404, detail="user not found")
        updated = (
            db.query(UserSwap)
            .filter(UserSwap.user_id == int(user.id), UserSwap.window_id == window_id, UserSwap.is_deleted == 0)
            .update({UserSwap.is_deleted: 1}, synchronize_session=False)
        )
        db.commit()
    return {"ok": True, "deleted": int(updated or 0)}


@app.get("/api/admin/exports/playoffs-predictions")
def api_admin_export_playoffs_predictions(authorization: str | None = Header(default=None)):
    _require_admin(authorization)
    with SessionLocal() as db:
        users = {str(u.username): str(u.team_name or "") for u in db.scalars(select(User)).all()}
        row = db.get(StoreKV, "ifl_playoffs_predictions")
        preds = {}
        if row is not None:
            try:
                parsed = json.loads(row.value_json)
                if isinstance(parsed, dict):
                    preds = {str(k): v for k, v in parsed.items()}
            except Exception:
                preds = {}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["username", "team_name", "picks"])
    for uname in sorted(users.keys()):
        picks = preds.get(uname) or []
        if isinstance(picks, list):
            picks_str = ", ".join(str(x) for x in picks)
        else:
            picks_str = str(picks)
        writer.writerow([uname, users.get(uname, ""), picks_str])

    data = output.getvalue().encode("utf-8")
    headers = {
        "Content-Disposition": f'attachment; filename="playoffs-predictions.csv"',
        "Content-Type": "text/csv; charset=utf-8",
    }
    return Response(content=data, headers=headers)


@app.get("/api/admin/exports/leaderboard/daily")
def api_admin_export_leaderboard_daily(
    date: str | None = None,
    fmt: str = "csv",
    authorization: str | None = Header(default=None),
):
    _require_admin(authorization)
    paths = _write_leaderboard_export(date)
    fmt_norm = str(fmt or "csv").strip().lower()
    if fmt_norm not in {"csv", "json"}:
        raise HTTPException(status_code=400, detail="fmt must be csv or json")
    target = Path(paths[fmt_norm])
    media_type = "text/csv; charset=utf-8" if fmt_norm == "csv" else "application/json"
    return FileResponse(target, media_type=media_type, filename=target.name)


@app.get("/api/leaderboard/prev-ranks")
def api_leaderboard_prev_ranks(date: str | None = None):
    stamp = _parse_export_date(date)
    with SessionLocal() as db:
        ranks = _prev_rank_map(db, stamp)
    return {"date": stamp, "prev_date": (datetime.strptime(stamp, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d"), "ranks": ranks}


@app.post("/api/admin/login")
def api_admin_login(payload: dict[str, Any], request: Request):
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    client_ip = (request.client.host if request.client else "unknown")
    rate_key = f"{client_ip}:{username or '-'}"

    allowed, retry_after = _check_admin_login_rate_limit(rate_key)
    if not allowed:
        return JSONResponse(
            status_code=429,
            headers={"Retry-After": str(retry_after)},
            content={"ok": False, "error": "Too many attempts. Try later."},
        )

    user_ok = hmac.compare_digest(username, ADMIN_USERNAME)
    pass_ok = hmac.compare_digest(password, ADMIN_PASSWORD)
    if not (user_ok and pass_ok):
        _record_admin_login_failure(rate_key)
        return JSONResponse(status_code=401, content={"ok": False, "error": "Invalid credentials"})

    now_ts = int(time.time())
    token = _sign_admin_token({
        "u": ADMIN_USERNAME,
        "iat": now_ts,
        "exp": now_ts + ADMIN_TOKEN_TTL_SEC,
        "jti": secrets.token_hex(8),
    })
    return {"ok": True, "token": token, "username": ADMIN_USERNAME, "expiresInSec": ADMIN_TOKEN_TTL_SEC}


@app.delete("/api/admin/users/{username}")
def api_admin_delete_user(username: str, authorization: str | None = Header(default=None)):
    try:
        _require_admin(authorization)
    except HTTPException:
        return JSONResponse(status_code=401, content={"error": "Admin authorization required"})

    uname = str(username or "").strip()
    if not uname:
        return JSONResponse(status_code=400, content={"error": "Username is required"})

    try:
        with SessionLocal() as db:
            row = db.scalars(select(User).where(User.username == uname).limit(1)).first()
            if row is None:
                return {"ok": True, "deleted": False}
            db.delete(row)
            db.commit()
        return {"ok": True, "deleted": True}
    except Exception as exc:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Failed to delete user", "details": str(exc)})


@app.get("/api/store/{key}")
def api_get_store(key: str):
    if key not in VALID_KEYS:
        return JSONResponse(status_code=400, content={"error": f"Invalid key: {key}"})
    try:
        store = read_store()
        with SessionLocal() as db:
            version = _compute_store_key_version(db, key)
        return {"value": store.get(key), "version": version}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": "Failed to load store value", "details": str(exc)})


@app.put("/api/store/{key}")
def api_put_store(
    key: str,
    payload: dict[str, Any],
    authorization: str | None = Header(default=None),
    x_store_version: str | None = Header(default=None, alias="X-Store-Version"),
):
    if key not in VALID_KEYS:
        return JSONResponse(status_code=400, content={"error": f"Invalid key: {key}"})

    if key in ADMIN_ONLY_KEYS:
        try:
            _require_admin(authorization)
        except HTTPException:
            return JSONResponse(status_code=401, content={"error": "Admin authorization required"})

    try:
        new_version = write_key(key, payload.get("value"), expected_version=(x_store_version or "").strip() or None)
        return {"ok": True, "version": new_version}
    except StaleWriteError as exc:
        current_store = read_store()
        return JSONResponse(
            status_code=409,
            content={
                "error": "Stale data. Reload latest state and retry.",
                "currentVersion": exc.current_version,
                "currentValue": current_store.get(key),
            },
        )
    except LockedPredictionEditError as exc:
        return JSONResponse(status_code=400, content={"error": exc.details})
    except Exception as exc:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Failed to persist store value", "details": str(exc)})


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if not CLIENT_DIST.exists():
        return JSONResponse(status_code=404, content={"error": "Not found"})

    rel = full_path.lstrip("/") or "index.html"
    target = (CLIENT_DIST / rel).resolve()
    dist_root = CLIENT_DIST.resolve()

    if str(target).startswith(str(dist_root)) and target.is_file():
        return FileResponse(target)

    index_file = CLIENT_DIST / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)

    return JSONResponse(status_code=404, content={"error": "Not found"})


def run():
    init_db()
    print(f"IFL FastAPI server running on http://localhost:{PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")


if __name__ == "__main__":
    run()
