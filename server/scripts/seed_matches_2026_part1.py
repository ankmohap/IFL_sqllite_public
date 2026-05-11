#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app import write_key  # noqa: E402


def main():
    data_path = Path(__file__).resolve().parent.parent / "data" / "matches_2026_part1.json"
    if not data_path.is_file():
        raise SystemExit(f"Missing data file: {data_path}")
    matches = json.loads(data_path.read_text(encoding="utf-8"))
    if not isinstance(matches, list) or not matches:
        raise SystemExit("No matches found in JSON file")
    write_key("ifl_master_matches", matches)
    print(f"Seeded {len(matches)} matches into ifl_master_matches from the 2026 official schedule")


if __name__ == "__main__":
    main()
