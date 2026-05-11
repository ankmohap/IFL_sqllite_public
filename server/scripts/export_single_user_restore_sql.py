#!/usr/bin/env python3
import argparse
import sqlite3
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE = ROOT / "server" / "data" / "ifl.sqlite3"


def sql_literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("'", "''")
    return f"'{text}'"


def fetch_one(conn, sql, params):
    row = conn.execute(sql, params).fetchone()
    return dict(row) if row else None


def fetch_all(conn, sql, params):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def render_insert(table, row, conflict_cols=None, update_cols=None):
    cols = list(row.keys())
    values = ", ".join(sql_literal(row[c]) for c in cols)
    sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({values})"
    if conflict_cols:
        updates = update_cols or [c for c in cols if c not in conflict_cols]
        if updates:
            update_sql = ", ".join(f"{c} = EXCLUDED.{c}" for c in updates)
            sql += f" ON CONFLICT ({', '.join(conflict_cols)}) DO UPDATE SET {update_sql}"
        else:
            sql += f" ON CONFLICT ({', '.join(conflict_cols)}) DO NOTHING"
    return sql + ";"


def build_sql(conn, username: str, include_delete: bool):
    user = fetch_one(conn, "SELECT * FROM users WHERE username = ?", (username,))
    if not user:
        raise SystemExit(f"User not found in SQLite: {username}")

    user_id = int(user["id"])
    user_players = fetch_all(conn, "SELECT * FROM user_players WHERE user_id = ? ORDER BY player_id", (user_id,))
    predictions = fetch_all(conn, "SELECT * FROM predictions WHERE user_id = ? ORDER BY match_id", (user_id,))

    lines = []
    lines.append("-- Single-user restore SQL generated from SQLite")
    lines.append(f"-- username: {username}")
    lines.append(f"-- user_id: {user_id}")
    lines.append("")
    lines.append("BEGIN;")
    if include_delete:
        lines.append(f"DELETE FROM predictions WHERE user_id = {user_id};")
        lines.append(f"DELETE FROM user_players WHERE user_id = {user_id};")
        lines.append(f"DELETE FROM users WHERE id = {user_id} OR username = {sql_literal(username)};")
        lines.append("")

    lines.append(render_insert("users", user, conflict_cols=["id"]))
    lines.append("")
    for row in user_players:
        lines.append(
            render_insert(
                "user_players",
                row,
                conflict_cols=["user_id", "player_id"],
            )
        )
    if user_players:
        lines.append("")
    for row in predictions:
        lines.append(
            render_insert(
                "predictions",
                row,
                conflict_cols=["user_id", "match_id"],
            )
        )
    lines.append("COMMIT;")
    lines.append("")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description="Export restore SQL for a single user from SQLite")
    ap.add_argument("username", help="User phone/username to export")
    ap.add_argument("--sqlite", default=str(DEFAULT_SQLITE), help="Path to SQLite DB")
    ap.add_argument("--out", default="", help="Optional output .sql file path")
    ap.add_argument("--no-delete", action="store_true", help="Do not emit delete statements before inserts")
    args = ap.parse_args()

    conn = sqlite3.connect(args.sqlite)
    conn.row_factory = sqlite3.Row
    try:
        sql = build_sql(conn, args.username, include_delete=not args.no_delete)
    finally:
        conn.close()

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(sql, encoding="utf-8")
        print(out_path)
    else:
        sys.stdout.write(sql)


if __name__ == "__main__":
    main()
