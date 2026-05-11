#!/usr/bin/env python3
import argparse
import gzip
import json
import os
import traceback
import sys
import time
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import select


def _bootstrap_backend(database_url: str | None = None):
    if database_url:
        os.environ["DATABASE_URL"] = database_url
    elif not os.getenv("DATABASE_URL", "").strip():
        raise RuntimeError(
            "DATABASE_URL is required. Export it first or pass --database-url to this script."
        )

    from server.app import (
        AZURE_OPENAI_API_KEY,
        AZURE_OPENAI_API_VERSION,
        AZURE_OPENAI_DEPLOYMENT,
        AZURE_OPENAI_ENDPOINT,
        Match,
        Player,
        SessionLocal,
        _extract_first_json_object,
        _search_trusted_cricket_sources,
    )

    return {
        "AZURE_OPENAI_API_KEY": AZURE_OPENAI_API_KEY,
        "AZURE_OPENAI_API_VERSION": AZURE_OPENAI_API_VERSION,
        "AZURE_OPENAI_DEPLOYMENT": AZURE_OPENAI_DEPLOYMENT,
        "AZURE_OPENAI_ENDPOINT": AZURE_OPENAI_ENDPOINT,
        "Match": Match,
        "Player": Player,
        "SessionLocal": SessionLocal,
        "_extract_first_json_object": _extract_first_json_object,
        "_search_trusted_cricket_sources": _search_trusted_cricket_sources,
    }


def _fetch_cricbuzz_rapidapi_scorecard(match_id: int, api_key: str, api_host: str, insecure: bool = False) -> dict:
    if not api_key:
        raise RuntimeError("RapidAPI key is required for Cricbuzz scorecard fetch.")
    url = f"https://{api_host}/mcenter/v1/{int(match_id)}/scard"
    req = urllib.request.Request(
        url,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "identity",
            "x-rapidapi-host": api_host,
            "x-rapidapi-key": api_key,
        },
        method="GET",
    )
    context = ssl._create_unverified_context() if insecure else None
    with urllib.request.urlopen(req, timeout=45, context=context) as resp:
        status = getattr(resp, "status", None)
        content_type = str(resp.headers.get("Content-Type") or "")
        content_encoding = str(resp.headers.get("Content-Encoding") or "")
        raw_bytes = resp.read()
    if content_encoding.lower() == "gzip":
        try:
            raw_bytes = gzip.decompress(raw_bytes)
        except Exception:
            pass
    raw = raw_bytes.decode("utf-8", errors="ignore")
    try:
        payload = json.loads(raw)
    except Exception as exc:
        raise RuntimeError(
            f"RapidAPI returned non-JSON body. Status={status!r}. Content-Type={content_type!r}. "
            f"Content-Encoding={content_encoding!r}. Byte-length={len(raw_bytes)}. "
            f"Body preview={raw[:1200]!r}"
        ) from exc
    return payload


def build_scoring_prompts(match, search_trusted_cricket_sources, preferred_url: str = "", output_mode: str = "json") -> tuple[str, str, list[dict]]:
    context = {
        "targetMatch": {
            "id": int(match.id),
            "teamA": str(match.team_a or ""),
            "teamAabbr": str(match.team_a_abbr or ""),
            "teamB": str(match.team_b or ""),
            "teamBabbr": str(match.team_b_abbr or ""),
            "date": str(match.match_date or ""),
            "venue": str(match.venue or ""),
        }
    }
    query = f"IPL 2026 scorecard for Match {match.id}: {match.team_a_abbr} vs {match.team_b_abbr}"
    sources = search_trusted_cricket_sources(
        f"{query} scorecard winner player stats man of the match",
        context,
        limit=5,
        preferred_url=preferred_url,
    )
    sources_text = "\n\n".join(
        [
            f"[Source {idx + 1}] {src.get('source')} | {src.get('title')}\n"
            f"URL: {src.get('url')}\n"
            f"Snippet: {src.get('snippet')}\n"
            f"Detailed excerpt ({int(src.get('text_length') or 0)} chars total): {str(src.get('detailed_text') or '')}"
            for idx, src in enumerate(sources)
        ]
    )
    if output_mode == "explain":
        system_text = (
            "You are debugging cricket scorecard extraction for a fantasy scoring import workflow. "
            "Read the supplied match source text carefully and explain what facts are actually present before producing any JSON. "
            "Use these IPL team abbreviations when naming the winner: CSK=Chennai Super Kings, DC=Delhi Capitals, GT=Gujarat Titans, "
            "KKR=Kolkata Knight Riders, LSG=Lucknow Super Giants, MI=Mumbai Indians, PBKS=Punjab Kings, "
            "RCB=Royal Challengers Bengaluru, RR=Rajasthan Royals, SRH=Sunrisers Hyderabad, NR=No Result. "
            "Do not hide uncertainty. If the source text is too weak, say exactly what is missing. "
            "At the end, include a final draft JSON object with this schema: "
            '{"winner":"TEAM_ABBR","motm":"Player Name","players":[{"name":"Player Name","runs":0,"catches":0,"runouts":0,"wickets":0}]}.'
        )
        user_text = (
            "Analyze the following match content and explain what you can reliably extract.\n\n"
            f"Primary link: {preferred_url or '(not provided; use trusted sources below)'}\n"
            f"Match: {match.team_a_abbr} v {match.team_b_abbr}\n"
            f"Date: {match.match_date}\n"
            f"Venue: {match.venue}\n\n"
            f"Trusted source snippets:\n{sources_text}\n\n"
            "Return these sections in order:\n"
            "1. Source facts found\n"
            "2. Winner inference\n"
            "3. Man of the match inference\n"
            "4. Extracted batting stats\n"
            "5. Extracted bowling stats\n"
            "6. Extracted catches and runouts\n"
            "7. Missing or unclear data\n"
            "8. Final draft JSON\n"
        )
    else:
        system_text = (
            "You are converting a cricket match scorecard or match report into a fantasy scoring import JSON for a custom IPL-style app. "
            "Output only valid JSON. Do not add markdown. Do not explain anything. "
            'Required output format: {"winner":"TEAM_ABBR","motm":"Player Name","players":[{"name":"Player Name","runs":0,"catches":0,"runouts":0,"wickets":0}]}. '
            "Read the scorecard carefully. Extract winner, man of the match, and player stats for the players involved in the match. "
            "Use only these fields per player: name, runs, catches, runouts, wickets. "
            "Merge batting, bowling, and fielding contributions for the same player. "
            "If stumpings are present, count them inside runouts. "
            "Include the full player list that can be inferred from the scorecard or match report, even if some players have only one type of contribution. "
            "Use these IPL team abbreviations when setting winner: CSK=Chennai Super Kings, DC=Delhi Capitals, GT=Gujarat Titans, KKR=Kolkata Knight Riders, LSG=Lucknow Super Giants, MI=Mumbai Indians, PBKS=Punjab Kings, RCB=Royal Challengers Bengaluru, RR=Rajasthan Royals, SRH=Sunrisers Hyderabad, NR=No Result. "
            "Infer the winner from the scorecard, result summary, chase outcome, or super over result, and infer man of the match from the award or match report if it is available in the source material. "
            "Prefer explicit scorecard facts over article prose. Return only JSON."
        )
        user_text = (
            "Convert the following match content into the required JSON.\n\n"
            f"Primary link: {preferred_url or '(not provided; use trusted sources below)'}\n"
            f"Match: {match.team_a_abbr} v {match.team_b_abbr}\n"
            f"Date: {match.match_date}\n"
            f"Venue: {match.venue}\n\n"
            f"Trusted source snippets:\n{sources_text}\n\n"
            "Return only the JSON object."
        )
    return system_text, user_text, sources


def _resolve_api_mode(api_mode: str, azure_cfg: dict) -> str:
    mode = str(api_mode or "auto").strip().lower()
    if mode in {"chat", "responses"}:
        return mode
    version = str(azure_cfg.get("AZURE_OPENAI_API_VERSION") or "").lower()
    deployment = str(azure_cfg.get("AZURE_OPENAI_DEPLOYMENT") or "").lower()
    if "preview" in version or deployment.startswith("gpt-5"):
        return "responses"
    return "chat"


def call_azure_chat(system_text: str, user_text: str, azure_cfg: dict, insecure: bool = False, api_mode: str = "auto") -> tuple[str, dict]:
    if not azure_cfg["AZURE_OPENAI_API_KEY"]:
        raise RuntimeError("AZURE_OPENAI_API_KEY is not configured.")

    resolved_mode = _resolve_api_mode(api_mode, azure_cfg)
    if resolved_mode == "responses":
        payload = {
            "model": azure_cfg["AZURE_OPENAI_DEPLOYMENT"],
            "input": [
                {"role": "system", "content": system_text},
                {"role": "user", "content": user_text},
            ],
            "max_output_tokens": 1800,
        }
        url = (
            f"{azure_cfg['AZURE_OPENAI_ENDPOINT']}/openai/responses"
            f"?api-version={urllib.parse.quote(azure_cfg['AZURE_OPENAI_API_VERSION'], safe='')}"
        )
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {azure_cfg['AZURE_OPENAI_API_KEY']}",
        }
    else:
        payload = {
            "messages": [
                {"role": "system", "content": system_text},
                {"role": "user", "content": user_text},
            ],
            "temperature": 0.1,
            "top_p": 0.9,
            "max_tokens": 1800,
        }
        url = (
            f"{azure_cfg['AZURE_OPENAI_ENDPOINT']}/openai/deployments/"
            f"{urllib.parse.quote(azure_cfg['AZURE_OPENAI_DEPLOYMENT'], safe='')}/chat/completions"
            f"?api-version={urllib.parse.quote(azure_cfg['AZURE_OPENAI_API_VERSION'], safe='')}"
        )
        headers = {"Content-Type": "application/json", "api-key": azure_cfg["AZURE_OPENAI_API_KEY"]}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    started_at = time.time()
    context = ssl._create_unverified_context() if insecure else None
    with urllib.request.urlopen(req, timeout=45, context=context) as resp:
        raw = resp.read().decode("utf-8")
    return raw, {
        "duration_ms": int((time.time() - started_at) * 1000),
        "url": url,
        "payload": payload,
        "api_mode": resolved_mode,
    }


def _extract_text_from_responses_payload(data: dict) -> str:
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Debug the AI scoring draft prompt and raw response.")
    parser.add_argument("--match-id", type=int, required=True, help="Match ID from the database.")
    parser.add_argument("--scorecard-url", default="", help="Preferred trusted scorecard URL.")
    parser.add_argument("--database-url", default="", help="PostgreSQL DATABASE_URL override for this run.")
    parser.add_argument("--print-sources", action="store_true", help="Print full source metadata.")
    parser.add_argument("--insecure", action="store_true", help="Disable SSL certificate verification for local debugging.")
    parser.add_argument("--api-mode", choices=("auto", "chat", "responses"), default="auto", help="Azure OpenAI API shape to use.")
    parser.add_argument("--output-mode", choices=("json", "explain"), default="json", help="Whether to force JSON-only output or ask for an explanatory extraction trace.")
    parser.add_argument("--use-rapidapi-scorecard", action="store_true", help="Fetch Cricbuzz scorecard JSON from RapidAPI and prepend it to the model sources.")
    parser.add_argument("--rapidapi-key", default=os.getenv("CRICBUZZ_RAPIDAPI_KEY", ""), help="RapidAPI key for Cricbuzz scorecard fetch.")
    parser.add_argument("--rapidapi-host", default=os.getenv("CRICBUZZ_RAPIDAPI_HOST", "cricbuzz-cricket.p.rapidapi.com"), help="RapidAPI host for Cricbuzz scorecard fetch.")
    args = parser.parse_args()

    backend = _bootstrap_backend(args.database_url.strip() or None)
    Match = backend["Match"]
    Player = backend["Player"]
    SessionLocal = backend["SessionLocal"]

    with SessionLocal() as db:
        match = db.get(Match, int(args.match_id))
        if match is None:
            raise SystemExit(f"Match {args.match_id} not found.")
        players = db.scalars(
            select(Player).where(
                (Player.team == match.team_a_abbr) | (Player.team == match.team_b_abbr)
            ).order_by(Player.name)
        ).all()

    system_text, user_text, sources = build_scoring_prompts(
        match,
        backend["_search_trusted_cricket_sources"],
        preferred_url=args.scorecard_url,
        output_mode=args.output_mode,
    )

    if args.use_rapidapi_scorecard:
        try:
            rapidapi_payload = _fetch_cricbuzz_rapidapi_scorecard(
                int(match.id),
                args.rapidapi_key.strip(),
                args.rapidapi_host.strip(),
                insecure=args.insecure,
            )
            raw_json_text = json.dumps(rapidapi_payload, ensure_ascii=False, separators=(",", ":"))
            pretty_json_text = json.dumps(rapidapi_payload, ensure_ascii=False, indent=2)
            rapidapi_source = {
                "title": f"Cricbuzz RapidAPI scorecard JSON for match {match.id}",
                "url": f"https://{args.rapidapi_host.strip()}/mcenter/v1/{int(match.id)}/scard",
                "domain": args.rapidapi_host.strip(),
                "source": "Cricbuzz RapidAPI",
                "snippet": raw_json_text[:420],
                "detailed_text": pretty_json_text[:3000],
                "text_length": len(pretty_json_text),
                "score": 1000,
                "rank": 0,
            }
            sources = [rapidapi_source] + sources
            sources_text = "\n\n".join(
                [
                    f"[Source {idx + 1}] {src.get('source')} | {src.get('title')}\n"
                    f"URL: {src.get('url')}\n"
                    f"Snippet: {src.get('snippet')}\n"
                    f"Detailed excerpt ({int(src.get('text_length') or 0)} chars total): {str(src.get('detailed_text') or '')}"
                    for idx, src in enumerate(sources)
                ]
            )
            if args.output_mode == "explain":
                user_text = (
                    "Analyze the following match content and explain what you can reliably extract.\n\n"
                    f"Primary link: {args.scorecard_url or '(not provided; use trusted sources below)'}\n"
                    f"Match: {match.team_a_abbr} v {match.team_b_abbr}\n"
                    f"Date: {match.match_date}\n"
                    f"Venue: {match.venue}\n\n"
                    f"Trusted source snippets:\n{sources_text}\n\n"
                    "Return these sections in order:\n"
                    "1. Source facts found\n"
                    "2. Winner inference\n"
                    "3. Man of the match inference\n"
                    "4. Extracted batting stats\n"
                    "5. Extracted bowling stats\n"
                    "6. Extracted catches and runouts\n"
                    "7. Missing or unclear data\n"
                    "8. Final draft JSON\n"
                )
            else:
                user_text = (
                    "Convert the following match content into the required JSON.\n\n"
                    f"Primary link: {args.scorecard_url or '(not provided; use trusted sources below)'}\n"
                    f"Match: {match.team_a_abbr} v {match.team_b_abbr}\n"
                    f"Date: {match.match_date}\n"
                    f"Venue: {match.venue}\n\n"
                    f"Trusted source snippets:\n{sources_text}\n\n"
                    "Return only the JSON object."
                )
        except Exception as exc:
            print("\n=== RAPIDAPI FETCH ERROR ===")
            print(f"{type(exc).__name__}: {exc!r}")
            print(traceback.format_exc())
            return 2

    print("\n=== MATCH ===")
    print(f"Match ID: {match.id}")
    print(f"Fixture: {match.team_a_abbr} vs {match.team_b_abbr}")
    print(f"Venue: {match.venue}")
    print(f"DB fixture players: {len(players)}")

    print("\n=== SYSTEM PROMPT ===")
    print(system_text)

    print("\n=== USER PROMPT ===")
    print(user_text)

    print("\n=== SOURCES ===")
    for idx, src in enumerate(sources, start=1):
        print(f"{idx}. {src.get('source')} | {src.get('title')}")
        print(f"   URL: {src.get('url')}")
        print(f"   Text length: {int(src.get('text_length') or 0)}")
        print(f"   Snippet: {src.get('snippet')}")
        detailed_text = str(src.get("detailed_text") or "")
        if detailed_text:
            print(f"   Detailed excerpt (first 3000 chars): {detailed_text}")
    if args.print_sources:
        print("\n=== FULL SOURCE JSON ===")
        print(json.dumps(sources, ensure_ascii=False, indent=2))

    if not sources:
        print("\nNo trusted sources found. Stopping before model call.")
        return 1

    print("\n=== AZURE REQUEST ===")
    print(f"Endpoint: {backend['AZURE_OPENAI_ENDPOINT']}")
    print(f"Deployment: {backend['AZURE_OPENAI_DEPLOYMENT']}")
    print(f"API version: {backend['AZURE_OPENAI_API_VERSION']}")
    print(f"API mode: {_resolve_api_mode(args.api_mode, backend)}")
    print(f"Output mode: {args.output_mode}")

    try:
        raw, meta = call_azure_chat(system_text, user_text, backend, insecure=args.insecure, api_mode=args.api_mode)
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        print("\n=== HTTP ERROR ===")
        print(f"Status: {exc.code}")
        print(details)
        return 2
    except Exception as exc:
        print("\n=== REQUEST ERROR ===")
        print(f"{type(exc).__name__}: {exc!r}")
        print(traceback.format_exc())
        return 2

    print("\n=== RESPONSE META ===")
    print(json.dumps(meta, ensure_ascii=False, indent=2))

    print("\n=== RAW MODEL RESPONSE ===")
    print(raw)

    try:
        data = json.loads(raw)
        if meta.get("api_mode") == "responses":
            content = _extract_text_from_responses_payload(data)
        else:
            content = str((((data.get("choices") or [{}])[0]).get("message") or {}).get("content") or "").strip()
        first_json = backend["_extract_first_json_object"](content)
        parsed = json.loads(first_json)
    except Exception as exc:
        print("\n=== PARSE ERROR ===")
        print(str(exc))
        if content:
            print("\n=== MODEL TEXT CONTENT ===")
            print(content)
        return 3

    print("\n=== PARSED JSON ===")
    print(json.dumps(parsed, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
