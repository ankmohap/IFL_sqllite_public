#!/usr/bin/env python3
import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path

try:
    import psycopg
    from psycopg.rows import dict_row
except Exception:
    psycopg = None
    dict_row = None


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE = ROOT / "server" / "data" / "ifl.sqlite3"
DEFAULT_TEAM_CODE = "IFL2026"


def create_sqlite_schema(conn: sqlite3.Connection):
    conn.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          team_name TEXT NOT NULL,
          team_logo TEXT NOT NULL DEFAULT '',
          points INTEGER NOT NULL DEFAULT 0,
          squad_submitted INTEGER NOT NULL DEFAULT 0,
          squad_validated INTEGER NOT NULL DEFAULT 0,
          squad_frozen INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS players (
          id INTEGER PRIMARY KEY,
          team TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          country TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS matches (
          id INTEGER PRIMARY KEY,
          match_date TEXT NOT NULL,
          team_a TEXT NOT NULL,
          team_a_abbr TEXT NOT NULL,
          team_b TEXT NOT NULL,
          team_b_abbr TEXT NOT NULL,
          venue TEXT NOT NULL,
          winner TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_players (
          user_id INTEGER NOT NULL,
          player_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          submitted_at TEXT,
          frozen_at TEXT,
          is_deleted INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, player_id)
        );

        CREATE TABLE IF NOT EXISTS swap_windows (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          start_at TEXT NOT NULL,
          lock_at TEXT NOT NULL,
          end_at TEXT NOT NULL,
          effective_match_id INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_swaps (
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          window_id INTEGER NOT NULL,
          out_player_id INTEGER NOT NULL,
          in_player_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          is_frozen INTEGER NOT NULL DEFAULT 0,
          frozen_at TEXT,
          is_validated INTEGER NOT NULL DEFAULT 0,
          validated_at TEXT,
          validated_by TEXT,
          is_deleted INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS predictions (
          user_id INTEGER NOT NULL,
          match_id INTEGER NOT NULL,
          pick TEXT NOT NULL,
          is_correct INTEGER,
          points_awarded INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, match_id)
        );

        CREATE TABLE IF NOT EXISTS match_player_stats (
          match_id INTEGER NOT NULL,
          player_id INTEGER NOT NULL,
          runs INTEGER NOT NULL DEFAULT 0,
          catches INTEGER NOT NULL DEFAULT 0,
          runouts INTEGER NOT NULL DEFAULT 0,
          wickets INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (match_id, player_id)
        );

        CREATE TABLE IF NOT EXISTS match_meta (
          match_id INTEGER PRIMARY KEY,
          motm_player_id INTEGER,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS store_kv (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
          date TEXT PRIMARY KEY,
          rows_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activity_feed (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          username TEXT,
          activity_type TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_login_audit (
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          username TEXT NOT NULL,
          device_type TEXT,
          browser TEXT,
          os TEXT,
          platform TEXT,
          language TEXT,
          screen_width INTEGER,
          screen_height INTEGER,
          user_agent TEXT,
          ip_address TEXT,
          created_at TEXT NOT NULL
        );
        """
    )


def truncate_sqlite(conn: sqlite3.Connection):
    conn.executescript(
        """
        DELETE FROM predictions;
        DELETE FROM user_players;
        DELETE FROM swap_windows;
        DELETE FROM user_swaps;
        DELETE FROM match_player_stats;
        DELETE FROM match_meta;
        DELETE FROM matches;
        DELETE FROM players;
        DELETE FROM users;
        DELETE FROM store_kv;
        DELETE FROM leaderboard_snapshots;
        DELETE FROM activity_feed;
        DELETE FROM user_login_audit;
        """
    )


def _as_text(v):
    return "" if v is None else str(v)


def load_postgres(pg_url: str):
    with psycopg.connect(pg_url, row_factory=dict_row) as conn:
        users = list(
            conn.execute(
                """
                SELECT id, username, password, team_name, team_logo, points,
                       squad_submitted, squad_validated, squad_frozen,
                       created_at, updated_at
                FROM users
                ORDER BY id
                """
            )
        )
        players = list(
            conn.execute(
                """
                SELECT id, team, name, role, country, created_at, updated_at
                FROM players
                ORDER BY id
                """
            )
        )
        matches = list(
            conn.execute(
                """
                SELECT id, match_date, team_a, team_a_abbr, team_b, team_b_abbr,
                       venue, winner, created_at, updated_at
                FROM matches
                ORDER BY id
                """
            )
        )
        user_players = list(
            conn.execute(
                """
                SELECT user_id, player_id, created_at, submitted_at, frozen_at, is_deleted
                FROM user_players
                ORDER BY user_id, player_id
                """
            )
        )
        swap_windows = list(
            conn.execute(
                """
                SELECT id, name, start_at, lock_at, end_at, effective_match_id, created_at
                FROM swap_windows
                ORDER BY id
                """
            )
        )
        user_swaps = list(
            conn.execute(
                """
                SELECT id, user_id, window_id, out_player_id, in_player_id, created_at,
                       is_frozen, frozen_at, is_validated, validated_at, validated_by, is_deleted
                FROM user_swaps
                ORDER BY id
                """
            )
        )
        predictions = list(
            conn.execute(
                """
                SELECT user_id, match_id, pick, is_correct, points_awarded, created_at, updated_at
                FROM predictions
                ORDER BY user_id, match_id
                """
            )
        )
        match_player_stats = list(
            conn.execute(
                """
                SELECT match_id, player_id, runs, catches, runouts, wickets, created_at, updated_at
                FROM match_player_stats
                ORDER BY match_id, player_id
                """
            )
        )
        match_meta = list(
            conn.execute(
                """
                SELECT match_id, motm_player_id, updated_at
                FROM match_meta
                ORDER BY match_id
                """
            )
        )
        store_kv = list(
            conn.execute(
                """
                SELECT key, value_json, updated_at
                FROM store_kv
                ORDER BY key
                """
            )
        )
        leaderboard_snapshots = list(
            conn.execute(
                """
                SELECT date, rows_json, created_at, updated_at
                FROM leaderboard_snapshots
                ORDER BY date
                """
            )
        )
        activity_feed = list(
            conn.execute(
                """
                SELECT id, user_id, username, activity_type, message, created_at
                FROM activity_feed
                ORDER BY created_at, id
                """
            )
        )
        user_login_audit = list(
            conn.execute(
                """
                SELECT id, user_id, username, device_type, browser, os, platform,
                       language, screen_width, screen_height, user_agent, ip_address, created_at
                FROM user_login_audit
                ORDER BY created_at, id
                """
            )
        )

    return {
        "users": users,
        "players": players,
        "matches": matches,
        "user_players": user_players,
        "swap_windows": swap_windows,
        "user_swaps": user_swaps,
        "predictions": predictions,
        "match_player_stats": match_player_stats,
        "match_meta": match_meta,
        "store_kv": store_kv,
        "leaderboard_snapshots": leaderboard_snapshots,
        "activity_feed": activity_feed,
        "user_login_audit": user_login_audit,
    }


def build_ifl_match_stats_payload(match_player_stats, match_meta):
    payload = {}
    for r in match_player_stats:
        mid = str(int(r["match_id"]))
        pid = str(int(r["player_id"]))
        if mid not in payload:
            payload[mid] = {"players": {}, "motmPlayerId": ""}
        payload[mid]["players"][pid] = {
            "runs": int(r.get("runs") or 0),
            "catches": int(r.get("catches") or 0),
            "runouts": int(r.get("runouts") or 0),
            "wickets": int(r.get("wickets") or 0),
        }

    for r in match_meta:
        mid = str(int(r["match_id"]))
        if mid not in payload:
            payload[mid] = {"players": {}, "motmPlayerId": ""}
        motm = r.get("motm_player_id")
        payload[mid]["motmPlayerId"] = int(motm) if motm is not None else ""

    return payload


def write_sqlite(data, sqlite_path: Path, truncate_first: bool):
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        create_sqlite_schema(conn)
        # Ensure new columns exist when migrating into an older SQLite file.
        cols = [r[1] for r in conn.execute("PRAGMA table_info(user_swaps)").fetchall()]
        if "is_frozen" not in cols:
            conn.execute('ALTER TABLE "user_swaps" ADD COLUMN is_frozen INTEGER NOT NULL DEFAULT 0')
        if "frozen_at" not in cols:
            conn.execute('ALTER TABLE "user_swaps" ADD COLUMN frozen_at TEXT')
        if "is_validated" not in cols:
            conn.execute('ALTER TABLE "user_swaps" ADD COLUMN is_validated INTEGER NOT NULL DEFAULT 0')
        if "validated_at" not in cols:
            conn.execute('ALTER TABLE "user_swaps" ADD COLUMN validated_at TEXT')
        if "validated_by" not in cols:
            conn.execute('ALTER TABLE "user_swaps" ADD COLUMN validated_by TEXT')
        has_effective_match_id = "effective_match_id" in cols
        if truncate_first:
            truncate_sqlite(conn)

        conn.executemany(
            """
            INSERT OR REPLACE INTO users (
              id, username, password, team_name, team_logo, points,
              squad_submitted, squad_validated, squad_frozen, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    int(r["id"]),
                    _as_text(r["username"]),
                    _as_text(r["password"]),
                    _as_text(r["team_name"]),
                    _as_text(r.get("team_logo") or ""),
                    int(r.get("points") or 0),
                    int(r.get("squad_submitted") or 0),
                    int(r.get("squad_validated") or 0),
                    int(r.get("squad_frozen") or 0),
                    _as_text(r["created_at"]),
                    _as_text(r["updated_at"]),
                )
                for r in data["users"]
            ],
        )

        conn.executemany(
            """
            INSERT OR REPLACE INTO players (id, team, name, role, country, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    int(r["id"]),
                    _as_text(r["team"]),
                    _as_text(r["name"]),
                    _as_text(r["role"]),
                    _as_text(r["country"]),
                    _as_text(r["created_at"]),
                    _as_text(r["updated_at"]),
                )
                for r in data["players"]
            ],
        )

        conn.executemany(
            """
            INSERT OR REPLACE INTO matches (
              id, match_date, team_a, team_a_abbr, team_b, team_b_abbr,
              venue, winner, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    int(r["id"]),
                    _as_text(r["match_date"]),
                    _as_text(r["team_a"]),
                    _as_text(r["team_a_abbr"]),
                    _as_text(r["team_b"]),
                    _as_text(r["team_b_abbr"]),
                    _as_text(r["venue"]),
                    _as_text(r.get("winner") or ""),
                    _as_text(r["created_at"]),
                    _as_text(r["updated_at"]),
                )
                for r in data["matches"]
            ],
        )

        conn.executemany(
            """
            INSERT OR REPLACE INTO user_players (user_id, player_id, created_at, submitted_at, frozen_at, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    int(r["user_id"]),
                    int(r["player_id"]),
                    _as_text(r["created_at"]),
                    _as_text(r.get("submitted_at")),
                    _as_text(r.get("frozen_at")),
                    int(r.get("is_deleted") or 0),
                )
                for r in data["user_players"]
            ],
        )

        conn.executemany(
            """
            INSERT OR REPLACE INTO swap_windows (
              id, name, start_at, lock_at, end_at, effective_match_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    int(r["id"]),
                    _as_text(r["name"]),
                    _as_text(r["start_at"]),
                    _as_text(r["lock_at"]),
                    _as_text(r["end_at"]),
                    int(r.get("effective_match_id") or 0),
                    _as_text(r["created_at"]),
                )
                for r in data["swap_windows"]
            ],
        )

        if has_effective_match_id:
            conn.executemany(
                """
                INSERT OR REPLACE INTO user_swaps (
                  id, user_id, window_id, out_player_id, in_player_id, effective_match_id, created_at,
                  is_frozen, frozen_at, is_validated, validated_at, validated_by, is_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        int(r["id"]),
                        int(r["user_id"]),
                        int(r["window_id"]),
                        int(r["out_player_id"]),
                        int(r["in_player_id"]),
                        int(r.get("effective_match_id") or 0),
                        _as_text(r["created_at"]),
                        int(r.get("is_frozen") or 0),
                        _as_text(r.get("frozen_at")),
                        int(r.get("is_validated") or 0),
                        _as_text(r.get("validated_at")),
                        _as_text(r.get("validated_by")),
                        int(r.get("is_deleted") or 0),
                    )
                    for r in data["user_swaps"]
                ],
            )
        else:
            conn.executemany(
                """
                INSERT OR REPLACE INTO user_swaps (
                  id, user_id, window_id, out_player_id, in_player_id, created_at,
                  is_frozen, frozen_at, is_validated, validated_at, validated_by, is_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        int(r["id"]),
                        int(r["user_id"]),
                        int(r["window_id"]),
                        int(r["out_player_id"]),
                        int(r["in_player_id"]),
                        _as_text(r["created_at"]),
                        int(r.get("is_frozen") or 0),
                        _as_text(r.get("frozen_at")),
                        int(r.get("is_validated") or 0),
                        _as_text(r.get("validated_at")),
                        _as_text(r.get("validated_by")),
                        int(r.get("is_deleted") or 0),
                    )
                    for r in data["user_swaps"]
                ],
            )

        conn.executemany(
            """
            INSERT OR REPLACE INTO predictions (
              user_id, match_id, pick, is_correct, points_awarded, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    int(r["user_id"]),
                    int(r["match_id"]),
                    _as_text(r["pick"]),
                    None if r.get("is_correct") is None else int(r["is_correct"]),
                    int(r.get("points_awarded") or 0),
                    _as_text(r["created_at"]),
                    _as_text(r["updated_at"]),
                )
                for r in data["predictions"]
            ],
        )

        conn.executemany(
            """
            INSERT OR REPLACE INTO match_player_stats (
              match_id, player_id, runs, catches, runouts, wickets, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    int(r["match_id"]),
                    int(r["player_id"]),
                    int(r.get("runs") or 0),
                    int(r.get("catches") or 0),
                    int(r.get("runouts") or 0),
                    int(r.get("wickets") or 0),
                    _as_text(r["created_at"]),
                    _as_text(r["updated_at"]),
                )
                for r in data["match_player_stats"]
            ],
        )

        conn.executemany(
            """
            INSERT OR REPLACE INTO match_meta (match_id, motm_player_id, updated_at)
            VALUES (?, ?, ?)
            """,
            [
                (
                    int(r["match_id"]),
                    None if r.get("motm_player_id") is None else int(r["motm_player_id"]),
                    _as_text(r["updated_at"]),
                )
                for r in data["match_meta"]
            ],
        )

        kv_rows = []
        for r in data["store_kv"]:
            key = _as_text(r["key"])
            value_json = r.get("value_json")
            if not isinstance(value_json, str):
                value_json = json.dumps(value_json if value_json is not None else {})
            else:
                try:
                    json.loads(value_json)
                except Exception:
                    value_json = json.dumps({})
            kv_rows.append((key, value_json, _as_text(r["updated_at"])))

        # Compatibility snapshot for older SQLite consumers expecting JSON match stats in store_kv.
        match_stats_payload = build_ifl_match_stats_payload(data["match_player_stats"], data["match_meta"])
        kv_rows = [row for row in kv_rows if row[0] != "ifl_match_stats"]
        kv_rows.append(("ifl_match_stats", json.dumps(match_stats_payload), ""))

        # Ensure global team code key exists.
        if not any(row[0] == "ifl_global_team_code" for row in kv_rows):
            kv_rows.append(("ifl_global_team_code", json.dumps(DEFAULT_TEAM_CODE), ""))

        conn.executemany(
            """
            INSERT OR REPLACE INTO store_kv (key, value_json, updated_at)
            VALUES (?, ?, ?)
            """,
            kv_rows,
        )

        conn.executemany(
            """
            INSERT OR REPLACE INTO leaderboard_snapshots (date, rows_json, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            [
                (
                    _as_text(r["date"]),
                    _as_text(r["rows_json"]),
                    _as_text(r["created_at"]),
                    _as_text(r["updated_at"]),
                )
                for r in data["leaderboard_snapshots"]
            ],
        )

        conn.executemany(
            """
            INSERT OR REPLACE INTO activity_feed (id, user_id, username, activity_type, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    int(r["id"]),
                    None if r.get("user_id") is None else int(r["user_id"]),
                    _as_text(r.get("username") or ""),
                    _as_text(r.get("activity_type") or "info"),
                    _as_text(r.get("message") or ""),
                    _as_text(r.get("created_at") or ""),
                )
                for r in data["activity_feed"]
            ],
        )

        conn.executemany(
            """
            INSERT OR REPLACE INTO user_login_audit (
              id, user_id, username, device_type, browser, os, platform,
              language, screen_width, screen_height, user_agent, ip_address, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    int(r["id"]),
                    int(r["user_id"]),
                    _as_text(r["username"]),
                    _as_text(r.get("device_type")),
                    _as_text(r.get("browser")),
                    _as_text(r.get("os")),
                    _as_text(r.get("platform")),
                    _as_text(r.get("language")),
                    None if r.get("screen_width") is None else int(r["screen_width"]),
                    None if r.get("screen_height") is None else int(r["screen_height"]),
                    _as_text(r.get("user_agent")),
                    _as_text(r.get("ip_address")),
                    _as_text(r.get("created_at")),
                )
                for r in data["user_login_audit"]
            ],
        )

        conn.commit()
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Migrate IFL data from PostgreSQL to SQLite")
    parser.add_argument("--pg-url", default=os.getenv("DATABASE_URL", ""), help="PostgreSQL connection URL")
    parser.add_argument("--sqlite-path", default=str(DEFAULT_SQLITE), help="Output SQLite path")
    parser.add_argument("--truncate-first", action="store_true", help="Truncate destination SQLite tables first")
    args = parser.parse_args()

    if psycopg is None:
        print("Missing dependency: psycopg. Install with: pip3 install 'psycopg[binary]'")
        sys.exit(1)

    if not args.pg_url:
        print("Missing PostgreSQL URL. Set --pg-url or DATABASE_URL")
        sys.exit(1)

    sqlite_path = Path(args.sqlite_path)
    data = load_postgres(args.pg_url)
    write_sqlite(data, sqlite_path, truncate_first=args.truncate_first)

    print("Migration complete.")
    print(f"SQLite: {sqlite_path}")
    print(
        "Rows migrated:",
        f"users={len(data['users'])},",
        f"players={len(data['players'])},",
        f"matches={len(data['matches'])},",
        f"user_players={len(data['user_players'])},",
        f"swap_windows={len(data['swap_windows'])},",
        f"user_swaps={len(data['user_swaps'])},",
        f"predictions={len(data['predictions'])},",
        f"match_player_stats={len(data['match_player_stats'])},",
        f"match_meta={len(data['match_meta'])},",
        f"store_kv={len(data['store_kv'])},",
        f"leaderboard_snapshots={len(data['leaderboard_snapshots'])},",
        f"activity_feed={len(data['activity_feed'])},",
        f"user_login_audit={len(data['user_login_audit'])}",
    )


if __name__ == "__main__":
    main()
