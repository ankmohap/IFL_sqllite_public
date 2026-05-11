#!/usr/bin/env python3
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "current_phase_user_guide_2026.pdf"
ASSETS = ROOT / "current_phase_guide_assets"

NAVY = colors.HexColor("#10213d")
NAVY_2 = colors.HexColor("#1b3157")
ORANGE = colors.HexColor("#ff6b35")
GOLD = colors.HexColor("#ffb703")
SKY = colors.HexColor("#00b4d8")
INK = colors.HexColor("#24364d")
MUTED = colors.HexColor("#5b6f8b")
SOFT_BLUE = colors.HexColor("#eef5ff")
SOFT_GOLD = colors.HexColor("#fff6e6")
SOFT_ORANGE = colors.HexColor("#fff0ea")
LINE_BLUE = colors.HexColor("#ceddf3")
LINE_GOLD = colors.HexColor("#f0d9a5")


def scaled_image(path: Path, max_width_mm: float = 160, max_height_mm: float = 88):
    img = Image(str(path))
    iw, ih = img.imageWidth, img.imageHeight
    if not iw or not ih:
        return img
    max_w = max_width_mm * mm
    max_h = max_height_mm * mm
    ratio = min(max_w / iw, max_h / ih)
    img.drawWidth = iw * ratio
    img.drawHeight = ih * ratio
    return img


def build_pdf():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="Hero",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=25,
            leading=29,
            textColor=colors.white,
            alignment=TA_CENTER,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SubHero",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=colors.HexColor("#dce8ff"),
            alignment=TA_CENTER,
            spaceAfter=0,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SectionTitle",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=17,
            leading=20,
            textColor=NAVY,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CardText",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=INK,
        )
    )
    styles.add(
        ParagraphStyle(
            name="SmallTag",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.white,
            alignment=TA_CENTER,
        )
    )
    styles.add(
        ParagraphStyle(
            name="FooterText",
            parent=styles["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=10,
            leading=14,
            textColor=MUTED,
            alignment=TA_CENTER,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Caption",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceBefore=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ShotTitle",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=NAVY,
            alignment=TA_CENTER,
        )
    )

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="IFL 2026 Current Phase User Guide",
        author="Codex",
    )

    story = []
    hero = Table(
        [
            [Paragraph("IFL 2026", styles["SmallTag"])],
            [Paragraph("Current Phase Guide", styles["Hero"])],
            [Paragraph("Offline quick reference for the frozen squads phase. Share this with users as the latest action guide.", styles["SubHero"])],
        ],
        colWidths=[174 * mm],
        hAlign="CENTER",
    )
    hero.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NAVY),
                ("BACKGROUND", (0, 0), (0, 0), ORANGE),
                ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (0, 0), 6),
                ("BOTTOMPADDING", (0, 0), (0, 0), 6),
                ("TOPPADDING", (0, 1), (0, 1), 14),
                ("BOTTOMPADDING", (0, 1), (0, 1), 4),
                ("TOPPADDING", (0, 2), (0, 2), 2),
                ("BOTTOMPADDING", (0, 2), (0, 2), 16),
                ("ROUNDEDCORNERS", [10, 10, 10, 10]),
            ]
        )
    )
    story.append(hero)
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("Action Items", styles["SectionTitle"]))
    action_rows = [
        ["1. Verify Your Team", "Go to <b>My Team</b> and verify your team."],
        ["2. Check Other Teams", "Go to <b>Frozen Squads</b> if you want to check other teams."],
        ["3. Confirm Next Prediction", "Go to <b>Predictions</b> and check if you have predicted the winner for the next match."],
    ]
    action_table = Table(
        [[Paragraph(a, styles["CardText"]), Paragraph(b, styles["CardText"])] for a, b in action_rows],
        colWidths=[52 * mm, 112 * mm],
        hAlign="LEFT",
    )
    action_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT_BLUE),
                ("BOX", (0, 0), (-1, -1), 1, LINE_BLUE),
                ("INNERGRID", (0, 0), (-1, -1), 0.75, LINE_BLUE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#dfeeff")),
                ("TEXTCOLOR", (0, 0), (0, -1), NAVY_2),
            ]
        )
    )
    story.append(action_table)
    story.append(Spacer(1, 8 * mm))

    story.append(Paragraph("Insights", styles["SectionTitle"]))
    insight_rows = [
        [
            "1. Player Popularity",
            "The <b>*</b> mark on <b>My Team</b> tells how popular your player is in IFL 2026 based on how many members have picked that player.",
        ],
        [
            "2. Chai Pe Charcha",
            "Go to <b>Chai Pe Charcha</b> to get various kinds of interesting insight-based notifications.",
        ],
    ]
    insight_table = Table(
        [[Paragraph(a, styles["CardText"]), Paragraph(b, styles["CardText"])] for a, b in insight_rows],
        colWidths=[52 * mm, 112 * mm],
        hAlign="LEFT",
    )
    insight_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT_GOLD),
                ("BOX", (0, 0), (-1, -1), 1, LINE_GOLD),
                ("INNERGRID", (0, 0), (-1, -1), 0.75, LINE_GOLD),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#ffe9be")),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#7f4c00")),
            ]
        )
    )
    story.append(insight_table)
    story.append(Spacer(1, 10 * mm))

    flow = Table(
        [[Paragraph("Recommended user flow: <b>My Team</b> → <b>Frozen Squads</b> → <b>Predictions</b> → <b>Chai Pe Charcha</b>", styles["CardText"])]],
        colWidths=[174 * mm],
        hAlign="CENTER",
    )
    flow.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT_ORANGE),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#f3c5b5")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                ("ROUNDEDCORNERS", [8, 8, 8, 8]),
            ]
        )
    )
    story.append(flow)
    story.append(Spacer(1, 8 * mm))
    screenshot_specs = [
        ("01-my-team.png", "My Team: verify your frozen team and review popularity markers."),
        ("02-frozen-squads.png", "Frozen Squads: compare your squad with other teams."),
        ("03-predictions.png", "Predictions: confirm your pick for the next match before toss time."),
        ("04-chai-pe-charcha.png", "Chai Pe Charcha: watch for interesting insight-based notifications."),
    ]
    if any((ASSETS / name).is_file() for name, _ in screenshot_specs):
        story.append(PageBreak())
        story.append(Paragraph("Screens", styles["SectionTitle"]))
        for name, caption in screenshot_specs:
            path = ASSETS / name
            if not path.is_file():
                continue
            title = name.split(".", 1)[0].replace("-", " ").replace("01 ", "1. ").replace("02 ", "2. ").replace("03 ", "3. ").replace("04 ", "4. ").title()
            image_card = Table(
                [[Paragraph(title, styles["ShotTitle"])], [scaled_image(path)], [Paragraph(caption, styles["Caption"])]],
                colWidths=[174 * mm],
                hAlign="CENTER",
            )
            image_card.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                        ("BOX", (0, 0), (-1, -1), 1, LINE_BLUE),
                        ("INNERGRID", (0, 0), (-1, -1), 0.75, LINE_BLUE),
                        ("TOPPADDING", (0, 0), (-1, 0), 7),
                        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
                        ("TOPPADDING", (0, 1), (-1, 1), 8),
                        ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
                        ("TOPPADDING", (0, 2), (-1, 2), 5),
                        ("BOTTOMPADDING", (0, 2), (-1, 2), 8),
                        ("LEFTPADDING", (0, 0), (-1, 0), 8),
                        ("RIGHTPADDING", (0, 0), (-1, 0), 8),
                        ("LEFTPADDING", (0, 1), (-1, 1), 4),
                        ("RIGHTPADDING", (0, 1), (-1, 1), 4),
                        ("LEFTPADDING", (0, 2), (-1, 2), 8),
                        ("RIGHTPADDING", (0, 2), (-1, 2), 8),
                        ("BACKGROUND", (0, 0), (-1, 0), SOFT_BLUE),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ]
                )
            )
            block = [image_card, Spacer(1, 6 * mm)]
            story.append(KeepTogether(block))
    story.append(Paragraph("Prepared for IFL 2026 participants. Keep this guide handy during the frozen squads phase.", styles["FooterText"]))

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
    print(OUT)
