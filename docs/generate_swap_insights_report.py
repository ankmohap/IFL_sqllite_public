#!/usr/bin/env python3
from __future__ import annotations

import sqlite3
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "server" / "data" / "ifl.sqlite3"
OUT_DIR = ROOT / "docs" / "prediction_posters"
PAGE_W, PAGE_H = landscape(A4)


def fit_text(text: str, font_name: str, max_size: int, min_size: int, width: float) -> int:
    size = max_size
    while size > min_size and stringWidth(text, font_name, size) > width:
        size -= 1
    return size


def short_dt(value: str | None) -> str:
    if not value:
        return "-"
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt.strftime("%d %b %Y, %I:%M %p")
    except Exception:
        return str(value)


def fetch_rows() -> list[sqlite3.Row]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT
              us.id,
              us.user_id,
              us.window_id,
              us.out_player_id,
              us.in_player_id,
              us.created_at,
              COALESCE(us.is_validated, 0) AS is_validated,
              COALESCE(us.is_frozen, 0) AS is_frozen,
              us.validated_at,
              us.frozen_at,
              u.username,
              COALESCE(NULLIF(u.team_name, ''), u.username) AS team_name,
              sw.name AS window_name,
              sw.start_at,
              sw.lock_at,
              sw.end_at,
              COALESCE(sw.effective_match_id, us.effective_match_id, 0) AS effective_match_id,
              po.name AS out_name,
              po.team AS out_team,
              po.role AS out_role,
              po.country AS out_country,
              pi.name AS in_name,
              pi.team AS in_team,
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
        return rows
    finally:
        conn.close()


def build_report(rows: list[sqlite3.Row]) -> dict:
    grouped: dict[tuple[int, int], dict] = {}
    swap_in_counter: Counter[str] = Counter()
    swap_out_counter: Counter[str] = Counter()
    role_flows: Counter[str] = Counter()
    intl_in = 0
    intl_out = 0
    window_team_counts: Counter[str] = Counter()

    for row in rows:
        key = (int(row["user_id"]), int(row["window_id"]))
        group = grouped.setdefault(
            key,
            {
                "user_id": int(row["user_id"]),
                "username": str(row["username"] or ""),
                "team_name": str(row["team_name"] or row["username"] or ""),
                "window_id": int(row["window_id"] or 0),
                "window_name": str(row["window_name"] or f"Window {row['window_id']}"),
                "start_at": str(row["start_at"] or ""),
                "lock_at": str(row["lock_at"] or ""),
                "end_at": str(row["end_at"] or ""),
                "effective_match_id": int(row["effective_match_id"] or 0),
                "created_at": str(row["created_at"] or ""),
                "validated": True,
                "frozen": True,
                "swaps": [],
            },
        )
        group["validated"] = group["validated"] and int(row["is_validated"] or 0) == 1
        group["frozen"] = group["frozen"] and int(row["is_frozen"] or 0) == 1
        group["created_at"] = min(group["created_at"], str(row["created_at"] or "")) if group["created_at"] else str(row["created_at"] or "")
        swap = {
            "out_name": str(row["out_name"] or f"#{row['out_player_id']}"),
            "out_role": str(row["out_role"] or "-"),
            "out_team": str(row["out_team"] or "-"),
            "out_country": str(row["out_country"] or "-"),
            "in_name": str(row["in_name"] or f"#{row['in_player_id']}"),
            "in_role": str(row["in_role"] or "-"),
            "in_team": str(row["in_team"] or "-"),
            "in_country": str(row["in_country"] or "-"),
        }
        group["swaps"].append(swap)

        swap_in_counter[swap["in_name"]] += 1
        swap_out_counter[swap["out_name"]] += 1
        role_flows[f"{swap['out_role']} -> {swap['in_role']}"] += 1
        if "overseas" in swap["in_country"].lower() or "intl" in swap["in_country"].lower() or swap["in_country"].lower() not in {"india", "indian"}:
            intl_in += 1
        if "overseas" in swap["out_country"].lower() or "intl" in swap["out_country"].lower() or swap["out_country"].lower() not in {"india", "indian"}:
            intl_out += 1
        window_team_counts[str(row["window_name"] or f"Window {row['window_id']}")] += 0

    groups = sorted(grouped.values(), key=lambda g: (g["window_id"], g["team_name"].lower()))
    exact_combos: dict[tuple[str, ...], list[str]] = defaultdict(list)
    for group in groups:
        combo = tuple(sorted(f"{s['out_name']} -> {s['in_name']}" for s in group["swaps"]))
        exact_combos[combo].append(group["team_name"])
        window_team_counts[group["window_name"]] += 1

    shared_combos = [
        {"combo": combo, "teams": sorted(teams), "count": len(teams)}
        for combo, teams in exact_combos.items()
        if len(teams) > 1
    ]
    shared_combos.sort(key=lambda item: (-item["count"], item["teams"][0].lower()))

    unique_groups = [g for g in groups if len(exact_combos[tuple(sorted(f"{s['out_name']} -> {s['in_name']}" for s in g["swaps"]))]) == 1]

    return {
        "generated_at": datetime.now().strftime("%d %b %Y, %I:%M %p"),
        "total_swap_rows": len(rows),
        "total_teams": len(groups),
        "frozen_teams": sum(1 for g in groups if g["frozen"]),
        "validated_teams": sum(1 for g in groups if g["validated"]),
        "window_team_counts": sorted(window_team_counts.items(), key=lambda kv: kv[0].lower()),
        "top_swap_ins": swap_in_counter.most_common(8),
        "top_swap_outs": swap_out_counter.most_common(8),
        "role_flows": role_flows.most_common(8),
        "intl_in": intl_in,
        "intl_out": intl_out,
        "shared_combos": shared_combos[:8],
        "unique_groups": unique_groups[:8],
        "groups": groups,
    }


def render_html(report: dict, out_html: Path) -> None:
    def chips(items: list[str], tone: str = "slate") -> str:
        if not items:
            return '<span class="chip muted">None</span>'
        return "".join(f'<span class="chip {tone}">{item}</span>' for item in items)

    summary_cards = [
        ("Active Swap Rows", str(report["total_swap_rows"])),
        ("Teams With Swaps", str(report["total_teams"])),
        ("Frozen Teams", str(report["frozen_teams"])),
        ("Validated Teams", str(report["validated_teams"])),
        ("Intl Swapped In", str(report["intl_in"])),
        ("Intl Swapped Out", str(report["intl_out"])),
    ]

    top_in_html = "".join(
        f'<div class="metric-row"><span>{name}</span><strong>{count}</strong></div>'
        for name, count in report["top_swap_ins"]
    ) or '<div class="empty">No swap-ins found.</div>'
    top_out_html = "".join(
        f'<div class="metric-row"><span>{name}</span><strong>{count}</strong></div>'
        for name, count in report["top_swap_outs"]
    ) or '<div class="empty">No swap-outs found.</div>'
    role_flow_html = "".join(
        f'<div class="metric-row"><span>{label}</span><strong>{count}</strong></div>'
        for label, count in report["role_flows"]
    ) or '<div class="empty">No role flows found.</div>'
    window_html = "".join(
        f'<div class="metric-row"><span>{name}</span><strong>{count} teams</strong></div>'
        for name, count in report["window_team_counts"]
    ) or '<div class="empty">No swap windows found.</div>'

    shared_html = "".join(
        f"""
        <article class="insight-block">
          <div class="insight-title">{item['count']} teams used the same combination</div>
          <div class="insight-copy">{chips(list(item['combo']), "orange")}</div>
          <div class="insight-copy">{chips(item['teams'], "blue")}</div>
        </article>
        """
        for item in report["shared_combos"]
    ) or '<div class="empty">No repeated full combinations yet. Every team is mostly taking its own route.</div>'

    unique_html = "".join(
        f"""
        <article class="insight-block">
          <div class="insight-title">{g['team_name']}</div>
          <div class="insight-copy">Window: {g['window_name']} · Effective from match {g['effective_match_id'] or "-"}</div>
          <div class="insight-copy">{chips([f"{s['out_name']} -> {s['in_name']}" for s in g['swaps']], "slate")}</div>
        </article>
        """
        for g in report["unique_groups"]
    ) or '<div class="empty">No unique combinations found.</div>'

    group_cards = []
    for idx, group in enumerate(report["groups"], start=1):
        swap_rows = "".join(
            f"""
            <tr>
              <td>{s['out_name']}</td>
              <td>{s['out_team']}</td>
              <td>{s['out_role']}</td>
              <td>{s['in_name']}</td>
              <td>{s['in_team']}</td>
              <td>{s['in_role']}</td>
            </tr>
            """
            for s in group["swaps"]
        )
        status_parts = []
        status_parts.append("Frozen" if group["frozen"] else "Draft")
        status_parts.append("Validated" if group["validated"] else "Pending")
        group_cards.append(
            f"""
            <article class="team-card">
              <div class="team-head">
                <div>
                  <div class="overline">#{idx} · {group['window_name']}</div>
                  <h3>{group['team_name']}</h3>
                  <div class="meta">Effective from match {group['effective_match_id'] or '-'} · Submitted {short_dt(group['created_at'])}</div>
                </div>
                <div class="status">{' · '.join(status_parts)}</div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Swap Out</th>
                    <th>Team</th>
                    <th>Role</th>
                    <th>Swap In</th>
                    <th>Team</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>{swap_rows}</tbody>
              </table>
            </article>
            """
        )

    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Swap Insights Report</title>
  <style>
    :root {{
      --bg:#162133;
      --bg2:#22324a;
      --card:#f7fafc;
      --ink:#122033;
      --muted:#5d6d84;
      --line:#dbe4ef;
      --accent:#f59e0b;
      --accent2:#5dade2;
      --accent3:#f97316;
    }}
    * {{ box-sizing:border-box; }}
    body {{
      margin:0;
      font-family:"Segoe UI",system-ui,sans-serif;
      color:var(--ink);
      background:
        radial-gradient(circle at top left, rgba(255,255,255,.08), transparent 26%),
        linear-gradient(145deg, #142034 0%, #22324a 55%, #1b283a 100%);
    }}
    .wrap {{ max-width:1160px; margin:0 auto; padding:28px; }}
    .hero {{
      background:linear-gradient(135deg, rgba(255,255,255,.95), rgba(241,245,249,.92));
      border:1px solid rgba(255,255,255,.35);
      border-radius:24px;
      padding:28px;
      box-shadow:0 28px 60px rgba(7,17,31,.22);
    }}
    .eyebrow {{ font-size:12px; letter-spacing:.22em; text-transform:uppercase; color:#d97706; font-weight:800; }}
    h1 {{ margin:10px 0 8px; font-size:38px; line-height:1.05; }}
    .sub {{ color:var(--muted); font-size:14px; }}
    .summary-grid {{
      margin-top:18px;
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));
      gap:12px;
    }}
    .sum-card {{
      background:rgba(21,33,51,.06);
      border:1px solid var(--line);
      border-radius:18px;
      padding:14px 16px;
    }}
    .sum-label {{ font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); font-weight:700; }}
    .sum-value {{ font-size:30px; font-weight:900; margin-top:6px; }}
    .section-grid {{
      margin-top:18px;
      display:grid;
      grid-template-columns:repeat(2, minmax(0,1fr));
      gap:16px;
    }}
    .panel {{
      background:rgba(247,250,252,.96);
      border:1px solid rgba(255,255,255,.25);
      border-radius:22px;
      padding:18px;
      box-shadow:0 16px 36px rgba(7,17,31,.16);
    }}
    .panel h2 {{ margin:0 0 12px; font-size:20px; }}
    .metric-row {{
      display:flex; justify-content:space-between; gap:12px;
      padding:10px 0; border-top:1px dashed var(--line);
      font-size:14px;
    }}
    .metric-row:first-of-type {{ border-top:none; padding-top:0; }}
    .metric-row strong {{ color:#0f172a; }}
    .insight-block {{
      border-top:1px dashed var(--line);
      padding-top:12px; margin-top:12px;
    }}
    .insight-block:first-of-type {{ border-top:none; padding-top:0; margin-top:0; }}
    .insight-title {{ font-weight:800; font-size:15px; margin-bottom:6px; }}
    .insight-copy {{ color:var(--muted); font-size:13px; margin-top:6px; }}
    .chip {{
      display:inline-flex; align-items:center; gap:6px;
      padding:6px 10px; border-radius:999px; margin:4px 6px 0 0;
      font-size:12px; font-weight:700; border:1px solid transparent;
    }}
    .chip.orange {{ background:rgba(249,115,22,.12); color:#c2410c; border-color:rgba(249,115,22,.24); }}
    .chip.blue {{ background:rgba(93,173,226,.12); color:#1d4ed8; border-color:rgba(93,173,226,.24); }}
    .chip.slate {{ background:rgba(15,23,42,.06); color:#334155; border-color:rgba(15,23,42,.12); }}
    .chip.muted {{ background:#f1f5f9; color:#64748b; border-color:#e2e8f0; }}
    .teams {{ margin-top:18px; display:grid; grid-template-columns:1fr; gap:14px; }}
    .team-card {{
      background:rgba(247,250,252,.98);
      border:1px solid rgba(255,255,255,.28);
      border-radius:22px;
      padding:18px;
      box-shadow:0 16px 36px rgba(7,17,31,.16);
      break-inside:avoid;
    }}
    .team-head {{ display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:12px; }}
    .overline {{ font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); font-weight:800; }}
    .team-card h3 {{ margin:4px 0 6px; font-size:24px; }}
    .meta {{ color:var(--muted); font-size:13px; }}
    .status {{
      white-space:nowrap; border-radius:999px; padding:8px 12px;
      background:rgba(15,23,42,.06); font-size:12px; font-weight:800; color:#334155;
    }}
    table {{ width:100%; border-collapse:collapse; }}
    th {{
      text-align:left; font-size:11px; text-transform:uppercase;
      letter-spacing:.12em; color:var(--muted); padding:10px 8px; border-bottom:1px solid var(--line);
    }}
    td {{ padding:10px 8px; border-bottom:1px solid #ecf2f8; font-size:13px; }}
    tr:last-child td {{ border-bottom:none; }}
    .empty {{ color:var(--muted); font-size:13px; }}
    .foot {{ margin-top:18px; color:rgba(255,255,255,.72); font-size:12px; }}
    @media (max-width: 900px) {{
      .section-grid {{ grid-template-columns:1fr; }}
      .team-head {{ flex-direction:column; }}
      .status {{ white-space:normal; }}
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">IFL 2026</div>
      <h1>Swap Insights Report</h1>
      <div class="sub">A current snapshot of team-level swap activity, common patterns, and unique calls across all submitted Super Swapper entries. Generated on {report['generated_at']}.</div>
      <div class="summary-grid">
        {"".join(f'<div class="sum-card"><div class="sum-label">{label}</div><div class="sum-value">{value}</div></div>' for label, value in summary_cards)}
      </div>
    </section>

    <section class="section-grid">
      <div class="panel">
        <h2>Most Popular Swap-Ins</h2>
        {top_in_html}
      </div>
      <div class="panel">
        <h2>Most Popular Swap-Outs</h2>
        {top_out_html}
      </div>
      <div class="panel">
        <h2>Role Movement</h2>
        {role_flow_html}
      </div>
      <div class="panel">
        <h2>Window Coverage</h2>
        {window_html}
      </div>
    </section>

    <section class="section-grid">
      <div class="panel">
        <h2>Shared Combinations</h2>
        {shared_html}
      </div>
      <div class="panel">
        <h2>Unique Calls</h2>
        {unique_html}
      </div>
    </section>

    <section class="teams">
      {"".join(group_cards) if group_cards else '<div class="panel"><div class="empty">No swaps submitted yet.</div></div>'}
    </section>

    <div class="foot">This report reads directly from <code>user_swaps</code>, <code>swap_windows</code>, <code>users</code>, and <code>players</code>.</div>
  </div>
</body>
</html>
"""
    out_html.write_text(html, encoding="utf-8")


def draw_metric_list(c: canvas.Canvas, x: float, y: float, w: float, title: str, items: list[tuple[str, int]], empty_text: str) -> float:
    c.setFillColor(colors.white)
    c.roundRect(x, y - 160, w, 160, 18, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#10213d"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(x + 14, y - 22, title)
    row_y = y - 42
    if not items:
        c.setFillColor(colors.HexColor("#607189"))
        c.setFont("Helvetica", 10)
        c.drawString(x + 14, row_y, empty_text)
        return y - 160
    for label, count in items[:6]:
        c.setFillColor(colors.HexColor("#607189"))
        c.setFont("Helvetica", 10)
        c.drawString(x + 14, row_y, str(label)[:34])
        c.setFillColor(colors.HexColor("#10213d"))
        c.setFont("Helvetica-Bold", 10)
        c.drawRightString(x + w - 14, row_y, str(count))
        c.setStrokeColor(colors.HexColor("#dbe4ef"))
        c.line(x + 14, row_y - 8, x + w - 14, row_y - 8)
        row_y -= 22
    return y - 160


def render_pdf(report: dict, out_pdf: Path) -> None:
    c = canvas.Canvas(str(out_pdf), pagesize=(PAGE_W, PAGE_H))

    def new_page():
        c.setFillColor(colors.HexColor("#162133"))
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        c.setFillColor(colors.Color(1, 1, 1, 0.06))
        c.circle(90, PAGE_H - 30, 120, fill=1, stroke=0)
        c.setFillColor(colors.Color(0.96, 0.62, 0.04, 0.09))
        c.circle(PAGE_W - 60, PAGE_H - 10, 140, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.roundRect(28, 28, PAGE_W - 56, PAGE_H - 56, 24, fill=0, stroke=0)

    def draw_header():
        c.setFillColor(colors.HexColor("#f59e0b"))
        c.setFont("Helvetica-Bold", 10)
        c.drawString(44, PAGE_H - 44, "IFL 2026")
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 24)
        c.drawString(44, PAGE_H - 68, "Swap Insights Report")
        c.setFillColor(colors.HexColor("#c9d5e5"))
        c.setFont("Helvetica", 10)
        c.drawString(44, PAGE_H - 84, f"Generated on {report['generated_at']}")

    new_page()
    draw_header()

    summary = [
        ("Swap Rows", report["total_swap_rows"]),
        ("Teams", report["total_teams"]),
        ("Frozen", report["frozen_teams"]),
        ("Validated", report["validated_teams"]),
        ("Intl In", report["intl_in"]),
        ("Intl Out", report["intl_out"]),
    ]
    x = 44
    y = PAGE_H - 118
    card_w = 118
    gap = 10
    for idx, (label, value) in enumerate(summary):
        card_x = x + idx * (card_w + gap)
        c.setFillColor(colors.white)
        c.roundRect(card_x, y - 74, card_w, 74, 16, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#607189"))
        c.setFont("Helvetica-Bold", 9)
        c.drawString(card_x + 12, y - 20, label.upper())
        c.setFillColor(colors.HexColor("#10213d"))
        c.setFont("Helvetica-Bold", 22)
        c.drawString(card_x + 12, y - 50, str(value))

    list_y = y - 96
    draw_metric_list(c, 44, list_y, 238, "Most Popular Swap-Ins", report["top_swap_ins"], "No swap-ins")
    draw_metric_list(c, 294, list_y, 238, "Most Popular Swap-Outs", report["top_swap_outs"], "No swap-outs")
    draw_metric_list(c, 544, list_y, 238, "Role Movement", report["role_flows"], "No role movement")

    c.setFillColor(colors.white)
    c.roundRect(44, 150, PAGE_W - 88, 120, 18, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#10213d"))
    c.setFont("Helvetica-Bold", 14)
    c.drawString(58, 248, "Highlights")
    c.setFillColor(colors.HexColor("#607189"))
    c.setFont("Helvetica", 10)
    shared_line = (
        f"Shared combinations: {len(report['shared_combos'])} repeated patterns identified."
        if report["shared_combos"]
        else "Shared combinations: none yet."
    )
    unique_line = f"Unique calls: {len(report['unique_groups'])} teams currently hold one-off combinations."
    window_line = ", ".join(f"{name}: {count}" for name, count in report["window_team_counts"]) or "No windows configured."
    c.drawString(58, 226, shared_line)
    c.drawString(58, 208, unique_line)
    c.drawString(58, 190, f"Window coverage: {window_line}")

    row_y = 120
    for item in report["shared_combos"][:2]:
        c.drawString(58, row_y, f"{item['count']} teams: {' | '.join(item['combo'])[:120]}")
        row_y -= 16

    c.showPage()
    new_page()
    draw_header()

    table_top = PAGE_H - 110
    c.setFillColor(colors.white)
    c.roundRect(36, 36, PAGE_W - 72, PAGE_H - 152, 18, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#10213d"))
    c.setFont("Helvetica-Bold", 11)
    headers = [("Team", 46), ("Window", 220), ("Status", 335), ("Effective", 420), ("Swaps", 495)]
    for label, hx in headers:
        c.drawString(hx, table_top, label.upper())
    c.setStrokeColor(colors.HexColor("#dbe4ef"))
    c.line(46, table_top - 8, PAGE_W - 46, table_top - 8)

    y = table_top - 26
    for group in report["groups"]:
        swap_text = "; ".join(f"{s['out_name']} -> {s['in_name']}" for s in group["swaps"])
        lines = [swap_text[i:i + 56] for i in range(0, len(swap_text), 56)] or ["-"]
        row_h = max(34, 16 * len(lines))
        if y - row_h < 52:
            c.showPage()
            new_page()
            draw_header()
            c.setFillColor(colors.white)
            c.roundRect(36, 36, PAGE_W - 72, PAGE_H - 152, 18, fill=1, stroke=0)
            c.setFillColor(colors.HexColor("#10213d"))
            c.setFont("Helvetica-Bold", 11)
            for label, hx in headers:
                c.drawString(hx, table_top, label.upper())
            c.setStrokeColor(colors.HexColor("#dbe4ef"))
            c.line(46, table_top - 8, PAGE_W - 46, table_top - 8)
            y = table_top - 26
        c.setFillColor(colors.HexColor("#10213d"))
        team_font = fit_text(group["team_name"], "Helvetica-Bold", 10, 7, 164)
        c.setFont("Helvetica-Bold", team_font)
        c.drawString(46, y, group["team_name"])
        c.setFillColor(colors.HexColor("#607189"))
        c.setFont("Helvetica", 9)
        c.drawString(220, y, str(group["window_name"])[:18])
        c.drawString(335, y, ("Frozen" if group["frozen"] else "Draft") + " / " + ("Validated" if group["validated"] else "Pending"))
        c.drawString(420, y, f"Match {group['effective_match_id'] or '-'}")
        line_y = y
        for line in lines:
            c.drawString(495, line_y, line)
            line_y -= 14
        c.setStrokeColor(colors.HexColor("#ecf2f8"))
        c.line(46, y - row_h + 8, PAGE_W - 46, y - row_h + 8)
        y -= row_h

    c.save()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = fetch_rows()
    report = build_report(rows)
    out_html = OUT_DIR / "swap_insights_report.html"
    out_pdf = OUT_DIR / "swap_insights_report.pdf"
    render_html(report, out_html)
    render_pdf(report, out_pdf)
    print(out_html)
    print(out_pdf)


if __name__ == "__main__":
    main()
