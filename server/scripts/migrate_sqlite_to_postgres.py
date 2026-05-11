#!/usr/bin/env python3
import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path

try:
    import psycopg
except Exception:
    psycopg = None


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE = ROOT / "server" / "data" / "ifl.sqlite3"


def _null_if_blank(value):
    if value is None:
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


def sqlite_table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return row is not None


def load_sqlite(sqlite_path: Path):
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        users = [dict(r) for r in conn.execute("SELECT * FROM users ORDER BY id")]
        players = [dict(r) for r in conn.execute("SELECT * FROM players ORDER BY id")]
        matches = [dict(r) for r in conn.execute("SELECT * FROM matches ORDER BY id")]
        user_players = [dict(r) for r in conn.execute("SELECT * FROM user_players ORDER BY user_id, player_id")]
        swap_windows = []
        if sqlite_table_exists(conn, "swap_windows"):
            swap_windows = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM swap_windows ORDER BY id"
                )
            ]
        user_swaps = []
        if sqlite_table_exists(conn, "user_swaps"):
            user_swaps = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM user_swaps ORDER BY id"
                )
            ]
        predictions = [dict(r) for r in conn.execute("SELECT * FROM predictions ORDER BY user_id, match_id")]
        store_kv = [dict(r) for r in conn.execute("SELECT * FROM store_kv ORDER BY key")]
        match_player_stats = []
        if sqlite_table_exists(conn, "match_player_stats"):
            match_player_stats = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM match_player_stats ORDER BY match_id, player_id"
                )
            ]
        match_player_meta = []
        if sqlite_table_exists(conn, "match_player_meta"):
            match_player_meta = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM match_player_meta ORDER BY match_id"
                )
            ]
        leaderboard_snapshots = []
        if sqlite_table_exists(conn, "leaderboard_snapshots"):
            leaderboard_snapshots = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM leaderboard_snapshots ORDER BY date"
                )
            ]
        activity_feed = []
        if sqlite_table_exists(conn, "activity_feed"):
            activity_feed = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM activity_feed ORDER BY created_at, id"
                )
            ]
        return {
            "users": users,
            "players": players,
            "matches": matches,
            "user_players": user_players,
            "swap_windows": swap_windows,
            "user_swaps": user_swaps,
            "predictions": predictions,
            "store_kv": store_kv,
            "match_player_stats": match_player_stats,
            "match_player_meta": match_player_meta,
            "leaderboard_snapshots": leaderboard_snapshots,
            "activity_feed": activity_feed,
        }
    finally:
        conn.close()


def create_schema(pg):
    pg.execute(
        """
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
          PRIMARY KEY (user_id, player_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS swap_windows (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          name TEXT NOT NULL,
          start_at TEXT NOT NULL,
          lock_at TEXT NOT NULL,
          end_at TEXT NOT NULL,
          effective_match_id INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_swaps (
          id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
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
          is_deleted INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (window_id) REFERENCES swap_windows(id) ON DELETE CASCADE,
          FOREIGN KEY (out_player_id) REFERENCES players(id) ON DELETE CASCADE,
          FOREIGN KEY (in_player_id) REFERENCES players(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS predictions (
          user_id INTEGER NOT NULL,
          match_id INTEGER NOT NULL,
          pick TEXT NOT NULL,
          is_correct INTEGER,
          points_awarded INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, match_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
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

        CREATE TABLE IF NOT EXISTS match_player_stats (
          match_id INTEGER NOT NULL,
          player_id INTEGER NOT NULL,
          runs INTEGER NOT NULL DEFAULT 0,
          catches INTEGER NOT NULL DEFAULT 0,
          runouts INTEGER NOT NULL DEFAULT 0,
          wickets INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (match_id, player_id),
          FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
          FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS match_player_meta (
          match_id INTEGER PRIMARY KEY,
          motm_player_id INTEGER,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
          FOREIGN KEY (motm_player_id) REFERENCES players(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS activity_feed (
          id INTEGER PRIMARY KEY,
          user_id INTEGER,
          username TEXT,
          activity_type TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_feed(created_at DESC);
        """
    )


def migrate(data, pg, truncate_first: bool):
    if truncate_first:
        pg.execute(
            """
            TRUNCATE TABLE
              predictions,
              user_players,
              swap_windows,
              user_swaps,
              matches,
              players,
              users,
              store_kv,
              leaderboard_snapshots,
              match_player_stats,
              match_player_meta,
              activity_feed
            RESTART IDENTITY CASCADE
            """
        )

    for r in data["users"]:
        pg.execute(
            """
            INSERT INTO users (
              id, username, password, team_name, team_logo, points,
              squad_submitted, squad_validated, squad_frozen, created_at, updated_at
            ) VALUES (
              %(id)s, %(username)s, %(password)s, %(team_name)s, %(team_logo)s, %(points)s,
              %(squad_submitted)s, %(squad_validated)s, %(squad_frozen)s, %(created_at)s, %(updated_at)s
            )
            ON CONFLICT (id) DO UPDATE SET
              username = EXCLUDED.username,
              password = EXCLUDED.password,
              team_name = EXCLUDED.team_name,
              team_logo = EXCLUDED.team_logo,
              points = EXCLUDED.points,
              squad_submitted = EXCLUDED.squad_submitted,
              squad_validated = EXCLUDED.squad_validated,
              squad_frozen = EXCLUDED.squad_frozen,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
            """,
            r,
        )

    for r in data["players"]:
        pg.execute(
            """
            INSERT INTO players (id, team, name, role, country, created_at, updated_at)
            VALUES (%(id)s, %(team)s, %(name)s, %(role)s, %(country)s, %(created_at)s, %(updated_at)s)
            ON CONFLICT (id) DO UPDATE SET
              team = EXCLUDED.team,
              name = EXCLUDED.name,
              role = EXCLUDED.role,
              country = EXCLUDED.country,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
            """,
            r,
        )

    for r in data["matches"]:
        pg.execute(
            """
            INSERT INTO matches (
              id, match_date, team_a, team_a_abbr, team_b, team_b_abbr, venue, winner, created_at, updated_at
            ) VALUES (
              %(id)s, %(match_date)s, %(team_a)s, %(team_a_abbr)s, %(team_b)s, %(team_b_abbr)s, %(venue)s, %(winner)s, %(created_at)s, %(updated_at)s
            )
            ON CONFLICT (id) DO UPDATE SET
              match_date = EXCLUDED.match_date,
              team_a = EXCLUDED.team_a,
              team_a_abbr = EXCLUDED.team_a_abbr,
              team_b = EXCLUDED.team_b,
              team_b_abbr = EXCLUDED.team_b_abbr,
              venue = EXCLUDED.venue,
              winner = EXCLUDED.winner,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
            """,
            r,
        )

    for r in data["user_players"]:
        row = dict(r)
        row["submitted_at"] = _null_if_blank(row.get("submitted_at"))
        row["frozen_at"] = _null_if_blank(row.get("frozen_at"))
        pg.execute(
            """
            INSERT INTO user_players (user_id, player_id, created_at, submitted_at, frozen_at, is_deleted)
            VALUES (%(user_id)s, %(player_id)s, %(created_at)s, %(submitted_at)s, %(frozen_at)s, %(is_deleted)s)
            ON CONFLICT (user_id, player_id) DO UPDATE SET
              created_at = EXCLUDED.created_at,
              submitted_at = EXCLUDED.submitted_at,
              frozen_at = EXCLUDED.frozen_at,
              is_deleted = EXCLUDED.is_deleted
            """,
            row,
        )

    for r in data.get("swap_windows", []):
        pg.execute(
            """
            INSERT INTO swap_windows (id, name, start_at, lock_at, end_at, effective_match_id, created_at)
            VALUES (%(id)s, %(name)s, %(start_at)s, %(lock_at)s, %(end_at)s, %(effective_match_id)s, %(created_at)s)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              start_at = EXCLUDED.start_at,
              lock_at = EXCLUDED.lock_at,
              end_at = EXCLUDED.end_at,
              effective_match_id = EXCLUDED.effective_match_id,
              created_at = EXCLUDED.created_at
            """,
            {
                "id": int(r["id"]),
                "name": r.get("name") or "",
                "start_at": r.get("start_at"),
                "lock_at": r.get("lock_at"),
                "end_at": r.get("end_at"),
                "effective_match_id": int(r.get("effective_match_id") or 0),
                "created_at": r.get("created_at"),
            },
        )

    for r in data.get("user_swaps", []):
        pg.execute(
            """
            INSERT INTO user_swaps (
              id, user_id, window_id, out_player_id, in_player_id, created_at,
              is_frozen, frozen_at, is_validated, validated_at, validated_by, is_deleted
            ) VALUES (
              %(id)s, %(user_id)s, %(window_id)s, %(out_player_id)s, %(in_player_id)s, %(created_at)s,
              %(is_frozen)s, %(frozen_at)s, %(is_validated)s, %(validated_at)s, %(validated_by)s, %(is_deleted)s
            )
            ON CONFLICT (id) DO UPDATE SET
              user_id = EXCLUDED.user_id,
              window_id = EXCLUDED.window_id,
              out_player_id = EXCLUDED.out_player_id,
              in_player_id = EXCLUDED.in_player_id,
              created_at = EXCLUDED.created_at,
              is_frozen = EXCLUDED.is_frozen,
              frozen_at = EXCLUDED.frozen_at,
              is_validated = EXCLUDED.is_validated,
              validated_at = EXCLUDED.validated_at,
              validated_by = EXCLUDED.validated_by,
              is_deleted = EXCLUDED.is_deleted
            """,
            {
                "id": int(r["id"]),
                "user_id": int(r["user_id"]),
                "window_id": int(r["window_id"]),
                "out_player_id": int(r["out_player_id"]),
                "in_player_id": int(r["in_player_id"]),
                "created_at": r.get("created_at"),
                "is_frozen": int(r.get("is_frozen") or 0),
                "frozen_at": r.get("frozen_at"),
                "is_validated": int(r.get("is_validated") or 0),
                "validated_at": r.get("validated_at"),
                "validated_by": r.get("validated_by"),
                "is_deleted": int(r.get("is_deleted") or 0),
            },
        )

    for r in data["predictions"]:
        pg.execute(
            """
            INSERT INTO predictions (
              user_id, match_id, pick, is_correct, points_awarded, created_at, updated_at
            ) VALUES (
              %(user_id)s, %(match_id)s, %(pick)s, %(is_correct)s, %(points_awarded)s, %(created_at)s, %(updated_at)s
            )
            ON CONFLICT (user_id, match_id) DO UPDATE SET
              pick = EXCLUDED.pick,
              is_correct = EXCLUDED.is_correct,
              points_awarded = EXCLUDED.points_awarded,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
            """,
            r,
        )

    for r in data["store_kv"]:
        value_json = r.get("value_json")
        if isinstance(value_json, str):
            try:
                json.loads(value_json)
            except Exception:
                value_json = json.dumps({})
        else:
            value_json = json.dumps(value_json if value_json is not None else {})

        pg.execute(
            """
            INSERT INTO store_kv (key, value_json, updated_at)
            VALUES (%s, %s, %s)
            ON CONFLICT (key) DO UPDATE SET
              value_json = EXCLUDED.value_json,
              updated_at = EXCLUDED.updated_at
            """,
            (r["key"], value_json, r["updated_at"]),
        )

    for r in data.get("leaderboard_snapshots", []):
        pg.execute(
            """
            INSERT INTO leaderboard_snapshots (date, rows_json, created_at, updated_at)
            VALUES (%(date)s, %(rows_json)s, %(created_at)s, %(updated_at)s)
            ON CONFLICT (date) DO UPDATE SET
              rows_json = EXCLUDED.rows_json,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
            """,
            r,
        )

    for r in data["match_player_stats"]:
        pg.execute(
            """
            INSERT INTO match_player_stats (
              match_id, player_id, runs, catches, runouts, wickets, created_at, updated_at
            ) VALUES (
              %(match_id)s, %(player_id)s, %(runs)s, %(catches)s, %(runouts)s, %(wickets)s, %(created_at)s, %(updated_at)s
            )
            ON CONFLICT (match_id, player_id) DO UPDATE SET
              runs = EXCLUDED.runs,
              catches = EXCLUDED.catches,
              runouts = EXCLUDED.runouts,
              wickets = EXCLUDED.wickets,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at
            """,
            r,
        )

    for r in data["match_player_meta"]:
        pg.execute(
            """
            INSERT INTO match_player_meta (
              match_id, motm_player_id, updated_at
            ) VALUES (
              %(match_id)s, %(motm_player_id)s, %(updated_at)s
            )
            ON CONFLICT (match_id) DO UPDATE SET
              motm_player_id = EXCLUDED.motm_player_id,
              updated_at = EXCLUDED.updated_at
            """,
            r,
        )

    for r in data["activity_feed"]:
        pg.execute(
            """
            INSERT INTO activity_feed (
              id, user_id, username, activity_type, message, created_at
            ) VALUES (
              %(id)s, %(user_id)s, %(username)s, %(activity_type)s, %(message)s, %(created_at)s
            )
            ON CONFLICT (id) DO UPDATE SET
              user_id = EXCLUDED.user_id,
              username = EXCLUDED.username,
              activity_type = EXCLUDED.activity_type,
              message = EXCLUDED.message,
              created_at = EXCLUDED.created_at
            """,
            r,
        )


def main():
    parser = argparse.ArgumentParser(description="Migrate IFL SQLite data to PostgreSQL")
    parser.add_argument("--sqlite-path", default=str(DEFAULT_SQLITE), help="Path to SQLite file")
    parser.add_argument("--pg-url", default=os.getenv("DATABASE_URL", ""), help="PostgreSQL connection URL")
    parser.add_argument("--truncate-first", action="store_true", help="Truncate destination tables before loading")
    args = parser.parse_args()

    if psycopg is None:
        print("Missing dependency: psycopg. Install with: pip3 install psycopg[binary]")
        sys.exit(1)

    sqlite_path = Path(args.sqlite_path)
    if not sqlite_path.exists():
        print(f"SQLite file not found: {sqlite_path}")
        sys.exit(1)

    if not args.pg_url:
        print("Missing PostgreSQL URL. Set --pg-url or DATABASE_URL")
        sys.exit(1)

    data = load_sqlite(sqlite_path)

    with psycopg.connect(args.pg_url) as conn:
        with conn.cursor() as cur:
            create_schema(cur)
            migrate(data, cur, truncate_first=args.truncate_first)
        conn.commit()

    print("Migration complete.")
    print(
        "Rows migrated:",
        f"users={len(data['users'])},",
        f"players={len(data['players'])},",
        f"matches={len(data['matches'])},",
        f"user_players={len(data['user_players'])},",
        f"swap_windows={len(data.get('swap_windows', []))},",
        f"user_swaps={len(data.get('user_swaps', []))},",
        f"predictions={len(data['predictions'])},",
        f"store_kv={len(data['store_kv'])}",
        f"leaderboard_snapshots={len(data.get('leaderboard_snapshots', []))},",
        f"match_player_stats={len(data['match_player_stats'])},",
        f"match_player_meta={len(data['match_player_meta'])},",
        f"activity_feed={len(data['activity_feed'])}",
    )


if __name__ == "__main__":
    main()
