#!/usr/bin/env python3
from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from generate_user_story_cards import (
    DB_PATH,
    OUT_DIR,
    TEAM_COLORS,
    build_insights,
    fetch_ownership,
    fetch_squad,
    fetch_user,
    initials,
    slugify,
    sqlite3,
)

PAGE_W, PAGE_H = landscape((1080, 720))
MARGIN = 28
LEFT_W = 325
GAP = 24
CARD_W = PAGE_W - 2 * MARGIN
CARD_H = PAGE_H - 2 * MARGIN
RIGHT_X = MARGIN + LEFT_W + GAP
RIGHT_W = CARD_W - LEFT_W - GAP


def hex_color(value: str) -> colors.Color:
    value = value.lstrip("#")
    return colors.HexColor(f"#{value}")


def draw_round_rect(c, x, y, w, h, r, fill, stroke=None, stroke_width=1):
    if stroke:
        c.setStrokeColor(stroke)
        c.setLineWidth(stroke_width)
    else:
        c.setStrokeColor(fill)
        c.setLineWidth(0)
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, r, stroke=1 if stroke else 0, fill=1)


def fit_text(c, text, font_name, max_size, min_size, max_width):
    size = max_size
    while size > min_size and stringWidth(text, font_name, size) > max_width:
        size -= 1
    return size


def draw_wrapped_text(c, text, x, y, width, font_name, font_size, color, leading=None, max_lines=None):
    words = text.split()
    lines = []
    current = []
    for word in words:
        trial = " ".join(current + [word])
        if stringWidth(trial, font_name, font_size) <= width or not current:
            current.append(word)
        else:
            lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    if max_lines and len(lines) > max_lines:
        lines = lines[: max_lines - 1] + [lines[max_lines - 1] + "..."]
    if leading is None:
        leading = font_size * 1.4
    c.setFillColor(color)
    c.setFont(font_name, font_size)
    yy = y
    for line in lines:
        c.drawString(x, yy, line)
        yy -= leading
    return yy


def decode_logo(data_uri: str):
    if not data_uri or not data_uri.startswith("data:image"):
        return None
    try:
        encoded = data_uri.split(",", 1)[1]
        raw = base64.b64decode(encoded)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        return ImageReader(image)
    except Exception:
        return None


def draw_photo_panel(c, team_name, logo_data, accent):
    x = MARGIN
    y = MARGIN
    draw_round_rect(c, x, y, LEFT_W, CARD_H, 26, colors.Color(0.06, 0.12, 0.23), stroke=colors.Color(1, 1, 1, 0.1))

    pill_y = PAGE_H - MARGIN - 34
    draw_round_rect(c, x + 16, pill_y, 190, 24, 12, colors.Color(1, 1, 1, 0.05), stroke=colors.Color(1, 1, 1, 0.12))
    c.setFillColor(accent)
    c.circle(x + 30, pill_y + 12, 4, stroke=0, fill=1)
    c.setFillColor(colors.Color(0.78, 0.84, 0.92))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 42, pill_y + 8, "IFL 2026 USER SPOTLIGHT")

    photo_x = x + 16
    photo_y = y + 16
    photo_w = LEFT_W - 32
    photo_h = CARD_H - 68
    draw_round_rect(c, photo_x, photo_y, photo_w, photo_h, 22, colors.Color(0.08, 0.18, 0.34), stroke=colors.Color(1, 1, 1, 0.1))

    img = decode_logo(logo_data)
    if img:
        c.drawImage(img, photo_x, photo_y, photo_w, photo_h, preserveAspectRatio=True, mask='auto', anchor='c')
    else:
        c.setFillColor(colors.Color(0.95, 0.97, 1.0, 0.92))
        c.setFont("Helvetica-Bold", 58)
        c.drawCentredString(photo_x + photo_w / 2, photo_y + photo_h / 2 - 18, initials(team_name))

    badge_w = 150
    badge_h = 24
    badge_x = photo_x + 12
    badge_y = photo_y + 12
    draw_round_rect(c, badge_x, badge_y, badge_w, badge_h, 12, colors.Color(0.04, 0.07, 0.12, 0.76), stroke=colors.Color(1, 1, 1, 0.12))
    c.setFillColor(colors.HexColor("#ffbe0b"))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(badge_x + 12, badge_y + 8, "FROZEN SQUAD STORY")


def draw_stats(c, stats):
    box_y = PAGE_H - MARGIN - 205
    box_w = (RIGHT_W - 28) / 3
    for i, (value, label) in enumerate(stats):
        x = RIGHT_X + i * (box_w + 14)
        draw_round_rect(c, x, box_y, box_w, 72, 18, colors.Color(0.07, 0.14, 0.25), stroke=colors.Color(1, 1, 1, 0.08))
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", fit_text(c, str(value), "Helvetica-Bold", 24, 14, box_w - 22))
        c.drawString(x + 14, box_y + 40, str(value))
        c.setFillColor(colors.Color(0.67, 0.74, 0.84))
        c.setFont("Helvetica-Bold", 8)
        c.drawString(x + 14, box_y + 16, label.upper())


def draw_insight_grid(c, insights):
    top_y = PAGE_H - MARGIN - 300
    box_w = (RIGHT_W - 14) / 2
    box_h = 120
    palette = {
        "orange": colors.Color(0.23, 0.11, 0.08),
        "blue": colors.Color(0.07, 0.16, 0.23),
        "gold": colors.Color(0.22, 0.17, 0.07),
        "green": colors.Color(0.06, 0.18, 0.14),
    }
    border = {
        "orange": colors.Color(1.0, 0.36, 0.22, 0.32),
        "blue": colors.Color(0.0, 0.7, 0.84, 0.28),
        "gold": colors.Color(1.0, 0.75, 0.04, 0.28),
        "green": colors.Color(0.13, 0.79, 0.6, 0.28),
    }
    for idx, (title, copy, kind) in enumerate(insights):
        row = idx // 2
        col = idx % 2
        x = RIGHT_X + col * (box_w + 14)
        y = top_y - row * (box_h + 14)
        draw_round_rect(c, x, y, box_w, box_h, 20, palette.get(kind, colors.Color(0.1, 0.13, 0.2)), stroke=border.get(kind, colors.Color(1, 1, 1, 0.1)))
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(x + 14, y + box_h - 22, title)
        draw_wrapped_text(c, copy, x + 14, y + box_h - 42, box_w - 28, "Helvetica", 10.5, colors.Color(0.79, 0.84, 0.92), leading=14, max_lines=5)


def generate_pdf(team_name: str):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        user_row = fetch_user(conn, team_name)
        squad = fetch_squad(conn, int(user_row[0]))
        ownership = fetch_ownership(conn)
        total_users = int(conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] or 0)
        stats, insights, accent_team = build_insights(user_row, squad, ownership, total_users)
    finally:
        conn.close()

    pdf_path = OUT_DIR / f"{slugify(team_name)}.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=(PAGE_W, PAGE_H))

    c.setFillColor(colors.Color(0.03, 0.07, 0.12))
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

    accent = hex_color(TEAM_COLORS.get(accent_team, "#ff5c39"))
    c.setFillColor(colors.Color(accent.red, accent.green, accent.blue, alpha=0.18))
    c.circle(120, PAGE_H - 70, 120, stroke=0, fill=1)
    c.circle(PAGE_W - 120, PAGE_H - 40, 140, stroke=0, fill=1)

    draw_round_rect(c, MARGIN, MARGIN, CARD_W, CARD_H, 30, colors.Color(0.05, 0.10, 0.18, 0.98), stroke=colors.Color(1, 1, 1, 0.12))
    draw_photo_panel(c, user_row[2], user_row[3] or "", accent)

    c.setFillColor(colors.HexColor("#ffbe0b"))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(RIGHT_X, PAGE_H - MARGIN - 24, "USER STORY CARD")

    title_size = fit_text(c, user_row[2], "Helvetica-Bold", 34, 20, RIGHT_W - 10)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", title_size)
    c.drawString(RIGHT_X, PAGE_H - MARGIN - 60, user_row[2])

    subtitle = (
        "A grounded user insight card built from the current stored squad. This version blends real roster shape, "
        "ownership behavior, and one league personality note into a single visual story."
    )
    draw_wrapped_text(c, subtitle, RIGHT_X, PAGE_H - MARGIN - 88, RIGHT_W - 10, "Helvetica", 11.5, colors.Color(0.67, 0.74, 0.84), leading=16, max_lines=3)

    draw_stats(c, stats)
    draw_insight_grid(c, insights)

    footer_y = MARGIN + 20
    preview = ", ".join(r[1] for r in squad[:6])
    for idx, text in enumerate((f"Squad preview: {preview}", f"Phone: {user_row[1]}")):
        w = min(stringWidth(text, "Helvetica", 9) + 24, RIGHT_W - (RIGHT_W/2 if idx==0 else 0))
        x = RIGHT_X + (0 if idx == 0 else RIGHT_W - w)
        draw_round_rect(c, x, footer_y, w, 24, 12, colors.Color(1, 1, 1, 0.05), stroke=colors.Color(1, 1, 1, 0.10))
        c.setFillColor(colors.Color(0.79, 0.84, 0.92))
        c.setFont("Helvetica", 9)
        c.drawString(x + 12, footer_y + 8, text)

    c.showPage()
    c.save()
    return pdf_path


def main():
    import sys
    team_name = sys.argv[1] if len(sys.argv) > 1 else "Murgichor XI"
    path = generate_pdf(team_name)
    print(path)


if __name__ == "__main__":
    main()
