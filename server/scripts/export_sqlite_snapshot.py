#!/usr/bin/env python3
import argparse
import json
import sqlite3
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE = ROOT / "server" / "data" / "ifl.sqlite3"
DEFAULT_OUTPUT = ROOT / "server" / "data" / "ifl_snapshot.json"

TABLES = [
    "users",
    "players",
    "matches",
    "user_players",
    "swap_windows",
    "user_swaps",
    "predictions",
    "match_player_stats",
    "match_meta",
    "store_kv",
    "leaderboard_snapshots",
    "activity_feed",
    "user_login_audit",
]


def sqlite_table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return row is not None


def export_snapshot(sqlite_path: Path) -> dict:
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        snapshot = {}
        for table_name in TABLES:
            if sqlite_table_exists(conn, table_name):
                rows = conn.execute(f"SELECT * FROM {table_name}").fetchall()
                snapshot[table_name] = [dict(row) for row in rows]
            else:
                snapshot[table_name] = []
        return snapshot
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Export an IFL SQLite database to a JSON snapshot")
    parser.add_argument("--sqlite-path", default=str(DEFAULT_SQLITE), help="Path to the source SQLite file")
    parser.add_argument("--output-json", default=str(DEFAULT_OUTPUT), help="Path to the output JSON snapshot")
    args = parser.parse_args()

    sqlite_path = Path(args.sqlite_path)
    if not sqlite_path.exists():
        print(f"SQLite file not found: {sqlite_path}")
        sys.exit(1)

    snapshot = export_snapshot(sqlite_path)

    output_path = Path(args.output_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")

    row_counts = ", ".join(f"{table}={len(snapshot[table])}" for table in TABLES)
    print("SQLite snapshot export complete.")
    print(f"Source: {sqlite_path}")
    print(f"Output: {output_path}")
    print(f"Rows exported: {row_counts}")


if __name__ == "__main__":
    main()
