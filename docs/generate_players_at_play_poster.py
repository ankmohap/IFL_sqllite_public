#!/usr/bin/env python3
from __future__ import annotations

import sqlite3
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "server" / "data" / "ifl.sqlite3"
OUT_DIR = ROOT / "docs" / "players_at_play_posters"
DEFAULT_DATE = "2026-03-29"
PAGE_W, PAGE_H = landscape((1080, 720))

TEAM_COLORS = {
    "RCB": colors.HexColor("#b91c1c"),
    "SRH": colors.HexColor("#f97316"),
    "MI": colors.HexColor("#2563eb"),
    "KKR": colors.HexColor("#5b2c83"),
    "RR": colors.HexColor("#ec4899"),
    "CSK": colors.HexColor("#f7b500"),
    "GT": colors.HexColor("#0f3d7a"),
    "PBKS": colors.HexColor("#d7263d"),
    "DC": colors.HexColor("#2563eb"),
    "LSG": colors.HexColor("#1da1f2"),
}


def fetch_snapshots(target_date=DEFAULT_DATE):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        base_rows = conn.execute(
            """
            SELECT up.user_id, up.player_id
            FROM user_players up
            WHERE COALESCE(up.is_deleted, 0) = 0
            """
        ).fetchall()
        base_squads = {}
        for row in base_rows:
            base_squads.setdefault(int(row["user_id"]), set()).add(int(row["player_id"]))

        swap_rows = conn.execute(
            """
            SELECT
              us.user_id,
              sw.effective_match_id,
              us.out_player_id,
              us.in_player_id
            FROM user_swaps us
            JOIN swap_windows sw ON sw.id = us.window_id
            WHERE COALESCE(us.is_deleted, 0) = 0
              AND COALESCE(us.is_validated, 0) = 1
              AND COALESCE(us.is_frozen, 0) = 1
            ORDER BY us.user_id, sw.effective_match_id, us.id
            """
        ).fetchall()
        swaps_by_user = {}
        for row in swap_rows:
            swaps_by_user.setdefault(int(row["user_id"]), []).append(
                {
                    "eff": int(row["effective_match_id"] or 0),
                    "out": int(row["out_player_id"]),
                    "in": int(row["in_player_id"]),
                }
            )

        user_rows = conn.execute(
            """
            SELECT id, username, COALESCE(NULLIF(team_name,''), username) AS team_name
            FROM users
            """
        ).fetchall()
        user_meta = {
            int(row["id"]): {
                "username": str(row["username"] or ""),
                "team_name": str(row["team_name"] or row["username"] or ""),
            }
            for row in user_rows
        }

        player_rows = conn.execute(
            """
            SELECT id, team, name, role
            FROM players
            """
        ).fetchall()
        player_by_id = {int(row["id"]): dict(row) for row in player_rows}

        matches = conn.execute(
            """
            SELECT id, match_date, team_a, team_a_abbr, team_b, team_b_abbr, venue
            FROM matches
            WHERE substr(match_date,1,10)=?
            ORDER BY match_date
            """,
            (target_date,),
        ).fetchall()
        if not matches:
            raise SystemExit(f"No match found for {target_date}")
        snapshots = []
        for match in matches:
            match_id = int(match["id"])
            player_owner_map = {}
            no_team_a_users = []
            no_team_b_users = []
            for user_id, base_ids in base_squads.items():
                effective_ids = set(base_ids)
                for swap in swaps_by_user.get(user_id, []):
                    if int(swap["eff"]) <= match_id:
                        effective_ids.discard(int(swap["out"]))
                        effective_ids.add(int(swap["in"]))
                team_a_pick_count = 0
                team_b_pick_count = 0
                for pid in effective_ids:
                    player = player_by_id.get(int(pid))
                    if not player:
                        continue
                    if player["team"] not in {match["team_a_abbr"], match["team_b_abbr"]}:
                        continue
                    if player["team"] == match["team_a_abbr"]:
                        team_a_pick_count += 1
                    if player["team"] == match["team_b_abbr"]:
                        team_b_pick_count += 1
                    bucket = player_owner_map.setdefault(
                        int(pid),
                        {
                            "id": int(pid),
                            "team": str(player["team"]),
                            "name": str(player["name"]),
                            "role": str(player["role"]),
                            "picked_by": 0,
                            "owners": [],
                        },
                    )
                    bucket["picked_by"] += 1
                    owner_name = user_meta.get(int(user_id), {}).get("team_name") or user_meta.get(int(user_id), {}).get("username") or ""
                    if owner_name:
                        bucket["owners"].append(owner_name)
                meta = user_meta.get(int(user_id), {})
                display_name = meta.get("team_name") or meta.get("username") or f"User {user_id}"
                if team_a_pick_count == 0:
                    no_team_a_users.append(str(display_name))
                if team_b_pick_count == 0:
                    no_team_b_users.append(str(display_name))

            rows = []
            for row in player_owner_map.values():
                owner = ""
                if int(row.get("picked_by") or 0) == 1:
                    owner = (row.get("owners") or [""])[0]
                rows.append(
                    {
                        "id": row["id"],
                        "team": row["team"],
                        "name": row["name"],
                        "role": row["role"],
                        "picked_by": row["picked_by"],
                        "owner": owner,
                    }
                )
            rows.sort(key=lambda r: (r["team"], -int(r["picked_by"] or 0), r["name"]))
            no_team_a_users.sort(key=str.lower)
            no_team_b_users.sort(key=str.lower)
            snapshots.append(
                {
                    "match": dict(match),
                    "players": rows,
                    "no_team_a_users": no_team_a_users,
                    "no_team_b_users": no_team_b_users,
                }
            )
        return snapshots
    finally:
        conn.close()


def draw_round_rect(c, x, y, w, h, r, fill, stroke=None):
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(1)
        c.roundRect(x, y, w, h, r, fill=1, stroke=1)
    else:
        c.roundRect(x, y, w, h, r, fill=1, stroke=0)


def fit_text(c, text, font_name, max_size, min_size, width):
    size = max_size
    while size > min_size and stringWidth(text, font_name, size) > width:
        size -= 1
    return size


def draw_column(c, x, y, w, h, team_abbr, team_name, rows, no_team_users):
    fill = TEAM_COLORS.get(team_abbr, colors.HexColor("#1f3a5a"))
    draw_round_rect(c, x, y, w, h, 24, colors.Color(fill.red, fill.green, fill.blue, 0.18), stroke=colors.Color(1, 1, 1, 0.10))
    c.setFillColor(fill)
    c.circle(x + 22, y + h - 24, 6, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(x + 38, y + h - 30, f"{team_abbr} · {team_name}")
    c.setFillColor(colors.Color(0.77, 0.83, 0.92))
    c.setFont("Helvetica", 11)
    c.drawString(x + 22, y + h - 52, f"{len(rows)} active fantasy picks from all squads")

    yy = y + h - 84
    for row in rows:
        draw_round_rect(c, x + 16, yy - 28, w - 32, 34, 14, colors.Color(1, 1, 1, 0.05))
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", fit_text(c, row['name'], "Helvetica-Bold", 12, 9, w - 130))
        c.drawString(x + 28, yy - 9, row["name"])
        c.setFillColor(colors.Color(0.77, 0.83, 0.92))
        c.setFont("Helvetica", 10)
        c.drawString(x + w - 108, yy - 9, row["role"])
        right_text = f"{row['picked_by']} squads"
        if int(row.get("picked_by") or 0) == 1 and row.get("owner"):
            right_text = f"Only: {row['owner']}"
        c.setFillColor(colors.HexColor("#ffbe0b"))
        c.setFont("Helvetica-Bold", fit_text(c, right_text, "Helvetica-Bold", 10, 7, 120))
        c.drawRightString(x + w - 28, yy - 9, right_text)
        yy -= 40
        if yy < y + 86:
            break

    footer_y = y + 18
    draw_round_rect(c, x + 16, footer_y, w - 32, 52, 14, colors.Color(1, 1, 1, 0.05))
    c.setFillColor(colors.HexColor("#ffbe0b"))
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x + 28, footer_y + 34, f"No {team_abbr} player in squad")
    c.setFillColor(colors.Color(0.77, 0.83, 0.92))
    c.setFont("Helvetica", 9)
    text = ", ".join(no_team_users[:4]) if no_team_users else f"Every squad has at least one {team_abbr} player."
    if len(no_team_users) > 4:
        text += f" +{len(no_team_users) - 4} more"
    c.drawString(x + 28, footer_y + 18, text[:64])


def render(snapshot, target_date=DEFAULT_DATE, suffix=""):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    m = snapshot["match"]
    players = snapshot["players"]
    no_team_a_users = snapshot.get("no_team_a_users", [])
    no_team_b_users = snapshot.get("no_team_b_users", [])
    a_rows = [p for p in players if p["team"] == m["team_a_abbr"]]
    b_rows = [p for p in players if p["team"] == m["team_b_abbr"]]
    suffix_part = f"_{suffix}" if suffix else ""
    out_pdf = OUT_DIR / f"players_at_play_{target_date}{suffix_part}.pdf"
    out_html = OUT_DIR / f"players_at_play_{target_date}{suffix_part}.html"

    c = canvas.Canvas(str(out_pdf), pagesize=(PAGE_W, PAGE_H))
    c.setFillColor(colors.HexColor("#07111f"))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(colors.Color(0.15, 0.35, 0.75, 0.12))
    c.circle(120, PAGE_H - 80, 160, fill=1, stroke=0)
    c.setFillColor(colors.Color(0.35, 0.15, 0.55, 0.14))
    c.circle(PAGE_W - 140, PAGE_H - 60, 160, fill=1, stroke=0)

    draw_round_rect(c, 28, 28, PAGE_W - 56, PAGE_H - 56, 28, colors.Color(0.05, 0.10, 0.18, 0.96), stroke=colors.Color(1, 1, 1, 0.10))
    c.setFillColor(colors.HexColor("#ffbe0b"))
    c.setFont("Helvetica-Bold", 10)
    c.drawString(54, PAGE_H - 62, "MY TEAM INSIGHT")
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 34)
    c.drawString(54, PAGE_H - 100, "Players At Play Today")
    c.setFillColor(colors.Color(0.77, 0.83, 0.92))
    c.setFont("Helvetica", 14)
    c.drawString(54, PAGE_H - 126, f"{m['match_date']} · {m['team_a']} vs {m['team_b']} · {m['venue']}")

    draw_column(c, 54, 92, 456, 500, m["team_a_abbr"], m["team_a"], a_rows, no_team_a_users)
    draw_column(c, 570, 92, 456, 500, m["team_b_abbr"], m["team_b"], b_rows, no_team_b_users)

    c.showPage()
    c.save()

    def html_rows(rows):
        return "".join(
            f"<div class='row'><div class='nm'>{r['name']}</div><div class='meta'>{r['role']}</div><div class='pk'>{('Only: ' + r['owner']) if int(r.get('picked_by') or 0) == 1 and r.get('owner') else (str(r['picked_by']) + ' squads')}</div></div>"
            for r in rows
        )

    def no_team_html(team_abbr, names):
        if not names:
            return f"<span class='np-empty'>Every squad has at least one {team_abbr} player.</span>"
        return "".join(f"<span class='np-tag'>{name}</span>" for name in names)

    html = f"""<!doctype html>
<html lang=\"en\"><head><meta charset=\"utf-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" /><title>Players At Play Today</title>
<style>
body{{margin:0;font-family:Inter,system-ui,sans-serif;background:#07111f;color:#eef5ff;padding:24px;background-image:radial-gradient(circle at 15% 10%, rgba(37,99,235,.16), transparent 24%), radial-gradient(circle at 85% 10%, rgba(91,44,131,.16), transparent 26%), linear-gradient(160deg,#06101d,#091427 55%,#050b16);}}
.wrap{{max-width:1080px;margin:0 auto;border:1px solid rgba(255,255,255,.1);border-radius:28px;padding:28px;background:rgba(10,18,32,.96);box-shadow:0 28px 60px rgba(0,0,0,.35)}}
.k{{color:#ffbe0b;font-size:12px;letter-spacing:.22em;text-transform:uppercase;font-weight:700}}
h1{{margin:8px 0 10px;font-size:40px}} .sub{{color:#c3d0e6;margin-bottom:28px}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:24px}} .col{{border-radius:24px;padding:20px;border:1px solid rgba(255,255,255,.1)}} .hdr{{font-size:22px;font-weight:800;margin-bottom:8px}} .mini{{color:#c3d0e6;font-size:12px;margin-bottom:16px}}
.row{{display:grid;grid-template-columns:1fr 56px 90px;gap:10px;align-items:center;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.05);margin-bottom:10px}}
.nm{{font-weight:700}} .meta{{color:#c3d0e6;font-size:12px}} .pk{{color:#ffbe0b;font-weight:700;font-size:12px;text-align:right}}
.np{{margin-top:16px;border-radius:16px;padding:12px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}} .np-h{{font-size:13px;font-weight:800;margin-bottom:8px;color:#ffd166}} .np-list{{display:flex;flex-wrap:wrap;gap:8px}} .np-tag{{display:inline-flex;padding:7px 10px;border-radius:999px;background:rgba(255,190,11,.12);border:1px solid rgba(255,190,11,.2);color:#ffd166;font-size:12px;font-weight:700}} .np-empty{{color:#c3d0e6;font-size:13px}}
@media (max-width:860px){{.grid{{grid-template-columns:1fr}}}}
</style></head><body><div class=\"wrap\"><div class=\"k\">My Team Insight</div><h1>Players At Play Today</h1><div class=\"sub\">{m['match_date']} · {m['team_a']} vs {m['team_b']} · {m['venue']}</div><div class=\"grid\"><div class=\"col\" style=\"background:rgba({int(TEAM_COLORS[m['team_a_abbr']].red*255)},{int(TEAM_COLORS[m['team_a_abbr']].green*255)},{int(TEAM_COLORS[m['team_a_abbr']].blue*255)},.18)\"><div class=\"hdr\">{m['team_a_abbr']} · {m['team_a']}</div><div class=\"mini\">{len(a_rows)} active fantasy picks from all squads</div>{html_rows(a_rows)}<div class=\"np\"><div class=\"np-h\">No {m['team_a_abbr']} Player In Squad</div><div class=\"np-list\">{no_team_html(m['team_a_abbr'], no_team_a_users)}</div></div></div><div class=\"col\" style=\"background:rgba({int(TEAM_COLORS[m['team_b_abbr']].red*255)},{int(TEAM_COLORS[m['team_b_abbr']].green*255)},{int(TEAM_COLORS[m['team_b_abbr']].blue*255)},.18)\"><div class=\"hdr\">{m['team_b_abbr']} · {m['team_b']}</div><div class=\"mini\">{len(b_rows)} active fantasy picks from all squads</div>{html_rows(b_rows)}<div class=\"np\"><div class=\"np-h\">No {m['team_b_abbr']} Player In Squad</div><div class=\"np-list\">{no_team_html(m['team_b_abbr'], no_team_b_users)}</div></div></div></div></div></body></html>"""
    out_html.write_text(html, encoding="utf-8")
    return out_html, out_pdf


def main():
    import sys
    target_date = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DATE
    snapshots = fetch_snapshots(target_date)
    multi = len(snapshots) > 1
    for snap in snapshots:
        match_id = snap["match"].get("id")
        suffix = f"match-{match_id}" if multi else ""
        html_path, pdf_path = render(snap, target_date, suffix=suffix)
        print(html_path)
        print(pdf_path)


if __name__ == "__main__":
    main()
