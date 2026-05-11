#!/usr/bin/env python3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from server.app import _write_leaderboard_export, init_db  # noqa: E402


def main():
    export_date = sys.argv[1] if len(sys.argv) > 1 else None
    init_db()
    paths = _write_leaderboard_export(export_date)
    print(f"CSV: {paths['csv']}")
    print(f"JSON: {paths['json']}")


if __name__ == "__main__":
    main()
