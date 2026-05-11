#!/usr/bin/env python3
from __future__ import annotations

import html
import re
import sqlite3
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "server" / "data" / "ifl.sqlite3"
OUT_DIR = ROOT / "docs" / "user_story_cards"

PERSONAL_FACTS = {
    "Murgichor XI": "Otherwise known as Bengal Bewdas and earlier seen in the league as Pandas Puchuks, this team has been a proud organizer helping carry the legacy of IFL for CVD2.",
    "Slog Sweep & Chill": "Famously known as Bawa, he was the first person to submit the squad and a major contributor during app UAT.",
    "BosoniXI": "Super Boss with the hangover of CVD migration nightmares named the team after the server name. A master strategist, he evaluates each season very logically before selecting players.",
    "Rowdy Jetsons": "The goon of Bheend Murena, proud of the doonali legacy, has named his team accordingly. The team name has remained unchanged since the beginning of IFL.",
    "RJ Royals": "Famously known as Poppins, he is still in the nostalgia of the first IPL when Rajasthan won under Shane Warne. A huge fan of Ajinkya Rahane, he should probably rename the team from RJ to KKR Royals now.",
    "Urban Titans": "Known by many names including Cow, Gau, and Gomez, she has a reputation for backing the most underrated players. She was among the first in IFL history to pick players like Yashasvi Jaiswal before most of the league had even seen him play.",
    "Vicks' Wizards": "An avid reader and Hogwarts nerd, he draws the team logo inspiration from that world. He plays in the spirit of having maximum fun and stays deeply involved even without being a traditional cricket fanatic.",
    "Sion Ke Lions": "The coolest manager, he was the one to initiate this fun event with Prasanna. Having seen the old Excel-driven days, few are more excited than him to watch IFL kick off in this form.",
    "Ballistic Bros": "Hopefully the new name brings fresh luck to Sneha. Also known as CQO and Chotte Sardar, she had a reputation in earlier fantasy leagues for picking a bulk of Sri Lankan players.",
    "Madhavi k Mastane": "The full name might really be Madhavi ke Mastane, courtesy Kunal. Our very own Jain bahu with the superpower of taking naps anywhere has a history of missing predictions, so hopefully she does not lose points on that front this time.",
    "Raghav Rockers XI": "Infamously known for his takia kalam, 'Wohi toh me keh rha tha,' Raghav is remembered less for consistency in IFL rankings and more for dramatic, fun banter across IFL conversations during the office days.",
    "Nashik ke Ashiq": "Our own Baburao of the team, a friend who has always been a sport through adventures, events, and fun. No IFL feels complete without him in the mix.",
    "Baagad Bille": "Famously known as Casper ki Amma and a true pet lover, she has smartly outsourced her team building to cricket intellectuals, somehow turning that into steady performance season after season.",
    "HPs Challengers": "Carrying dancing genes from Nalasopara, he is a true Dhoni fan. Apart from his never-doubted cricket analysis skills, one thing that makes him a foodie twin with SKY is that both of them love Sezhuan, not SI-chuan, triple fried rice.",
    "uNik XI": "The other Jain in the team, she goes by many names including Annapurna Maata, Nexon, Nikkudi, and Nixy. Adored by all and highly pampered by Bobb, she is a huge Sachin fan, so everyone was half-expecting her to pick Arjun this time.",
    "Dhurandars": "The sanskari one in the team, otherwise known as Asaram Kumar, somehow carries a team name that feels completely offbeat for his personality. Recently married, this squad might just as easily have been called Biwi Approved Dhurandhar.",
    "Winners Xl": "Ahtsham is easily one of the most competitive people in the team. Be it any face-off, even a dance face-off, or any sport you bring to him, he has a habit of surprising everyone with his winner mentality.",
    "Duckworth Lewis": "Yet another team that probably deserves to be renamed Duckworth Lewis courtesy Dhaval. Otherwise known as Montu, he has been a sport in every event and also happens to be a November-born birthday twin of the organizer.",
    "Safar blitz": "Known for his takia kalam, 'Me toh khaega,' he comes with an endless appetite and is a true foodie. A hardcore CSK fan, Sajjad usually makes or breaks his leaderboard push whenever Chennai plays.",
    "POTUS Playmakers": "Otherwise known as Andu, Anu, Bobb, and BumKesh, he is the twer-king teammate and live wire of the group. His personality sits in that impossible zone where, much like Rakhi Sawant, you may love him or hate him, but you definitely cannot ignore him.",
}

TEAM_COLORS = {
    "CSK": "#f7b500",
    "DC": "#2563eb",
    "GT": "#0f3d7a",
    "KKR": "#5b2c83",
    "LSG": "#1da1f2",
    "MI": "#2563eb",
    "PBKS": "#d7263d",
    "RCB": "#b91c1c",
    "RR": "#ec4899",
    "SRH": "#f97316",
}


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_") or "user"


def initials(name: str) -> str:
    bits = [b for b in re.split(r"\s+", name.strip()) if b]
    if not bits:
        return "IFL"
    return "".join(part[0] for part in bits[:3]).upper()


def fetch_user(conn: sqlite3.Connection, team_name: str):
    row = conn.execute(
        """
        SELECT id, username, team_name, team_logo, points, squad_submitted, squad_validated, squad_frozen
        FROM users
        WHERE team_name = ?
        """,
        (team_name,),
    ).fetchone()
    if not row:
        raise SystemExit(f"User team not found: {team_name}")
    return row


def fetch_squad(conn: sqlite3.Connection, user_id: int):
    rows = conn.execute(
        """
        SELECT p.id, p.name, p.team, p.role, p.country
        FROM user_players up
        JOIN players p ON p.id = up.player_id
        WHERE up.user_id = ? AND COALESCE(up.is_deleted, 0) = 0
        ORDER BY p.team, p.name
        """,
        (user_id,),
    ).fetchall()
    return rows


def fetch_ownership(conn: sqlite3.Connection):
    rows = conn.execute(
        """
        SELECT p.id, p.name, COUNT(*) AS picked_by
        FROM user_players up
        JOIN players p ON p.id = up.player_id
        WHERE COALESCE(up.is_deleted, 0) = 0
        GROUP BY p.id, p.name
        """
    ).fetchall()
    return {int(r[0]): {"name": r[1], "picked_by": int(r[2])} for r in rows}


def build_insights(user_row, squad, ownership, total_users):
    team_name = user_row[2]
    points = int(user_row[4] or 0)
    teams = Counter(r[2] for r in squad)
    roles = Counter(r[3] for r in squad)
    countries = Counter(r[4] for r in squad)
    domestic_only = countries.get("India", 0) == len(squad)
    top_team, top_count = teams.most_common(1)[0]
    spread = len(teams)

    rare = sorted(
        (
            {
                "name": r[1],
                "team": r[2],
                "picked_by": ownership.get(int(r[0]), {}).get("picked_by", 0),
            }
            for r in squad
        ),
        key=lambda x: (x["picked_by"], x["name"]),
    )
    rare_lines = []
    for item in rare[:3]:
        if item["picked_by"] <= 1:
            rare_lines.append(f"{item['name']} is a solo hold for this squad")
        else:
            rare_lines.append(f"{item['name']} is backed by only {item['picked_by']} of {total_users} teams")
    rare_copy = "; ".join(rare_lines)

    domestic_copy = (
        f"All {len(squad)} selections are domestic. {team_name} has gone fully local with zero overseas names in the active squad."
        if domestic_only
        else "This team mixes domestic and overseas picks rather than leaning into one side completely."
    )
    shape_copy = (
        f"The squad is spread across {spread} IPL teams, but the strongest concentration sits with {top_team} ({top_count} picks). "
        f"Role-wise it stays batting-heavy with {roles.get('BAT', 0)} batters, {roles.get('BOWL', 0)} bowlers, {roles.get('WK', 0)} wicketkeepers, and {roles.get('ALL', 0)} all-rounders."
    )
    differential_copy = (
        f"This is not a template squad. {rare_copy}, which gives the team a reputation for backing unusual names before the rest of the pool follows."
    )
    personal_copy = PERSONAL_FACTS.get(team_name, "No personal note has been added yet for this team.")

    stats = [
        (str(points), "Total Points"),
        (str(countries.get("India", 0)), "Domestic Picks"),
        (top_team, "Top Team Stack"),
    ]
    insights = [
        ("Domestic Identity", domestic_copy, "orange"),
        ("Squad Shape", shape_copy, "blue"),
        ("Differential Reputation", differential_copy, "gold"),
        ("Personal Note", personal_copy, "green"),
    ]
    return stats, insights, top_team


def render_html(user_row, squad, stats, insights, accent_team):
    team_name = user_row[2]
    logo = user_row[3] or ""
    team_color = TEAM_COLORS.get(accent_team, "#ff5c39")
    logo_block = (
        f'<img src="{html.escape(logo)}" alt="{html.escape(team_name)} logo" />'
        if logo
        else f'<div class="photo-fallback">{html.escape(initials(team_name))}</div>'
    )
    stat_html = "\n".join(
        f'''        <div class="stat"><div class="v">{html.escape(value)}</div><div class="l">{html.escape(label)}</div></div>'''
        for value, label in stats
    )
    insight_html = "\n".join(
        f'''        <article class="insight {html.escape(kind)}"><h3>{html.escape(title)}</h3><p>{html.escape(copy)}</p></article>'''
        for title, copy, kind in insights
    )
    squad_preview = ", ".join(html.escape(r[1]) for r in squad[:6])
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(team_name)} User Story Card</title>
  <style>
    :root{{
      --bg:#07111f;
      --panel:#0d1b31;
      --panel-2:#122642;
      --line:rgba(255,255,255,.12);
      --text:#eef5ff;
      --muted:#9fb4d3;
      --gold:#ffbe0b;
      --accent:{team_color};
      --sky:#00b4d8;
      --ok:#20c997;
    }}
    *{{box-sizing:border-box}}
    body{{
      margin:0;
      min-height:100vh;
      display:grid;
      place-items:center;
      padding:24px;
      background:
        radial-gradient(700px 340px at 20% 10%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%),
        radial-gradient(700px 340px at 80% 0%, rgba(0,180,216,.16), transparent 60%),
        linear-gradient(160deg,#06101d 0%, #091427 50%, #050b16 100%);
      color:var(--text);
      font-family:Inter, system-ui, sans-serif;
    }}
    .frame{{
      width:min(1080px,100%);
      display:grid;
      grid-template-columns:380px 1fr;
      gap:24px;
      padding:24px;
      border-radius:30px;
      background:linear-gradient(160deg,rgba(17,30,54,.96),rgba(8,16,30,.98));
      border:1px solid var(--line);
      box-shadow:0 28px 60px rgba(0,0,0,.38);
      overflow:hidden;
      position:relative;
    }}
    .frame::before{{
      content:"";
      position:absolute;
      inset:-20% auto auto -10%;
      width:320px;
      height:320px;
      background:radial-gradient(circle,color-mix(in srgb, var(--accent) 28%, transparent),transparent 65%);
      pointer-events:none;
    }}
    .left{{display:flex;flex-direction:column;gap:16px}}
    .team-pill{{display:inline-flex;align-items:center;gap:10px;align-self:flex-start;padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);font-size:12px;text-transform:uppercase;letter-spacing:.18em;color:var(--muted)}}
    .team-dot{{width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 14px color-mix(in srgb, var(--accent) 68%, transparent)}}
    .photo-card{{position:relative;min-height:540px;border-radius:26px;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01)),linear-gradient(160deg,#12315c,#0c1d36);border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 20px 38px rgba(0,0,0,.26)}}
    .photo-card img{{width:100%;height:100%;object-fit:cover;display:block}}
    .photo-fallback{{position:absolute;inset:0;display:grid;place-items:center;font-size:96px;font-weight:900;letter-spacing:.04em;color:rgba(255,255,255,.92);background:radial-gradient(circle at 50% 22%, rgba(255,190,11,.28), transparent 30%),linear-gradient(180deg, rgba(255,255,255,.08), transparent 40%),linear-gradient(160deg,#17437c,#0b1f39)}}
    .photo-badge{{position:absolute;left:18px;bottom:18px;padding:10px 14px;border-radius:16px;background:rgba(6,13,25,.72);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(8px);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}}
    .right{{display:flex;flex-direction:column;gap:18px;min-width:0;position:relative;z-index:1}}
    .eyebrow{{font-size:12px;text-transform:uppercase;letter-spacing:.22em;color:var(--gold)}}
    .title{{font-size:clamp(36px,5vw,58px);line-height:.92;font-weight:900;margin:0;max-width:10ch}}
    .subtitle{{color:var(--muted);font-size:16px;line-height:1.6;max-width:64ch;margin:0}}
    .hero-stats{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}}
    .stat{{padding:16px 18px;border-radius:20px;background:linear-gradient(160deg,var(--panel-2),rgba(10,20,36,.95));border:1px solid var(--line)}}
    .stat .v{{font-size:26px;font-weight:900;line-height:1.05;color:var(--text)}}
    .stat .l{{margin-top:6px;font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted)}}
    .insights{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}
    .insight{{padding:18px;border-radius:22px;border:1px solid var(--line);background:linear-gradient(160deg,rgba(15,29,52,.94),rgba(8,16,30,.96));box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}}
    .insight h3{{margin:0 0 10px;font-size:15px;letter-spacing:.04em;color:var(--text)}}
    .insight p{{margin:0;color:var(--muted);line-height:1.6;font-size:14px}}
    .insight.orange{{border-color:rgba(255,92,57,.28); background:linear-gradient(160deg,rgba(48,25,18,.7),rgba(14,17,28,.95))}}
    .insight.blue{{border-color:rgba(0,180,216,.24); background:linear-gradient(160deg,rgba(13,37,52,.85),rgba(10,18,30,.96))}}
    .insight.gold{{border-color:rgba(255,190,11,.22); background:linear-gradient(160deg,rgba(56,42,16,.62),rgba(12,17,27,.96))}}
    .insight.green{{border-color:rgba(32,201,151,.24); background:linear-gradient(160deg,rgba(12,42,33,.68),rgba(9,18,29,.96))}}
    .footer{{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:6px;color:var(--muted);font-size:13px;flex-wrap:wrap}}
    .chip{{padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid var(--line);white-space:nowrap}}
    @media (max-width: 860px){{.frame{{grid-template-columns:1fr}}.photo-card{{min-height:360px}}.hero-stats,.insights{{grid-template-columns:1fr}}}}
  </style>
</head>
<body>
  <section class="frame">
    <div class="left">
      <div class="team-pill"><span class="team-dot"></span> IFL 2026 User Spotlight</div>
      <div class="photo-card">
        {logo_block}
        <div class="photo-badge">Frozen Squad Story</div>
      </div>
    </div>
    <div class="right">
      <div class="eyebrow">Sample User Story Card</div>
      <h1 class="title">{html.escape(team_name)}</h1>
      <p class="subtitle">
        A grounded user insight card built from the current stored squad. This version blends real roster shape,
        ownership behavior, and one league personality note into a single visual story.
      </p>
      <div class="hero-stats">
{stat_html}
      </div>
      <div class="insights">
{insight_html}
      </div>
      <div class="footer">
        <div class="chip">Squad preview: {squad_preview}</div>
        <div class="chip">Phone: {html.escape(user_row[1])}</div>
      </div>
    </div>
  </section>
</body>
</html>
'''


def generate_html_for_team(team_name: str):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        user_row = fetch_user(conn, team_name)
        squad = fetch_squad(conn, int(user_row[0]))
        ownership = fetch_ownership(conn)
        total_users = int(conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] or 0)
        stats, insights, accent_team = build_insights(user_row, squad, ownership, total_users)
        output = render_html(user_row, squad, stats, insights, accent_team)
        out_path = OUT_DIR / f"{slugify(user_row[2])}.html"
        out_path.write_text(output, encoding="utf-8")
        return out_path
    finally:
        conn.close()


def main():
    import sys
    team_name = sys.argv[1] if len(sys.argv) > 1 else "Murgichor XI"
    path = generate_html_for_team(team_name)
    print(path)


if __name__ == "__main__":
    main()
