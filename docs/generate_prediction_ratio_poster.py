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
OUT_DIR = ROOT / "docs" / "prediction_posters"
DEFAULT_DATE = "2026-03-28"
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
        total_users = int(conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] or 0)
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
            picks = conn.execute(
                """
                SELECT pick, COUNT(*) AS picks
                FROM predictions
                WHERE match_id=?
                GROUP BY pick
                """,
                (int(match["id"]),),
            ).fetchall()
            pick_map = {row["pick"]: int(row["picks"]) for row in picks}
            a = pick_map.get(match["team_a_abbr"], 0)
            b = pick_map.get(match["team_b_abbr"], 0)
            pending = max(total_users - a - b, 0)
            snapshots.append(
                {
                    "total_users": total_users,
                    "match": dict(match),
                    "counts": {match["team_a_abbr"]: a, match["team_b_abbr"]: b, "PENDING": pending},
                }
            )
        return snapshots
    finally:
        conn.close()


def fit_text(c, text, font_name, max_size, min_size, width):
    size = max_size
    while size > min_size and stringWidth(text, font_name, size) > width:
        size -= 1
    return size


def pct(count, total):
    return 0 if total <= 0 else round((count / total) * 100)


def draw_round_rect(c, x, y, w, h, r, fill, stroke=None):
    c.setFillColor(fill)
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(1)
        c.roundRect(x, y, w, h, r, fill=1, stroke=1)
    else:
        c.roundRect(x, y, w, h, r, fill=1, stroke=0)


def draw_poster(snapshot, target_date=DEFAULT_DATE, suffix=""):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    m = snapshot["match"]
    total = snapshot["total_users"]
    team_a = m["team_a_abbr"]
    team_b = m["team_b_abbr"]
    count_a = snapshot["counts"][team_a]
    count_b = snapshot["counts"][team_b]
    pending = snapshot["counts"]["PENDING"]
    suffix_part = f"_{suffix}" if suffix else ""
    out_pdf = OUT_DIR / f"prediction_ratio_{target_date}{suffix_part}.pdf"
    out_html = OUT_DIR / f"prediction_ratio_{target_date}{suffix_part}.html"

    c = canvas.Canvas(str(out_pdf), pagesize=(PAGE_W, PAGE_H))
    c.setFillColor(colors.HexColor("#07111f"))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(colors.Color(0.72, 0.1, 0.18, 0.15))
    c.circle(120, PAGE_H - 80, 150, fill=1, stroke=0)
    c.setFillColor(colors.Color(0.97, 0.45, 0.12, 0.14))
    c.circle(PAGE_W - 120, PAGE_H - 60, 170, fill=1, stroke=0)

    draw_round_rect(c, 28, 28, PAGE_W - 56, PAGE_H - 56, 28, colors.Color(0.05, 0.10, 0.18, 0.96), stroke=colors.Color(1, 1, 1, 0.10))

    c.setFillColor(colors.HexColor("#ffbe0b"))
    c.setFont("Helvetica-Bold", 10)
    c.drawString(54, PAGE_H - 62, "CHAI PE CHARCHA")
    c.setFillColor(colors.white)
    title = "Today's Prediction Ratio"
    c.setFont("Helvetica-Bold", 34)
    c.drawString(54, PAGE_H - 100, title)

    c.setFillColor(colors.Color(0.77, 0.83, 0.92))
    c.setFont("Helvetica", 14)
    c.drawString(54, PAGE_H - 126, f"{m['match_date']} · {m['team_a']} vs {m['team_b']} · {m['venue']}")

    left_x, top_y = 54, PAGE_H - 250
    card_w, card_h = 285, 220
    gap = 22
    entries = [
        (team_a, count_a, pct(count_a, total), TEAM_COLORS.get(team_a, colors.HexColor('#2563eb'))),
        (team_b, count_b, pct(count_b, total), TEAM_COLORS.get(team_b, colors.HexColor('#f97316'))),
        ("Not Predicted", pending, pct(pending, total), colors.HexColor('#64748b')),
    ]
    for idx, (label, count, percent, fill) in enumerate(entries):
        x = left_x + idx * (card_w + gap)
        draw_round_rect(c, x, top_y, card_w, card_h, 24, colors.Color(fill.red, fill.green, fill.blue, 0.20), stroke=colors.Color(1, 1, 1, 0.10))
        c.setFillColor(fill)
        c.circle(x + 26, top_y + card_h - 28, 6, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(x + 42, top_y + card_h - 34, str(label).upper())
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 64)
        c.drawString(x + 20, top_y + 110, str(count))
        c.setFillColor(colors.Color(0.77, 0.83, 0.92))
        c.setFont("Helvetica", 14)
        c.drawString(x + 22, top_y + 80, "users")
        c.setFillColor(colors.HexColor("#ffbe0b"))
        c.setFont("Helvetica-Bold", 28)
        c.drawString(x + 20, top_y + 34, f"{percent}%")
        c.setFillColor(colors.Color(0.77, 0.83, 0.92))
        c.setFont("Helvetica", 12)
        c.drawString(x + 94, top_y + 40, "of total pool")

    bar_x, bar_y, bar_w, bar_h = 54, 150, PAGE_W - 108, 42
    draw_round_rect(c, bar_x, bar_y, bar_w, bar_h, 21, colors.Color(1, 1, 1, 0.06))
    a_w = bar_w * (count_a / total if total else 0)
    b_w = bar_w * (count_b / total if total else 0)
    p_w = bar_w - a_w - b_w
    if a_w > 0:
        draw_round_rect(c, bar_x, bar_y, a_w, bar_h, 21, TEAM_COLORS.get(team_a, colors.HexColor('#2563eb')))
    if b_w > 0:
        draw_round_rect(c, bar_x + a_w, bar_y, b_w, bar_h, 0, TEAM_COLORS.get(team_b, colors.HexColor('#f97316')))
    if p_w > 0:
        draw_round_rect(c, bar_x + a_w + b_w, bar_y, p_w, bar_h, 21, colors.HexColor('#64748b'))

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(54, 210, "How the room is leaning")
    c.setFillColor(colors.Color(0.77, 0.83, 0.92))
    c.setFont("Helvetica", 12)
    leader = team_a if count_a >= count_b else team_b
    margin = abs(count_a - count_b)
    c.drawString(54, 126, f"Current edge: {leader} leads by {margin} prediction{'s' if margin != 1 else ''}. {pending} users have not predicted yet.")

    c.showPage()
    c.save()

    html = f"""<!doctype html>
<html lang=\"en\"><head><meta charset=\"utf-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" /><title>Today's Prediction Ratio</title>
<style>
body{{margin:0;font-family:Inter,system-ui,sans-serif;background:#07111f;color:#eef5ff;padding:24px;background-image:radial-gradient(circle at 15% 10%, rgba(185,28,28,.18), transparent 24%), radial-gradient(circle at 85% 10%, rgba(249,115,22,.14), transparent 26%), linear-gradient(160deg,#06101d,#091427 55%,#050b16);}}
.wrap{{max-width:1040px;margin:0 auto;border:1px solid rgba(255,255,255,.1);border-radius:28px;padding:28px;background:rgba(10,18,32,.96);box-shadow:0 28px 60px rgba(0,0,0,.35)}}
.k{{color:#ffbe0b;font-size:12px;letter-spacing:.22em;text-transform:uppercase;font-weight:700}}
h1{{margin:8px 0 10px;font-size:40px}} .sub{{color:#c3d0e6;margin-bottom:28px}}
.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}} .card{{border-radius:24px;padding:22px;border:1px solid rgba(255,255,255,.08)}}
.n{{font-size:72px;font-weight:900;line-height:1}} .lab{{font-size:14px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}} .pct{{margin-top:18px;color:#ffbe0b;font-size:28px;font-weight:800}}
.bar{{margin-top:26px;height:42px;border-radius:21px;overflow:hidden;background:rgba(255,255,255,.06);display:flex}} .seg{{height:100%}} .foot{{margin-top:16px;color:#c3d0e6}}
@media (max-width:860px){{.grid{{grid-template-columns:1fr}}}}
</style></head><body><div class=\"wrap\"><div class=\"k\">Chai Pe Charcha</div><h1>Today's Prediction Ratio</h1><div class=\"sub\">{m['match_date']} · {m['team_a']} vs {m['team_b']} · {m['venue']}</div><div class=\"grid\">
<div class=\"card\" style=\"background:rgba({int(TEAM_COLORS.get(team_a).red*255)},{int(TEAM_COLORS.get(team_a).green*255)},{int(TEAM_COLORS.get(team_a).blue*255)},.18)\"><div class=\"lab\">{team_a}</div><div class=\"n\">{count_a}</div><div>users</div><div class=\"pct\">{pct(count_a,total)}% of total pool</div></div>
<div class=\"card\" style=\"background:rgba({int(TEAM_COLORS.get(team_b).red*255)},{int(TEAM_COLORS.get(team_b).green*255)},{int(TEAM_COLORS.get(team_b).blue*255)},.18)\"><div class=\"lab\">{team_b}</div><div class=\"n\">{count_b}</div><div>users</div><div class=\"pct\">{pct(count_b,total)}% of total pool</div></div>
<div class=\"card\" style=\"background:rgba(100,116,139,.18)\"><div class=\"lab\">Not Predicted</div><div class=\"n\">{pending}</div><div>users</div><div class=\"pct\">{pct(pending,total)}% of total pool</div></div>
</div><div class=\"bar\"><div class=\"seg\" style=\"width:{pct(count_a,total)}%;background:{TEAM_COLORS.get(team_a)}\"></div><div class=\"seg\" style=\"width:{pct(count_b,total)}%;background:{TEAM_COLORS.get(team_b)}\"></div><div class=\"seg\" style=\"width:{pct(pending,total)}%;background:#64748b\"></div></div><div class=\"foot\">Current edge: {leader} leads by {margin} prediction{'s' if margin != 1 else ''}. {pending} users have not predicted yet.</div></div></body></html>"""
    out_html.write_text(html, encoding='utf-8')
    return out_html, out_pdf


def main():
    import sys
    target_date = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DATE
    snapshots = fetch_snapshots(target_date)
    multi = len(snapshots) > 1
    for snap in snapshots:
        match_id = snap["match"].get("id")
        suffix = f"match-{match_id}" if multi else ""
        html_path, pdf_path = draw_poster(snap, target_date, suffix=suffix)
        print(html_path)
        print(pdf_path)


if __name__ == '__main__':
    main()
