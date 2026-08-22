"""Clinical PDF report generation (ReportLab)."""

import os
from typing import Dict

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

NAVY = colors.HexColor("#0F172A")
BLUE = colors.HexColor("#3B82F6")
GREEN = colors.HexColor("#10B981")
RED = colors.HexColor("#EF4444")
AMBER = colors.HexColor("#F59E0B")
BORDER = colors.HexColor("#E2E8F0")
MUTED = colors.HexColor("#64748B")

SEVERITY_COLOR = {
    "Normal": GREEN,
    "Mild OA": BLUE,
    "Moderate OA": AMBER,
    "Severe OA": RED,
}

DISCLAIMER = (
    "This tool is intended for research and decision support only. "
    "Final diagnosis remains with the clinician."
)


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("t", parent=base["Title"], fontName="Helvetica-Bold",
                                fontSize=17, textColor=NAVY, spaceAfter=2, alignment=0),
        "subtitle": ParagraphStyle("st", parent=base["Normal"], fontName="Helvetica",
                                   fontSize=8.5, textColor=MUTED),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold",
                             fontSize=11, textColor=NAVY, spaceBefore=12, spaceAfter=6),
        "body": ParagraphStyle("b", parent=base["Normal"], fontName="Helvetica",
                               fontSize=9, textColor=NAVY, leading=13),
        "small": ParagraphStyle("s", parent=base["Normal"], fontName="Helvetica",
                                fontSize=7.8, textColor=MUTED, leading=11),
        "disclaimer": ParagraphStyle("d", parent=base["Normal"], fontName="Helvetica-Oblique",
                                     fontSize=8, textColor=MUTED, alignment=TA_CENTER, leading=11),
        "caption": ParagraphStyle("c", parent=base["Normal"], fontName="Helvetica-Bold",
                                  fontSize=8, textColor=MUTED, alignment=TA_CENTER),
    }


def _table_style(header=True):
    cmds = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (-1, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, BORDER),
        ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ]
    if header:
        cmds += [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
            ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
            ("FONTSIZE", (0, 0), (-1, 0), 7.5),
            ("LINEBELOW", (0, 0), (-1, 0), 0.8, BORDER),
        ]
    return TableStyle(cmds)


def _header(story, s, record):
    logo = Table([[Paragraph("<b>KA</b>", ParagraphStyle(
        "lg", fontName="Helvetica-Bold", fontSize=13, textColor=colors.white, alignment=TA_CENTER))]],
        colWidths=[16 * mm], rowHeights=[16 * mm])
    logo.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    title_block = [
        Paragraph("AI-Assisted Knee Analysis Report", s["title"]),
        Paragraph("Medial Meniscus OA Assessment &amp; Patient-Specific Implant Sizing", s["subtitle"]),
    ]
    meta = Paragraph(
        "Report ID<br/><b>{}</b><br/><br/>Generated<br/><b>{}</b>".format(
            record["analysis_id"], record["created_at"].replace("T", " ")),
        s["small"])

    head = Table([[logo, title_block, meta]], colWidths=[18 * mm, 112 * mm, 40 * mm])
    head.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 8),
        ("RIGHTPADDING", (-1, 0), (-1, 0), 0),
    ]))
    story.append(head)
    story.append(Spacer(1, 6))
    story.append(Table([[""]], colWidths=[170 * mm], rowHeights=[1],
                       style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), BORDER)])))
    _mode_strip(story, s, record)


def _mode_strip(story, s, record):
    """Inference-mode banner: green for model inference, amber for demo mode."""
    is_model = record.get("mode") == "model_inference"
    fill = colors.HexColor("#ECFDF5") if is_model else colors.HexColor("#FEF3C7")
    edge = GREEN if is_model else AMBER
    label = record.get("mode_label", "Demo Mode")
    if is_model:
        detail = "Segmentation and measurements read from the loaded model output ({}).".format(
            record.get("provenance", {}).get("method", "loaded model"))
    else:
        detail = record.get("demo_banner", "")

    strip = Table(
        [[Paragraph('<font color="white"><b>{}</b></font>'.format(label),
                    ParagraphStyle("ms", fontName="Helvetica-Bold", fontSize=8.5,
                                   textColor=colors.white, alignment=TA_CENTER)),
          Paragraph(detail, s["small"])]],
        colWidths=[36 * mm, 134 * mm])
    strip.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), edge),
        ("BACKGROUND", (1, 0), (1, 0), fill),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.6, edge),
        ("LEFTPADDING", (1, 0), (1, 0), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(Spacer(1, 6))
    story.append(strip)


def _patient_block(story, s, record):
    p = record["patient"]
    story.append(Paragraph("Patient", s["h2"]))
    rows = [
        ["Name", "Age", "Sex", "Imaging", "Affected Side"],
        [p["name"], str(p["age"]), p["sex"], p["imaging_type"], p["affected_side"]],
    ]
    t = Table(rows, colWidths=[52 * mm, 22 * mm, 26 * mm, 34 * mm, 36 * mm])
    t.setStyle(_table_style())
    story.append(t)
    story.append(Spacer(1, 8))

def _advice_block(story, s, record):
    advice = record.get("advice")
    if not advice:
        return
        
    story.append(Paragraph("Doctor's Advice", s["h2"]))
    
    # We use a table to give it a nice background and border
    t = Table([[Paragraph(advice.replace("\n", "<br/>"), s["body"])]], colWidths=[170 * mm])
    style = _table_style(header=False)
    style.add("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ECFDF5")) # light green background
    style.add("BOX", (0, 0), (-1, -1), 0.6, GREEN)
    t.setStyle(style)
    
    story.append(t)
    story.append(Spacer(1, 8))


def _findings_block(story, s, record):
    a = record["meniscus"]["assessment"]
    kl = record["meniscus"]["kl_grade"]
    sev = SEVERITY_COLOR[a["classification"]]

    story.append(Paragraph("Module 1 — Medial Meniscus Assessment", s["h2"]))

    badge = Table(
        [[Paragraph('<font color="white"><b>{}</b></font>'.format(a["classification"]),
                    ParagraphStyle("bd", fontName="Helvetica-Bold", fontSize=10,
                                   textColor=colors.white, alignment=TA_CENTER)),
          Paragraph("<b>KL Grade {}</b><br/>{}".format(kl["grade"], kl["description"]), s["small"]),
          Paragraph("<b>Mean thickness</b><br/>{:.2f} mm (min {:.1f} mm)".format(
              a["mean_thickness_mm"], a["min_thickness_mm"]), s["small"])]],
        colWidths=[42 * mm, 78 * mm, 50 * mm], rowHeights=[14 * mm])
    badge.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), sev),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (1, 0), (-1, -1), 0.6, BORDER),
        ("LEFTPADDING", (1, 0), (-1, -1), 8),
    ]))
    story.append(badge)
    story.append(Spacer(1, 8))

    rows = [["Location", "Patient (mm)", "Male mean (mm)", "Female mean (mm)", "Deviation"]]
    for c in record["meniscus"]["population_comparison"]:
        rows.append([
            c["label"], "{:.1f}".format(c["patient"]),
            "{:.1f}".format(c["population_male"]), "{:.1f}".format(c["population_female"]),
            "{:+.2f} mm ({:+.1f}%)".format(c["deviation_mm"], c["deviation_pct"]),
        ])
    t = Table(rows, colWidths=[42 * mm, 30 * mm, 32 * mm, 34 * mm, 32 * mm])
    t.setStyle(_table_style())
    story.append(t)
    story.append(Spacer(1, 6))
    story.append(Paragraph("Classification basis: " + " ".join(a["rationale"]), s["small"]))


def _implant_block(story, s, record):
    imp = record["implant"]
    bones = record["bone_measurements"]

    story.append(Paragraph("Module 2 — Implant Sizing", s["h2"]))

    rows = [
        ["Femoral ML", "Femoral AP", "Tibial ML", "Tibial AP", "Tibial Slope"],
        ["{:.1f} mm".format(bones["femoral_ml_mm"]), "{:.1f} mm".format(bones["femoral_ap_mm"]),
         "{:.1f} mm".format(bones["tibial_ml_mm"]), "{:.1f} mm".format(bones["tibial_ap_mm"]),
         "{:.1f}°".format(bones["tibial_slope_deg"])],
    ]
    t = Table(rows, colWidths=[34 * mm, 34 * mm, 34 * mm, 34 * mm, 34 * mm])
    t.setStyle(_table_style())
    story.append(t)
    story.append(Spacer(1, 8))

    rec_rows = [["Rank", "Manufacturer / System", "Size", "Component dims (F-ML/AP, T-ML/AP)", "Match"]]
    ordered = [("Primary", imp["primary"])] + [
        ("Alt {}".format(i + 1), alt) for i, alt in enumerate(imp["alternatives"])
    ]
    for rank, c in ordered:
        d = c["dimensions"]
        rec_rows.append([
            rank,
            "{}\n{}".format(c["manufacturer"], c["system"]),
            c["size"],
            "{:.1f} / {:.1f} / {:.1f} / {:.1f}".format(
                d["femoral_ml"], d["femoral_ap"], d["tibial_ml"], d["tibial_ap"]),
            "{:.1f}%".format(c["confidence_pct"]),
        ])
    t = Table(rec_rows, colWidths=[18 * mm, 58 * mm, 16 * mm, 52 * mm, 26 * mm])
    style = _table_style()
    style.add("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#EFF6FF"))
    style.add("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold")
    t.setStyle(style)
    story.append(t)
    story.append(Spacer(1, 6))
    story.append(Paragraph(imp["slope_note"], s["small"]))
    story.append(Paragraph("Matching method: " + imp["method"], s["small"]))


def _images_block(story, s, record, image_dir):
    variants = record["images"]["variants"]
    original = os.path.join(image_dir, variants["none"])
    annotated = os.path.join(image_dir, variants["femur-meniscus-tibia"])
    if not (os.path.exists(original) and os.path.exists(annotated)):
        return

    story.append(Paragraph("Imaging — Original vs Simulated Segmentation", s["h2"]))
    w = 82 * mm
    h = w * record["images"]["height"] / float(record["images"]["width"])
    h = min(h, 105 * mm)
    w = h * record["images"]["width"] / float(record["images"]["height"])
    w = min(w, 82 * mm)

    grid = Table(
        [[Image(original, width=w, height=h), Image(annotated, width=w, height=h)],
         [Paragraph("Original", s["caption"]), Paragraph("Annotated (blue femur / green meniscus / red tibia)", s["caption"])]],
        colWidths=[85 * mm, 85 * mm])
    grid.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, 0), "MIDDLE"),
        ("BOX", (0, 0), (0, 0), 0.6, BORDER),
        ("BOX", (1, 0), (1, 0), 0.6, BORDER),
        ("TOPPADDING", (0, 1), (-1, 1), 4),
    ]))
    story.append(KeepTogether(grid))


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.6)
    canvas.line(20 * mm, 17 * mm, 190 * mm, 17 * mm)
    canvas.setFont("Helvetica-Oblique", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(105 * mm, 12.5 * mm, DISCLAIMER)
    canvas.setFont("Helvetica", 7)
    canvas.drawRightString(190 * mm, 8 * mm, "Page {}".format(canvas.getPageNumber()))
    canvas.drawString(20 * mm, 8 * mm, "AI-Assisted Knee Analysis Platform")
    canvas.restoreState()


def build_report(record: Dict, image_dir: str, out_path: str) -> str:
    s = _styles()
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=16 * mm, bottomMargin=24 * mm,
        title="Knee Analysis Report {}".format(record["analysis_id"]),
        author="AI-Assisted Knee Analysis Platform",
    )

    story = []
    _header(story, s, record)
    _patient_block(story, s, record)
    _advice_block(story, s, record)
    _findings_block(story, s, record)
    _implant_block(story, s, record)
    story.append(PageBreak())
    _header(story, s, record)
    _images_block(story, s, record, image_dir)
    story.append(Spacer(1, 10))
    if record.get("mode") == "model_inference":
        closing = (
            "Mode: Model Inference. Segmentation polygons and measurements were read from the "
            "stored model output for {} ({}). Image hash {}...".format(
                record.get("sample_source", "the reference case"),
                record.get("provenance", {}).get("method", "loaded model"),
                record["image_hash"][:16])
        )
    else:
        closing = (
            "Mode: Demo Mode - no live segmentation model is loaded. Measurements are produced by "
            "a simulated pipeline seeded deterministically from the image hash ({}...). Values are "
            "clinically plausible but not derived from a validated model.".format(record["image_hash"][:16])
        )
    story.append(Paragraph(closing, s["small"]))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return out_path
