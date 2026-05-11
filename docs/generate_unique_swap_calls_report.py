#!/usr/bin/env python3
from __future__ import annotations

import sqlite3
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "server" / "data" / "ifl.sqlite3"
OUT_DIR = ROOT / "docs" / "prediction_posters"
PAGE_W, PAGE_H = A4


def fit_text(text: str, font_name: str, max_size: int, min_size: int, width: float) -> int:
    size = max_size
    while size > min_size and stringWidth(text, font_name, size) > width:
        size -= 1
    return size


def fetch_unique_groups() -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT
              us.user_id,
              us.window_id,
              COALESCE(NULLIF(u.team_name, ''), u.username) AS team_name,
              COALESCE(sw.name, 'Window ' || us.window_id) AS window_name,
              COALESCE(sw.effective_match_id, us.effective_match_id, 0) AS effective_match_id,
              po.name AS out_name,
              po.role AS out_role,
              po.country AS out_country,
              pi.name AS in_name,
              pi.role AS in_role,
              pi.country AS in_country
            FROM user_swaps us
            JOIN users u ON u.id = us.user_id
            LEFT JOIN swap_windows sw ON sw.id = us.window_id
            LEFT JOIN players po ON po.id = us.out_player_id
            LEFT JOIN players pi ON pi.id = us.in_player_id
            WHERE COALESCE(us.is_deleted, 0) = 0
            ORDER BY us.window_id, lower(COALESCE(NULLIF(u.team_name, ''), u.username)), us.id
            """
        ).fetchall()
    finally:
        conn.close()

    grouped: dict[tuple[int, int], dict] = {}
    combo_map: dict[tuple[str, ...], list[tuple[int, int]]] = defaultdict(list)

    for row in rows:
        key = (int(row["user_id"]), int(row["window_id"]))
        group = grouped.setdefault(
            key,
            {
                "team_name": str(row["team_name"] or ""),
                "window_name": str(row["window_name"] or ""),
                "effective_match_id": int(row["effective_match_id"] or 0),
                "swaps": [],
                "bowlers_out": 0,
                "bowlers_in": 0,
                "intl_out": 0,
                "intl_in": 0,
            },
        )
        out_name = str(row["out_name"] or "-")
        in_name = str(row["in_name"] or "-")
        out_role = str(row["out_role"] or "-")
        in_role = str(row["in_role"] or "-")
        out_country = str(row["out_country"] or "-")
        in_country = str(row["in_country"] or "-")
        group["swaps"].append(f"{out_name} -> {in_name}")
        if out_role.upper() == "BOWL":
            group["bowlers_out"] += 1
        if in_role.upper() == "BOWL":
            group["bowlers_in"] += 1
        if out_country.lower() not in {"india", "indian"}:
            group["intl_out"] += 1
        if in_country.lower() not in {"india", "indian"}:
            group["intl_in"] += 1

    for key, group in grouped.items():
        combo = tuple(sorted(group["swaps"]))
        combo_map[combo].append(key)

    unique_groups = []
    for key, group in grouped.items():
        combo = tuple(sorted(group["swaps"]))
        if len(combo_map[combo]) == 1:
            unique_groups.append(group)

    unique_groups.sort(key=lambda g: g["team_name"].lower())
    return unique_groups


def render_html(groups: list[dict], out_html: Path) -> None:
    generated_at = datetime.now().strftime("%d %b %Y, %I:%M %p")
    cards = []
    for idx, g in enumerate(groups, start=1):
        swap_chips = "".join(f'<span class="chip">{s}</span>' for s in g["swaps"])
        cards.append(
            f"""
            <article class="card">
              <div class="card-top">
                <div>
                  <div class="overline">#{idx} · {g['window_name']}</div>
                  <h3>{g['team_name']}</h3>
                  <div class="meta">Effective from match {g['effective_match_id'] or '-'}</div>
                </div>
                <div class="badge">Unique</div>
              </div>
              <div class="chips">{swap_chips}</div>
              <div class="stats">
                <div class="stat"><span>Bowlers</span><strong>{g['bowlers_out']} out / {g['bowlers_in']} in</strong></div>
                <div class="stat"><span>International</span><strong>{g['intl_out']} out / {g['intl_in']} in</strong></div>
              </div>
            </article>
            """
        )

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unique Swap Calls</title>
  <style>
    body {{
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #162033;
      background:
        radial-gradient(circle at top left, rgba(255,255,255,.08), transparent 22%),
        linear-gradient(145deg, #1b2637 0%, #25364f 55%, #1b2637 100%);
    }}
    .wrap {{ max-width: 1040px; margin: 0 auto; padding: 28px; }}
    .hero {{
      background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(243,247,252,.92));
      border-radius: 24px;
      padding: 26px 28px;
      box-shadow: 0 26px 60px rgba(7,17,31,.22);
    }}
    .eyebrow {{ font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color: #d97706; font-weight: 800; }}
    h1 {{ margin: 10px 0 6px; font-size: 36px; }}
    .sub {{ color: #5d6d84; font-size: 14px; }}
    .summary {{
      margin-top: 16px;
      display: inline-flex;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(15,23,42,.06);
      color: #334155;
      font-size: 13px;
      font-weight: 700;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      margin-top: 18px;
    }}
    .card {{
      background: rgba(247,250,252,.97);
      border-radius: 20px;
      padding: 18px;
      box-shadow: 0 16px 34px rgba(7,17,31,.16);
    }}
    .card-top {{ display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }}
    .overline {{ font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #607189; font-weight: 800; }}
    h3 {{ margin: 4px 0 6px; font-size: 24px; line-height: 1.1; }}
    .meta {{ color: #607189; font-size: 13px; }}
    .badge {{
      white-space: nowrap;
      background: rgba(249,115,22,.12);
      color: #c2410c;
      border: 1px solid rgba(249,115,22,.22);
      padding: 8px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
    }}
    .chips {{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }}
    .chip {{
      display: inline-flex;
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(15,23,42,.06);
      border: 1px solid rgba(15,23,42,.08);
      color: #334155;
      font-size: 12px;
      font-weight: 700;
    }}
    .stats {{
      margin-top: 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }}
    .stat {{
      border-radius: 14px;
      background: rgba(255,255,255,.72);
      border: 1px solid #dbe4ef;
      padding: 10px 12px;
    }}
    .stat span {{ display: block; font-size: 12px; color: #607189; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }}
    .stat strong {{ display: block; margin-top: 6px; font-size: 14px; color: #10213d; }}
    .foot {{ margin-top: 16px; color: rgba(255,255,255,.72); font-size: 12px; }}
    @media (max-width: 700px) {{
      .stats {{ grid-template-columns: 1fr; }}
      .card-top {{ flex-direction: column; }}
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">IFL 2026</div>
      <h1>Unique Swap Calls</h1>
      <div class="sub">A compact view of the teams whose full swap combinations are currently one of one. Generated on {generated_at}.</div>
      <div class="summary">{len(groups)} unique swap combinations</div>
    </section>
    <section class="grid">
      {''.join(cards) if cards else '<article class="card"><h3>No unique swap calls found</h3></article>'}
    </section>
    <div class="foot">Source: user_swaps, swap_windows, users, and players.</div>
  </div>
</body>
</html>
"""
    out_html.write_text(html, encoding="utf-8")


def render_pdf(groups: list[dict], out_pdf: Path) -> None:
    c = canvas.Canvas(str(out_pdf), pagesize=A4)

    def draw_page_bg():
        c.setFillColor(colors.HexColor("#1b2637"))
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        c.setFillColor(colors.Color(1, 1, 1, 0.06))
        c.circle(60, PAGE_H - 30, 90, fill=1, stroke=0)
        c.setFillColor(colors.Color(0.96, 0.62, 0.04, 0.08))
        c.circle(PAGE_W - 40, PAGE_H - 10, 120, fill=1, stroke=0)

    def draw_header():
        c.setFillColor(colors.HexColor("#f59e0b"))
        c.setFont("Helvetica-Bold", 10)
        c.drawString(36, PAGE_H - 36, "IFL 2026")
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 22)
        c.drawString(36, PAGE_H - 60, "Unique Swap Calls")
        c.setFillColor(colors.HexColor("#c9d5e5"))
        c.setFont("Helvetica", 10)
        c.drawString(36, PAGE_H - 76, f"{len(groups)} unique swap combinations")

    def new_page():
        draw_page_bg()
        draw_header()

    new_page()
    y = PAGE_H - 104
    card_w = PAGE_W - 72

    for idx, g in enumerate(groups, start=1):
        line_count = len(g["swaps"]) + 3
        card_h = 88 + line_count * 16
        if y - card_h < 34:
            c.showPage()
            new_page()
            y = PAGE_H - 104

        c.setFillColor(colors.white)
        c.roundRect(36, y - card_h, card_w, card_h, 18, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#607189"))
        c.setFont("Helvetica-Bold", 9)
        c.drawString(50, y - 20, f"#{idx} · {g['window_name'].upper()}")
        c.setFillColor(colors.HexColor("#10213d"))
        name_size = fit_text(g["team_name"], "Helvetica-Bold", 16, 11, 350)
        c.setFont("Helvetica-Bold", name_size)
        c.drawString(50, y - 40, g["team_name"])
        c.setFillColor(colors.HexColor("#607189"))
        c.setFont("Helvetica", 9)
        c.drawString(50, y - 56, f"Effective from match {g['effective_match_id'] or '-'}")
        c.setFillColor(colors.HexColor("#c2410c"))
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(PAGE_W - 50, y - 24, "UNIQUE")

        sy = y - 78
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont("Helvetica", 10)
        for swap in g["swaps"]:
            c.drawString(50, sy, f"• {swap}")
            sy -= 15

        c.setFillColor(colors.HexColor("#607189"))
        c.setFont("Helvetica-Bold", 9)
        c.drawString(50, sy - 2, f"Bowlers: {g['bowlers_out']} out / {g['bowlers_in']} in")
        c.drawString(240, sy - 2, f"International: {g['intl_out']} out / {g['intl_in']} in")
        y -= card_h + 12

    c.save()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    groups = fetch_unique_groups()
    out_html = OUT_DIR / "unique_swap_calls.html"
    out_pdf = OUT_DIR / "unique_swap_calls.pdf"
    render_html(groups, out_html)
    render_pdf(groups, out_pdf)
    print(out_html)
    print(out_pdf)


if __name__ == "__main__":
    main()
