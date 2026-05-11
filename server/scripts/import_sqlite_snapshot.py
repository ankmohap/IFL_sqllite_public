#!/usr/bin/env python3
import argparse
import json
import sqlite3
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE = ROOT / "server" / "data" / "ifl.sqlite3"
DEFAULT_INPUT = ROOT / "server" / "data" / "ifl_snapshot.json"

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

CREATE_SCHEMA_SQL = """
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


def create_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(CREATE_SCHEMA_SQL)


def truncate_tables(conn: sqlite3.Connection) -> None:
    for table_name in reversed(TABLES):
        conn.execute(f"DELETE FROM {table_name}")


def import_snapshot(snapshot: dict, sqlite_path: Path, truncate_first: bool) -> None:
    sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(sqlite_path)
    try:
        create_schema(conn)
        if truncate_first:
            truncate_tables(conn)

        for table_name in TABLES:
            rows = snapshot.get(table_name, [])
            if not rows:
                continue
            columns = list(rows[0].keys())
            placeholders = ", ".join("?" for _ in columns)
            column_sql = ", ".join(columns)
            sql = f"INSERT OR REPLACE INTO {table_name} ({column_sql}) VALUES ({placeholders})"
            conn.executemany(sql, [tuple(row.get(column) for column in columns) for row in rows])

        conn.commit()
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import an IFL JSON snapshot into a SQLite database")
    parser.add_argument("--input-json", default=str(DEFAULT_INPUT), help="Path to the input JSON snapshot")
    parser.add_argument("--sqlite-path", default=str(DEFAULT_SQLITE), help="Path to the destination SQLite file")
    parser.add_argument("--truncate-first", action="store_true", help="Clear destination tables before importing")
    args = parser.parse_args()

    input_path = Path(args.input_json)
    if not input_path.exists():
        print(f"Snapshot file not found: {input_path}")
        sys.exit(1)

    snapshot = json.loads(input_path.read_text(encoding="utf-8"))
    sqlite_path = Path(args.sqlite_path)
    import_snapshot(snapshot, sqlite_path, truncate_first=args.truncate_first)

    row_counts = ", ".join(f"{table}={len(snapshot.get(table, []))}" for table in TABLES)
    print("SQLite snapshot import complete.")
    print(f"Input: {input_path}")
    print(f"Destination: {sqlite_path}")
    print(f"Rows imported: {row_counts}")


if __name__ == "__main__":
    main()
