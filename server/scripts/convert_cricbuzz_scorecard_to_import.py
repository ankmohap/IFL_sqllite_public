#!/usr/bin/env python3
import argparse
import gzip
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.request
from collections import OrderedDict
from typing import Any


TEAM_ABBR_BY_NAME = {
    "chennai super kings": "CSK",
    "delhi capitals": "DC",
    "gujarat titans": "GT",
    "kolkata knight riders": "KKR",
    "lucknow super giants": "LSG",
    "mumbai indians": "MI",
    "punjab kings": "PBKS",
    "royal challengers bengaluru": "RCB",
    "royal challengers bangalore": "RCB",
    "rajasthan royals": "RR",
    "sunrisers hyderabad": "SRH",
}


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", str(name or "").strip())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert Cricbuzz scorecard JSON to IFL scoring import JSON.")
    parser.add_argument("--input-file", default="", help="Path to saved Cricbuzz scorecard JSON.")
    parser.add_argument("--match-id", type=int, help="RapidAPI Cricbuzz match id to fetch.")
    parser.add_argument("--rapidapi-key", default=os.getenv("CRICBUZZ_RAPIDAPI_KEY", ""), help="RapidAPI key.")
    parser.add_argument("--rapidapi-host", default=os.getenv("CRICBUZZ_RAPIDAPI_HOST", "cricbuzz-cricket.p.rapidapi.com"), help="RapidAPI host.")
    parser.add_argument("--insecure", action="store_true", help="Disable SSL verification for local debugging.")
    parser.add_argument("--motm", default="", help="Override Man of the Match / Player of the Match.")
    parser.add_argument("--winner", default="", help="Override winner abbreviation.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    return parser.parse_args()


def fetch_rapidapi_scorecard(match_id: int, api_key: str, api_host: str, insecure: bool = False) -> dict[str, Any]:
    if not api_key:
        raise RuntimeError("RapidAPI key is required. Pass --rapidapi-key or set CRICBUZZ_RAPIDAPI_KEY.")
    url = f"https://{api_host}/mcenter/v1/{int(match_id)}/scard"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "identity",
            "Content-Type": "application/json",
            "x-rapidapi-host": api_host,
            "x-rapidapi-key": api_key,
        },
        method="GET",
    )
    context = ssl._create_unverified_context() if insecure else None
    with urllib.request.urlopen(req, timeout=45, context=context) as resp:
        raw_bytes = resp.read()
        content_encoding = str(resp.headers.get("Content-Encoding") or "")
    if content_encoding.lower() == "gzip":
        try:
            raw_bytes = gzip.decompress(raw_bytes)
        except Exception:
            pass
    raw_text = raw_bytes.decode("utf-8", errors="ignore")
    return json.loads(raw_text)


def load_scorecard_payload(args: argparse.Namespace) -> dict[str, Any]:
    if args.input_file:
        with open(args.input_file, "r", encoding="utf-8") as fh:
            return json.load(fh)
    if args.match_id:
        return fetch_rapidapi_scorecard(args.match_id, args.rapidapi_key.strip(), args.rapidapi_host.strip(), insecure=args.insecure)
    raw = sys.stdin.read().strip()
    if not raw:
        raise RuntimeError("Provide --input-file, --match-id, or pipe JSON on stdin.")
    return json.loads(raw)


def ensure_player(stats: OrderedDict[str, dict[str, int]], name: str) -> dict[str, int]:
    key = normalize_name(name)
    row = stats.get(key)
    if row is None:
        row = {"name": key, "runs": 0, "catches": 0, "runouts": 0, "wickets": 0}
        stats[key] = row
    return row


def infer_winner(payload: dict[str, Any], override: str = "") -> str:
    if override:
        return str(override).strip().upper()
    status = str(payload.get("status") or "").strip()
    if not status:
        return ""
    lowered = status.lower()
    if "no result" in lowered:
        return "NR"
    for team_name, abbr in TEAM_ABBR_BY_NAME.items():
        if team_name in lowered and ("won" in lowered or "beat" in lowered):
            return abbr
    return ""


def parse_dismissal_contributions(outdec: str) -> tuple[list[str], list[str]]:
    text = normalize_name(outdec)
    if not text:
        return [], []
    lowered = text.lower()
    catchers: list[str] = []
    runout_people: list[str] = []

    caught_bowled = re.match(r"(?i)^c\s*&\s*b\s+(.+)$", text)
    if caught_bowled:
        catchers.append(normalize_name(caught_bowled.group(1)))
        return catchers, runout_people

    caught = re.match(r"(?i)^c\s+(.+?)\s+b\s+.+$", text)
    if caught:
        catcher = normalize_name(caught.group(1))
        catcher = re.sub(r"^\(sub\)\s*", "", catcher, flags=re.IGNORECASE)
        catchers.append(catcher)
        return catchers, runout_people

    stumped = re.match(r"(?i)^st\s+(.+?)\s+b\s+.+$", text)
    if stumped:
        keeper = normalize_name(stumped.group(1))
        runout_people.append(keeper)
        return catchers, runout_people

    run_out = re.match(r"(?i)^run out\s*\((.+)\)$", text)
    if run_out:
        inside = normalize_name(run_out.group(1))
        parts = [normalize_name(p) for p in re.split(r"/|,", inside) if normalize_name(p)]
        runout_people.extend(parts)
        return catchers, runout_people

    direct_hit = re.match(r"(?i)^run out\s+(.+)$", text)
    if direct_hit:
        inside = normalize_name(direct_hit.group(1))
        parts = [normalize_name(p) for p in re.split(r"/|,", inside) if normalize_name(p)]
        runout_people.extend(parts)
        return catchers, runout_people

    return catchers, runout_people


def convert_scorecard(payload: dict[str, Any], motm_override: str = "", winner_override: str = "") -> dict[str, Any]:
    stats: OrderedDict[str, dict[str, int]] = OrderedDict()
    innings_list = payload.get("scorecard") or []

    for innings in innings_list:
        if not isinstance(innings, dict):
            continue
        for batter in innings.get("batsman") or []:
            if not isinstance(batter, dict):
                continue
            name = normalize_name(batter.get("name"))
            if not name:
                continue
            row = ensure_player(stats, name)
            row["runs"] += max(0, int(batter.get("runs") or 0))

            catchers, runout_people = parse_dismissal_contributions(str(batter.get("outdec") or ""))
            for catcher in catchers:
                if catcher:
                    ensure_player(stats, catcher)["catches"] += 1
            for person in runout_people:
                if person:
                    ensure_player(stats, person)["runouts"] += 1

        for bowler in innings.get("bowler") or []:
            if not isinstance(bowler, dict):
                continue
            name = normalize_name(bowler.get("name"))
            if not name:
                continue
            row = ensure_player(stats, name)
            row["wickets"] += max(0, int(bowler.get("wickets") or 0))

    winner = infer_winner(payload, override=winner_override)
    motm = normalize_name(motm_override)

    players = []
    for row in stats.values():
        players.append(
            {
                "name": row["name"],
                "runs": int(row["runs"]),
                "catches": int(row["catches"]),
                "runouts": int(row["runouts"]),
                "wickets": int(row["wickets"]),
            }
        )

    return {
        "winner": winner,
        "motm": motm,
        "players": players,
    }


def main() -> int:
    args = parse_args()
    try:
        payload = load_scorecard_payload(args)
        result = convert_scorecard(payload, motm_override=args.motm, winner_override=args.winner)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        print(body or str(exc), file=sys.stderr)
        return 2
    except Exception as exc:
        print(repr(exc), file=sys.stderr)
        return 2

    if args.pretty:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
