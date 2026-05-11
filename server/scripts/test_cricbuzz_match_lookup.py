#!/usr/bin/env python3
import argparse
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MAP = ROOT / "server" / "data" / "cricbuzz_match_ids_2026.json"
AZURE_OPENAI_ENDPOINT = (os.getenv("AZURE_OPENAI_ENDPOINT", "https://iflopenai.openai.azure.com/").strip() or "https://iflopenai.openai.azure.com/").rstrip("/")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "").strip()
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1-mini").strip() or "gpt-4.1-mini"
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21").strip() or "2024-10-21"


def normalize_team(value: str) -> str:
    return str(value or "").strip().upper()


def parse_date(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    formats = (
        "%a, %d %b %Y",
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d %b %Y",
        "%d %B %Y",
    )
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).strftime("%a, %d %b %Y")
        except Exception:
            continue
    return text


def load_match_map(path: Path) -> list[dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise RuntimeError(f"Expected a list in {path}")
    return data


def lookup_match_id(rows: list[dict[str, Any]], date_text: str, team1: str, team2: str, strict_order: bool = False) -> list[dict[str, Any]]:
    wanted_date = parse_date(date_text)
    a = normalize_team(team1)
    b = normalize_team(team2)
    matches: list[dict[str, Any]] = []
    for row in rows:
        row_date = parse_date(str(row.get("date") or ""))
        row_team1 = normalize_team(str(row.get("team1") or ""))
        row_team2 = normalize_team(str(row.get("team2") or ""))
        if row_date != wanted_date:
            continue
        if strict_order:
            if row_team1 == a and row_team2 == b:
                matches.append(row)
        else:
            if {row_team1, row_team2} == {a, b}:
                matches.append(row)
    return matches


def fetch_scorecard(match_id: int, api_key: str, api_host: str, insecure: bool = False) -> dict[str, Any]:
    if not api_key:
        raise RuntimeError("RapidAPI key is required for scorecard fetch. Pass --rapidapi-key or set CRICBUZZ_RAPIDAPI_KEY.")
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
    return json.loads(raw_bytes.decode("utf-8", errors="ignore"))


def extract_first_json_object(raw_text: str) -> str:
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


def resolve_api_mode(api_mode: str, deployment: str, api_version: str) -> str:
    mode = str(api_mode or "auto").strip().lower()
    if mode in {"chat", "responses"}:
        return mode
    if "preview" in str(api_version or "").lower() or str(deployment or "").lower().startswith("gpt-5"):
        return "responses"
    return "chat"


def call_azure_for_score_dump(system_text: str, user_text: str, insecure: bool = False, api_mode: str = "auto") -> tuple[str, dict[str, Any]]:
    if not AZURE_OPENAI_API_KEY:
        raise RuntimeError("AZURE_OPENAI_API_KEY is required for AI parsing.")

    resolved_mode = resolve_api_mode(api_mode, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION)
    if resolved_mode == "responses":
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

    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
    context = ssl._create_unverified_context() if insecure else None
    started_at = time.time()
    with urllib.request.urlopen(req, timeout=60, context=context) as resp:
        raw = resp.read().decode("utf-8")
    return raw, {"url": url, "payload": payload, "api_mode": resolved_mode, "duration_ms": int((time.time() - started_at) * 1000)}


def extract_text_from_responses_payload(data: dict[str, Any]) -> str:
    output = data.get("output")
    if isinstance(output, list):
        texts: list[str] = []
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
        if texts:
            return "\n".join(texts).strip()
    if isinstance(data.get("output_text"), str) and data.get("output_text", "").strip():
        return str(data.get("output_text")).strip()
    return ""


def build_ai_prompts(scorecard: dict[str, Any], match_row: dict[str, Any]) -> tuple[str, str]:
    system_text = (
        "You are converting structured Cricbuzz scorecard JSON into a fantasy scoring import JSON for a custom IPL-style app. "
        "Return only valid JSON with this exact shape: "
        '{"winner":"TEAM_ABBR","motm":"Player Name","players":[{"name":"Player Name","runs":0,"catches":0,"runouts":0,"wickets":0}]}. '
        "Read the supplied JSON carefully. Extract winner from the result status, including super over results. "
        "Extract runs from batsman rows and wickets from bowler rows. "
        "Infer catches from dismissals like 'c Fielder b Bowler'. "
        "Count stumpings and run outs inside runouts because the schema has no separate stumping field. "
        "Merge batting, bowling, and fielding contributions for the same player into one object. "
        "Use these IPL team abbreviations: CSK, DC, GT, KKR, LSG, MI, PBKS, RCB, RR, SRH, NR. "
        "If the scorecard JSON does not contain a reliable man of the match field, leave motm as an empty string. "
        "Do not add commentary or markdown."
    )
    user_text = (
        "Convert this Cricbuzz scorecard JSON into the final import JSON.\n\n"
        f"Match ID: {match_row.get('matchId')}\n"
        f"Date: {match_row.get('date')}\n"
        f"Fixture: {match_row.get('team1')} vs {match_row.get('team2')}\n\n"
        f"Scorecard JSON:\n{json.dumps(scorecard, ensure_ascii=False)}"
    )
    return system_text, user_text


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test static Cricbuzz match-id lookup and optional scorecard fetch.")
    parser.add_argument("--date", required=True, help="Match date, e.g. 'Sun, 26 Apr 2026' or '2026-04-26'")
    parser.add_argument("--team1", required=True, help="Team 1 abbreviation, e.g. KKR")
    parser.add_argument("--team2", required=True, help="Team 2 abbreviation, e.g. LSG")
    parser.add_argument("--strict-order", action="store_true", help="Require exact team1/team2 order.")
    parser.add_argument("--map-file", default=str(DEFAULT_MAP), help="Path to the static match-id JSON file.")
    parser.add_argument("--fetch-scorecard", action="store_true", help="Fetch the RapidAPI scorecard after resolving match id.")
    parser.add_argument("--rapidapi-key", default=os.getenv("CRICBUZZ_RAPIDAPI_KEY", ""), help="RapidAPI key.")
    parser.add_argument("--rapidapi-host", default=os.getenv("CRICBUZZ_RAPIDAPI_HOST", "cricbuzz-cricket.p.rapidapi.com"), help="RapidAPI host.")
    parser.add_argument("--insecure", action="store_true", help="Disable SSL verification for local debugging.")
    parser.add_argument("--ai-parse", action="store_true", help="After fetching the scorecard, send it to Azure OpenAI to generate the final import JSON.")
    parser.add_argument("--api-mode", choices=("auto", "chat", "responses"), default="auto", help="Azure OpenAI API shape to use for --ai-parse.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rows = load_match_map(Path(args.map_file))
    matches = lookup_match_id(rows, args.date, args.team1, args.team2, strict_order=args.strict_order)

    if not matches:
        print("No match id found for the supplied date/teams.", file=sys.stderr)
        return 1

    output: dict[str, Any] = {
        "lookup": {
            "date": parse_date(args.date),
            "team1": normalize_team(args.team1),
            "team2": normalize_team(args.team2),
            "strictOrder": bool(args.strict_order),
            "matchesFound": len(matches),
        },
        "matches": matches,
    }

    if args.fetch_scorecard:
        match_id = int(matches[0]["matchId"])
        try:
            scorecard = fetch_scorecard(match_id, args.rapidapi_key.strip(), args.rapidapi_host.strip(), insecure=args.insecure)
            output["scorecardFetch"] = {
                "matchId": match_id,
                "status": str(scorecard.get("status") or ""),
                "isMatchComplete": bool(scorecard.get("ismatchcomplete")),
                "topLevelKeys": list(scorecard.keys())[:20],
                "scorecardPreview": scorecard,
            }
            if args.ai_parse:
                system_text, user_text = build_ai_prompts(scorecard, matches[0])
                raw, meta = call_azure_for_score_dump(system_text, user_text, insecure=args.insecure, api_mode=args.api_mode)
                data = json.loads(raw)
                if meta["api_mode"] == "responses":
                    content = extract_text_from_responses_payload(data)
                else:
                    content = str((((data.get("choices") or [{}])[0]).get("message") or {}).get("content") or "").strip()
                parsed = json.loads(extract_first_json_object(content))
                output["aiScoreDump"] = {
                    "apiMode": meta["api_mode"],
                    "durationMs": meta["duration_ms"],
                    "result": parsed,
                }
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            output["scorecardFetchError"] = {"status": exc.code, "reason": str(exc.reason), "body": body}
        except Exception as exc:
            output["scorecardFetchError"] = {"error": repr(exc)}

    if args.pretty:
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(output, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
