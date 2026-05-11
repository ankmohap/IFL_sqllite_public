#!/usr/bin/env python3
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "server" / "data" / "ifl.sqlite3"
OUT_DIR = ROOT / "docs" / "prediction_posters"
TEAM_COLORS = {
    "RCB": "#b91c1c",
    "SRH": "#f97316",
    "MI": "#2563eb",
    "KKR": "#5b2c83",
    "RR": "#ec4899",
    "CSK": "#f7b500",
    "GT": "#0f3d7a",
    "PBKS": "#d7263d",
    "DC": "#2563eb",
    "LSG": "#1da1f2",
}


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def team_color(abbr: str) -> str:
    return TEAM_COLORS.get(abbr, "#94a3b8")


def load_team_map(conn: sqlite3.Connection) -> dict[str, str]:
    rows = conn.execute(
        """
        SELECT team_a_abbr, team_a, team_b_abbr, team_b
        FROM matches
        """,
    ).fetchall()
    team_map: dict[str, str] = {}
    for a_abbr, a_name, b_abbr, b_name in rows:
        if a_abbr and a_name:
            team_map[str(a_abbr)] = str(a_name)
        if b_abbr and b_name:
            team_map[str(b_abbr)] = str(b_name)
    return team_map


def load_users(conn: sqlite3.Connection) -> dict[str, str]:
    rows = conn.execute(
        """
        SELECT username, COALESCE(team_name, username)
        FROM users
        """,
    ).fetchall()
    return {str(u): str(t) for u, t in rows}


def load_predictions(conn: sqlite3.Connection) -> dict[str, list[str]]:
    row = conn.execute(
        "SELECT value_json FROM store_kv WHERE key = ?",
        ("ifl_playoffs_predictions",),
    ).fetchone()
    if not row:
        return {}
    try:
        parsed = json.loads(row[0])
        if isinstance(parsed, dict):
            return {str(k): [str(x) for x in v] for k, v in parsed.items()}
    except json.JSONDecodeError:
        pass
    return {}


def render_html(items: list[dict[str, str]], out_html: Path, date_label: str, team_map: dict[str, str]) -> None:
    combos: dict[tuple[str, ...], list[dict[str, str]]] = {}
    for item in items:
        combo_key = tuple(sorted(p["abbr"] for p in item["picks"]))
        combos.setdefault(combo_key, []).append(item)

    shared = [(k, v) for k, v in combos.items() if len(v) > 1]
    unique = [(k, v) for k, v in combos.items() if len(v) == 1]
    shared.sort(key=lambda kv: len(kv[1]), reverse=True)
    unique.sort(key=lambda kv: kv[1][0]["team_name"].lower())

    def bubble_html(picks):
        if not picks:
            return "<span class=\"pick muted\">No picks</span>"
        parts = []
        for p in picks:
            rgb = hex_to_rgb(team_color(p["abbr"]))
            parts.append(
                f"<span class=\"pick\" style=\"background:rgba({rgb[0]},{rgb[1]},{rgb[2]},.2);border-color:rgba({rgb[0]},{rgb[1]},{rgb[2]},.6);color:{team_color(p['abbr'])}\">{p['name']}</span>"
            )
        return "".join(parts)

    cards = []
    for item in items:
        pick_html = bubble_html(item["picks"])
        cards.append(
            f"""
<article class="card">
  <div class="card-title">{item['team_name']}</div>
  <div class="card-user">{item['username']}</div>
  <div class="card-picks">{pick_html}</div>
</article>
"""
        )

    def combo_block(combos_list, empty_text):
        if not combos_list:
            return f"<div class=\"insight-empty\">{empty_text}</div>"
        rows = []
        for combo_key, holders in combos_list[:8]:
            picks = [{"abbr": abbr, "name": team_map.get(abbr, abbr)} for abbr in combo_key]
            picks_html = bubble_html(picks)
            users = ", ".join(h["team_name"] for h in holders)
            rows.append(
                f"""
<div class="insight-row">
  <div class="insight-picks">{picks_html}</div>
  <div class="insight-users">{users}</div>
</div>
"""
            )
        return "".join(rows)

    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Playoffs Predictions Extract</title>
    <style>
      body {{ margin: 0; font-family: 'Barlow Condensed','Segoe UI',sans-serif; background:linear-gradient(135deg,#e2e8f0 0%,#cfe3ff 45%,#e9d5ff 100%); color:#182438; }}
      .wrap {{ max-width: 1100px; margin: 0 auto; padding: 28px; }}
      .hero {{ background: linear-gradient(135deg,#fef3c7,#fef9c3 55%,#e0f2fe); padding: 26px 28px; border-radius: 18px; border:1px solid #e2e8f0; box-shadow: 0 18px 36px rgba(15,23,42,.08); }}
      .eyebrow {{ font-size: 12px; letter-spacing: .2em; text-transform: uppercase; color:#f59e0b; font-weight: 700; }}
      h1 {{ margin: 10px 0 6px; font-size: 34px; }}
      .sub {{ color: #b6c6e3; font-size: 13px; }}
      .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 22px; }}
      .card {{ background: #ffffff; border:1px solid #e2e8f0; border-radius: 16px; padding: 16px; box-shadow: 0 12px 26px rgba(15,23,42,.08); }}
      .card-title {{ font-size: 18px; font-weight: 700; margin-bottom: 2px; }}
      .card-user {{ font-size: 12px; color:#64748b; margin-bottom: 10px; }}
      .card-picks {{ display:flex; flex-wrap:wrap; gap:8px; }}
      .pick {{ padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; letter-spacing:.04em; border:1px solid; }}
      .pick.muted {{ background: #f1f5f9; color:#64748b; border-color: #e2e8f0; }}
      .foot {{ margin-top: 18px; font-size: 12px; color:#64748b; }}
      .insights {{ margin-top: 20px; display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px; }}
      .insight-card {{ background: #ffffff; border:1px solid #e2e8f0; border-radius: 16px; padding: 16px; box-shadow: 0 12px 26px rgba(15,23,42,.06); }}
      .insight-title {{ font-size: 16px; font-weight: 700; margin-bottom: 10px; }}
      .insight-row {{ border-top:1px dashed #e2e8f0; padding-top:10px; margin-top:10px; display:flex; flex-direction:column; gap:6px; }}
      .insight-row:first-child {{ border-top:none; padding-top:0; margin-top:0; }}
      .insight-picks {{ display:flex; flex-wrap:wrap; gap:6px; }}
      .insight-users {{ font-size:12px; color:#64748b; }}
      .insight-empty {{ color:#64748b; font-size:12px; }}
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="hero">
        <div class="eyebrow">IFL 2026</div>
        <h1>Playoffs Predictions Extract</h1>
        <div class=\"sub\">Generated on {date_label}</div>
      </div>
      <div class="insights">
        <div class="insight-card">
          <div class="insight-title">Shared Combinations</div>
          {combo_block(shared, "No shared combinations yet.")}
        </div>
        <div class="insight-card">
          <div class="insight-title">Unique Combinations</div>
          {combo_block(unique, "No unique combinations yet.")}
        </div>
      </div>
      <div class="grid">
        {''.join(cards) if cards else '<div class="card">No predictions found.</div>'}
      </div>
      <div class="foot">This report shows all user playoff picks currently stored in the system.</div>
    </div>
  </body>
</html>"""
    out_html.write_text(html, encoding="utf-8")


def render_pdf(items: list[dict[str, str]], out_pdf: Path, date_label: str) -> None:
    page_w, page_h = A4
    c = canvas.Canvas(str(out_pdf), pagesize=A4)

    def header():
        c.setFillColor(colors.HexColor("#e6edf7"))
        c.rect(0, 0, page_w, page_h, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#f59e0b"))
        c.setFont("Helvetica-Bold", 10)
        c.drawString(40, page_h - 48, "IFL 2026")
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 20)
        c.drawString(40, page_h - 74, "Playoffs Predictions Extract")
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont("Helvetica", 10)
        c.drawString(40, page_h - 92, f"Generated on {date_label}")

    combos: dict[tuple[str, ...], list[dict[str, str]]] = {}
    for item in items:
        combo_key = tuple(sorted(p["abbr"] for p in item["picks"]))
        combos.setdefault(combo_key, []).append(item)

    shared = [(k, v) for k, v in combos.items() if len(v) > 1]
    unique = [(k, v) for k, v in combos.items() if len(v) == 1]
    shared.sort(key=lambda kv: len(kv[1]), reverse=True)

    header()
    x = 40
    y = page_h - 120

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, "Key Insights")
    y -= 16
    c.setFillColor(colors.HexColor("#b6c6e3"))
    c.setFont("Helvetica", 9)
    top_shared = ", ".join(
        f"{' '.join(k)} ({len(v)})" for k, v in shared[:3]
    ) or "No shared combinations yet."
    unique_count = len(unique)
    c.drawString(x, y, f"Shared combos: {top_shared}")
    y -= 12
    c.drawString(x, y, f"Unique combos: {unique_count}")
    y -= 18
    col_w = (page_w - 120) / 2
    row_h = 64
    col = 0

    for item in items or [{"team_name": "No predictions found", "username": "", "picks": []}]:
        if y - row_h < 40:
            c.showPage()
            header()
            y = page_h - 120
            col = 0
        cx = x + col * (col_w + 40)
        c.setFillColor(colors.white)
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.roundRect(cx, y - row_h, col_w, row_h - 8, 10, fill=1, stroke=1)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 12)
        c.drawString(cx + 12, y - 26, item["team_name"])
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont("Helvetica", 9)
        if item["username"]:
            c.drawString(cx + 12, y - 40, item["username"])
        c.setFillColor(colors.HexColor("#f59e0b"))
        c.setFont("Helvetica-Bold", 10)
        picks = item["picks"] or []
        picks_text = " · ".join(p["abbr"] for p in picks) if picks else "No picks"
        c.drawRightString(cx + col_w - 12, y - 28, picks_text)

        col += 1
        if col > 1:
            col = 0
            y -= row_h + 10

    c.showPage()
    c.save()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    date_label = datetime.now().strftime("%d %b %Y %H:%M")

    conn = sqlite3.connect(DB_PATH)
    try:
        team_map = load_team_map(conn)
        users = load_users(conn)
        preds = load_predictions(conn)
    finally:
        conn.close()

    rows = []
    for username, picks in preds.items():
        team_name = users.get(username, username)
        display_name = team_name if team_name != username else ""
        picks_payload = [{"abbr": str(p), "name": team_map.get(str(p), str(p))} for p in picks]
        rows.append(
            {
                "username": display_name,
                "team_name": team_name,
                "picks": picks_payload,
            }
        )

    rows.sort(key=lambda r: (r["team_name"].lower(), r["username"].lower()))

    out_html = OUT_DIR / "playoffs_predictions_extracts.html"
    out_pdf = OUT_DIR / "playoffs_predictions_extracts.pdf"
    render_html(rows, out_html, date_label, team_map)
    render_pdf(rows, out_pdf, date_label)
    print(out_html)
    print(out_pdf)


if __name__ == "__main__":
    main()
