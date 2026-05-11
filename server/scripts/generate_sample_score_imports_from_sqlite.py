#!/usr/bin/env python3
import argparse
import json
import random
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SQLITE = ROOT / "server" / "data" / "ifl.sqlite3"
DEFAULT_OUT = ROOT / "server" / "data" / "sample_points_import_12_matches_latest_players.json"

TEAM_ALIAS = {
    "KXIP": "PBKS",
}

POINTS = {
    "RUN": 1,
    "CATCH": 5,
    "RUNOUT": 10,
    "WICKET": 20,
    "BONUS3W": 25,
    "BONUS5W": 50,
    "BONUS50": 25,
    "BONUS75": 50,
    "BONUS100": 100,
}


def score(stat):
    runs = int(stat.get("runs", 0))
    catches = int(stat.get("catches", 0))
    runouts = int(stat.get("runouts", 0))
    wickets = int(stat.get("wickets", 0))

    bonus_runs = 0
    if runs >= 100:
        bonus_runs = POINTS["BONUS100"]
    elif runs >= 75:
        bonus_runs = POINTS["BONUS75"]
    elif runs >= 50:
        bonus_runs = POINTS["BONUS50"]

    bonus_wk = 0
    if wickets >= 5:
        bonus_wk = POINTS["BONUS5W"]
    elif wickets >= 3:
        bonus_wk = POINTS["BONUS3W"]

    return (
        runs * POINTS["RUN"]
        + catches * POINTS["CATCH"]
        + runouts * POINTS["RUNOUT"]
        + wickets * POINTS["WICKET"]
        + bonus_runs
        + bonus_wk
    )


def pick_stat(role, rng):
    role = (role or "").upper()
    if role == "BOWL":
        runs = rng.randint(0, 18)
        wickets = rng.choices([0, 1, 2, 3, 4, 5], [22, 28, 24, 16, 8, 2])[0]
    elif role == "ALL":
        runs = rng.choices([0, 8, 15, 25, 35, 45, 60, 80], [8, 12, 17, 21, 19, 12, 8, 3])[0]
        wickets = rng.choices([0, 1, 2, 3, 4], [18, 34, 30, 14, 4])[0]
    elif role == "WK":
        runs = rng.choices([0, 5, 12, 22, 35, 48, 65, 85, 105], [6, 10, 14, 18, 18, 14, 10, 7, 3])[0]
        wickets = 0
    else:  # BAT + fallback
        runs = rng.choices([0, 4, 10, 18, 28, 40, 55, 72, 95, 112], [7, 10, 13, 16, 16, 14, 11, 7, 4, 2])[0]
        wickets = rng.choices([0, 1], [96, 4])[0]

    catches = rng.choices([0, 1, 2, 3], [62, 28, 9, 1])[0]
    runouts = rng.choices([0, 1, 2], [88, 11, 1])[0]

    return {
        "runs": int(runs),
        "catches": int(catches),
        "runouts": int(runouts),
        "wickets": int(wickets),
    }


def main():
    p = argparse.ArgumentParser(description="Generate sample score imports from SQLite master data")
    p.add_argument("--sqlite-path", default=str(DEFAULT_SQLITE))
    p.add_argument("--out", default=str(DEFAULT_OUT))
    p.add_argument("--players-per-team", type=int, default=6)
    args = p.parse_args()

    sqlite_path = Path(args.sqlite_path)
    out_path = Path(args.out)

    con = sqlite3.connect(sqlite_path)
    con.row_factory = sqlite3.Row
    try:
        matches = list(
            con.execute(
                """
                SELECT id, match_date, team_a_abbr, team_b_abbr, winner
                FROM matches
                ORDER BY id
                """
            )
        )
        players = list(
            con.execute(
                """
                SELECT id, team, name, role
                FROM players
                ORDER BY id
                """
            )
        )
    finally:
        con.close()

    by_team = {}
    for pl in players:
        by_team.setdefault((pl["team"] or "").upper(), []).append(pl)

    payload = {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": str(sqlite_path),
        "description": "Sample score imports generated from latest SQLite master players + matches.",
        "matchImports": {},
    }

    npt = max(1, int(args.players_per_team))

    for m in matches:
        mid = int(m["id"])
        rng = random.Random(mid * 10007)

        a = (m["team_a_abbr"] or "").upper()
        b = (m["team_b_abbr"] or "").upper()
        ta = TEAM_ALIAS.get(a, a)
        tb = TEAM_ALIAS.get(b, b)

        pool_a = by_team.get(ta, [])
        pool_b = by_team.get(tb, [])

        chosen_a = rng.sample(pool_a, k=min(npt, len(pool_a))) if pool_a else []
        chosen_b = rng.sample(pool_b, k=min(npt, len(pool_b))) if pool_b else []
        chosen = chosen_a + chosen_b

        rows = []
        best_name = ""
        best_pts = -1
        for pl in chosen:
            stat = pick_stat(pl["role"], rng)
            pts = score(stat)
            if pts > best_pts:
                best_pts = pts
                best_name = pl["name"]
            rows.append({
                "name": pl["name"],
                "runs": stat["runs"],
                "catches": stat["catches"],
                "runouts": stat["runouts"],
                "wickets": stat["wickets"],
            })

        winner = (m["winner"] or "").upper()
        if winner not in {a, b}:
            winner = a if rng.random() < 0.5 else b

        payload["matchImports"][str(mid)] = {
            "winner": winner,
            "motm": best_name,
            "players": rows,
        }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Generated: {out_path}")
    print(f"Matches: {len(payload['matchImports'])}")


if __name__ == "__main__":
    main()
