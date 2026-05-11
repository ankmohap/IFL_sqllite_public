#!/usr/bin/env python3
import argparse
import gzip
import json
import ssl
import urllib.error
import urllib.request


def fetch_scorecard(match_id: int, api_key: str, api_host: str, insecure: bool = False) -> dict:
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
        status = getattr(resp, "status", None)
        headers = dict(resp.headers.items())
        content_type = str(resp.headers.get("Content-Type") or "")
        content_encoding = str(resp.headers.get("Content-Encoding") or "")
        raw_bytes = resp.read()

    if content_encoding.lower() == "gzip":
        try:
            raw_bytes = gzip.decompress(raw_bytes)
        except Exception:
            pass

    raw_text = raw_bytes.decode("utf-8", errors="ignore")
    return {
        "url": url,
        "status": status,
        "headers": headers,
        "content_type": content_type,
        "content_encoding": content_encoding,
        "byte_length": len(raw_bytes),
        "raw_text": raw_text,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Test Cricbuzz RapidAPI scorecard fetch.")
    parser.add_argument("--match-id", type=int, required=True, help="Cricbuzz match id, e.g. 151924")
    parser.add_argument("--rapidapi-key", default="", help="RapidAPI key")
    parser.add_argument("--rapidapi-host", default="cricbuzz-cricket.p.rapidapi.com", help="RapidAPI host")
    parser.add_argument("--insecure", action="store_true", help="Disable SSL verification for local debugging")
    parser.add_argument("--print-body", action="store_true", help="Print the full raw body")
    args = parser.parse_args()

    api_key = args.rapidapi_key.strip()
    if not api_key:
        import os

        api_key = os.getenv("CRICBUZZ_RAPIDAPI_KEY", "").strip()

    try:
        result = fetch_scorecard(
            match_id=int(args.match_id),
            api_key=api_key,
            api_host=args.rapidapi_host.strip(),
            insecure=args.insecure,
        )
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        print("=== HTTP ERROR ===")
        print(f"Status: {exc.code}")
        print(f"Reason: {exc.reason}")
        print("=== BODY ===")
        print(body)
        return 2
    except Exception as exc:
        print("=== REQUEST ERROR ===")
        print(repr(exc))
        return 2

    print("=== REQUEST ===")
    print(result["url"])

    print("\n=== RESPONSE META ===")
    print(json.dumps(
        {
            "status": result["status"],
            "content_type": result["content_type"],
            "content_encoding": result["content_encoding"],
            "byte_length": result["byte_length"],
            "headers": result["headers"],
        },
        ensure_ascii=False,
        indent=2,
    ))

    print("\n=== BODY PREVIEW ===")
    print(result["raw_text"][:2000])

    try:
        parsed = json.loads(result["raw_text"])
        print("\n=== JSON SUMMARY ===")
        if isinstance(parsed, dict):
            print(json.dumps({"top_level_keys": list(parsed.keys())[:30]}, ensure_ascii=False, indent=2))
        else:
            print(f"Top-level type: {type(parsed).__name__}")
    except Exception as exc:
        print("\n=== JSON PARSE ERROR ===")
        print(repr(exc))

    if args.print_body:
        print("\n=== FULL BODY ===")
        print(result["raw_text"])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
