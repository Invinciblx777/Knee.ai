"""Simulated segmentation overlays drawn with OpenCV/PIL.

The bone region is located first with an Otsu threshold so the zones land on the
anatomy rather than on the frame — important for films that are cropped oddly or
that show both knees. Zones are then placed proportionally inside that region and
jittered deterministically from the image hash, and rendered as labelled boxes
plus measurement callouts. A separate PNG is produced per structure combination
so the frontend can toggle overlays without a round-trip.
"""

import io
import os
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

from services.seed import rng_for

# BGR, because OpenCV.
COLORS = {
    "femur": (246, 130, 59),      # #3B82F6 blue
    "meniscus": (129, 185, 16),   # #10B981 green
    "tibia": (68, 68, 239),       # #EF4444 red
}
HEX_COLORS = {"femur": "#3B82F6", "meniscus": "#10B981", "tibia": "#EF4444"}

STRUCTURES = ["femur", "meniscus", "tibia"]

MAX_EDGE = 1100


def load_image(data: bytes) -> np.ndarray:
    """Decode upload bytes to a BGR array. Handles JPEG/PNG and DICOM-lite."""
    array = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if img is None:
        # Fall back to PIL for formats OpenCV declines (e.g. 16-bit PNG, TIFF).
        pil = Image.open(io.BytesIO(data)).convert("RGB")
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return _fit(img)


def _fit(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    scale = MAX_EDGE / float(max(h, w))
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def _cluster_columns(blobs, min_overlap=0.4):
    """Group blobs that occupy the same vertical column into one limb.

    The joint space splits a limb into separate femur and tibia components, so
    components whose horizontal extents overlap are unioned back together.
    """
    clusters = []
    for b in sorted(blobs, key=lambda b: b[cv2.CC_STAT_LEFT]):
        x0, x1 = b[cv2.CC_STAT_LEFT], b[cv2.CC_STAT_LEFT] + b[cv2.CC_STAT_WIDTH]
        y0, y1 = b[cv2.CC_STAT_TOP], b[cv2.CC_STAT_TOP] + b[cv2.CC_STAT_HEIGHT]
        area = b[cv2.CC_STAT_AREA]
        for c in clusters:
            overlap = min(x1, c["x1"]) - max(x0, c["x0"])
            if overlap > 0 and overlap >= min_overlap * min(x1 - x0, c["x1"] - c["x0"]):
                c["x0"], c["x1"] = min(c["x0"], x0), max(c["x1"], x1)
                c["y0"], c["y1"] = min(c["y0"], y0), max(c["y1"], y1)
                c["area"] += area
                break
        else:
            clusters.append({"x0": x0, "x1": x1, "y0": y0, "y1": y1, "area": area})
    return clusters


def detect_roi(img: np.ndarray, affected_side: Optional[str] = None) -> Dict[str, int]:
    """Locate the bone region so overlays land on anatomy, not on the frame.

    Otsu-thresholds the blurred greyscale, merges the components belonging to one
    limb, and — when a film shows both knees — picks the limb matching
    ``affected_side``. Standard AP radiographs are displayed as if facing the
    patient, so the patient's left knee appears on the viewer's right. Falls back
    to the full frame if nothing convincing is found.
    """
    h, w = img.shape[:2]
    full = {"x": 0, "y": 0, "w": w, "h": h, "detected": False}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (9, 9), 0)
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    kernel = np.ones((11, 11), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    count, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if count < 2:
        return full

    # Drop the background label, then anything too small to be part of a limb.
    blobs = [stats[i] for i in range(1, count) if stats[i][cv2.CC_STAT_AREA] > 0.01 * h * w]
    if not blobs:
        return full

    limbs = _cluster_columns(blobs)
    largest = max(c["area"] for c in limbs)
    limbs = [c for c in limbs if c["area"] >= 0.45 * largest]

    if len(limbs) > 1 and affected_side:
        limbs.sort(key=lambda c: c["x0"])
        chosen = limbs[-1] if affected_side.lower().startswith("l") else limbs[0]
    else:
        chosen = max(limbs, key=lambda c: c["area"])

    x, y = int(chosen["x0"]), int(chosen["y0"])
    bw, bh = int(chosen["x1"] - chosen["x0"]), int(chosen["y1"] - chosen["y0"])

    # A sliver means the threshold told us nothing useful; fall back to the frame.
    if bw < 0.08 * w or bh < 0.25 * h:
        return full

    # Bone alone is narrower than the joint; widen a little so the zones read as
    # anatomy boxes rather than shrink-wrapped bone outlines.
    pad_x = int(bw * 0.18)
    x = max(x - pad_x, 0)
    bw = min(bw + 2 * pad_x, w - x)

    return {"x": x, "y": y, "w": bw, "h": bh, "detected": True}


def compute_zones(
    digest: str,
    shape: Tuple[int, int],
    roi: Optional[Dict[str, int]] = None,
    affected_side: Optional[str] = None,
) -> Dict[str, Dict]:
    """Bounding boxes for femur / meniscus / tibia, placed inside the bone ROI.

    The meniscus box covers the medial compartment only, which on an AP view sits
    on the image-left half for a left knee and the image-right half for a right one.
    """
    img_h, img_w = shape[:2]
    if roi is None:
        roi = {"x": 0, "y": 0, "w": img_w, "h": img_h}
    rx, ry, rw, rh = roi["x"], roi["y"], roi["w"], roi["h"]

    rng = rng_for(digest, "zones")
    jx = rng.uniform(-0.02, 0.02)
    jy = rng.uniform(-0.025, 0.025)

    left = 0.06 + jx
    right = 0.94 + jx
    joint = 0.50 + jy

    is_left_knee = bool(affected_side) and affected_side.lower().startswith("l")

    def box(y0, y1, x0, x1):
        x = int(rx + x0 * rw)
        y = int(ry + y0 * rh)
        return {
            "x": max(x, 0),
            "y": max(y, 0),
            "w": max(int((x1 - x0) * rw), 8),
            "h": max(int((y1 - y0) * rh), 8),
        }

    # Medial compartment: image-left for a left knee, image-right for a right knee.
    if is_left_knee:
        men_x0, men_x1 = left + 0.04, left + 0.50
    else:
        men_x0, men_x1 = right - 0.50, right - 0.04

    return {
        "femur": box(joint - 0.32, joint - 0.05, left, right),
        "meniscus": box(joint - 0.035, joint + 0.035, men_x0, men_x1),
        "tibia": box(joint + 0.055, joint + 0.34, left, right),
    }


def _label(img, text, org, color, scale=0.55):
    x, y = org
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, 1)
    cv2.rectangle(img, (x, y - th - 7), (x + tw + 10, y + 4), color, -1)
    cv2.putText(img, text, (x + 5, y - 2), cv2.FONT_HERSHEY_SIMPLEX, scale, (255, 255, 255), 1, cv2.LINE_AA)


def _draw_zone(img, zone, color, title, alpha=0.16, title_pos="above"):
    x, y, w, h = zone["x"], zone["y"], zone["w"], zone["h"]
    overlay = img.copy()
    cv2.rectangle(overlay, (x, y), (x + w, y + h), color, -1)
    cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)
    cv2.rectangle(img, (x, y), (x + w, y + h), color, 2)
    if not title:
        return
    if title_pos == "below":
        _label(img, title, (x, min(y + h + 20, img.shape[0] - 4)), color)
    else:
        _label(img, title, (x, max(y - 4, 18)), color)


def _draw_measurements(img, zone, color, measurements: List[Dict]):
    """Calliper lines across the meniscus zone with a stacked label column.

    Labels sit clear of the zone (to its right when there is room, otherwise to
    its left) and connect back to their calliper with a leader line, so the
    three callouts never overlap each other or the tibia box.
    """
    x, y, w, h = zone["x"], zone["y"], zone["w"], zone["h"]
    img_w = img.shape[1]
    n = len(measurements)

    header = "MEDIAL MENISCUS"
    texts = ["{}  {:.1f} mm".format(m["label"], m["thickness_mm"]) for m in measurements]
    label_w = max(
        cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0][0] for t in texts + [header]
    ) + 14

    right_room = img_w - (x + w) - 12
    if right_room >= label_w:
        col_x = x + w + 12
        leader_to_left = True
    else:
        col_x = max(x - label_w - 12, 4)
        leader_to_left = False

    row_gap = 26
    # Header sits above the three measurement rows; centre the block on the zone.
    col_top = int(y + h / 2 - row_gap)
    col_top = max(col_top, 22 + row_gap)
    col_top = min(col_top, img.shape[0] - row_gap * n - 8)
    _label(img, header, (col_x, col_top - row_gap), color, scale=0.5)

    for i, m in enumerate(measurements):
        mx = x + int(w * (i + 1) / (n + 1))
        top, bottom = y + 2, y + h - 2
        cv2.line(img, (mx, top), (mx, bottom), color, 2, cv2.LINE_AA)
        cv2.line(img, (mx - 7, top), (mx + 7, top), color, 2, cv2.LINE_AA)
        cv2.line(img, (mx - 7, bottom), (mx + 7, bottom), color, 2, cv2.LINE_AA)
        cv2.circle(img, (mx, (top + bottom) // 2), 3, color, -1, cv2.LINE_AA)

        ly = col_top + i * row_gap
        anchor_x = col_x - 6 if leader_to_left else col_x + label_w + 6
        cv2.line(img, (mx, (top + bottom) // 2), (anchor_x, ly - 5), color, 1, cv2.LINE_AA)
        _label(img, texts[i], (col_x, ly), color, scale=0.5)


def polygon_zones(polygons: Dict[str, List]) -> Dict[str, Dict]:
    """Bounding box per structure, so labels and arrows can reuse the zone logic."""
    zones = {}
    for key, pts in polygons.items():
        arr = np.array(pts, np.int32)
        x, y = int(arr[:, 0].min()), int(arr[:, 1].min())
        zones[key] = {
            "x": x, "y": y,
            "w": int(arr[:, 0].max()) - x,
            "h": int(arr[:, 1].max()) - y,
        }
    return zones


def _draw_polygon(img, pts, color, title, alpha=0.20, title_pos="above"):
    """Filled translucent contour with a crisp outline — the model-inference look."""
    arr = np.array(pts, np.int32).reshape((-1, 1, 2))
    overlay = img.copy()
    cv2.fillPoly(overlay, [arr], color)
    cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, img)
    cv2.polylines(img, [arr], True, color, 2, cv2.LINE_AA)
    if not title:
        return
    x, y = int(arr[:, 0, 0].min()), int(arr[:, 0, 1].min())
    if title_pos == "below":
        _label(img, title, (x, min(int(arr[:, 0, 1].max()) + 20, img.shape[0] - 4)), color)
    else:
        _label(img, title, (x, max(y - 4, 18)), color)


def _polygon_extent(pts, x, shape):
    """Vertical extent of a polygon at column x, used for real calliper lines."""
    mask = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(mask, [np.array(pts, np.int32)], 255)
    col = np.flatnonzero(mask[:, min(max(x, 0), shape[1] - 1)])
    if col.size == 0:
        return None
    return int(col[0]), int(col[-1])


def _draw_polygon_measurements(img, pts, color, measurements):
    """Callipers spanning the real meniscus contour at three anatomical columns."""
    arr = np.array(pts, np.int32)
    x0, x1 = int(arr[:, 0].min()), int(arr[:, 0].max())
    y0, y1 = int(arr[:, 1].min()), int(arr[:, 1].max())
    n = len(measurements)

    header = "MEDIAL MENISCUS"
    texts = ["{}  {:.1f} mm".format(m["label"], m["thickness_mm"]) for m in measurements]
    label_w = max(
        cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0][0] for t in texts + [header]
    ) + 14

    right_room = img.shape[1] - x1 - 12
    if right_room >= label_w:
        col_x, leader_left = x1 + 12, True
    else:
        col_x, leader_left = max(x0 - label_w - 12, 4), False

    row_gap = 26
    col_top = int((y0 + y1) / 2 - row_gap)
    col_top = max(col_top, 22 + row_gap)
    col_top = min(col_top, img.shape[0] - row_gap * n - 8)
    _label(img, header, (col_x, col_top - row_gap), color, scale=0.5)

    for i, m in enumerate(measurements):
        mx = x0 + int((x1 - x0) * (i + 1) / (n + 1))
        extent = _polygon_extent(pts, mx, img.shape)
        if extent is None:
            continue
        top, bottom = extent
        cv2.line(img, (mx, top), (mx, bottom), color, 2, cv2.LINE_AA)
        cv2.line(img, (mx - 7, top), (mx + 7, top), color, 2, cv2.LINE_AA)
        cv2.line(img, (mx - 7, bottom), (mx + 7, bottom), color, 2, cv2.LINE_AA)

        ly = col_top + i * row_gap
        anchor = col_x - 6 if leader_left else col_x + label_w + 6
        cv2.line(img, (mx, (top + bottom) // 2), (anchor, ly - 5), color, 1, cv2.LINE_AA)
        _label(img, texts[i], (col_x, ly), color, scale=0.5)


def annotate(
    img: np.ndarray,
    zones: Dict[str, Dict],
    measurements: List[Dict],
    bones: Dict,
    structures: Optional[List[str]] = None,
    polygons: Optional[Dict[str, List]] = None,
) -> np.ndarray:
    """Render the requested overlay structures onto a copy of the image.

    With ``polygons`` (the model-inference path) the real per-pixel contours are
    drawn; without them the proportional simulation zones are used instead.
    """
    structures = STRUCTURES if structures is None else structures
    out = img.copy()
    polygons = polygons or {}

    if "femur" in structures:
        z = zones["femur"]
        if "femur" in polygons:
            _draw_polygon(out, polygons["femur"], COLORS["femur"], "FEMUR")
        else:
            _draw_zone(out, z, COLORS["femur"], "FEMUR")
        y = z["y"] + int(z["h"] * 0.62)
        _width_arrow(out, z, y, COLORS["femur"])
        _label(out, "Femoral ML {:.1f} mm".format(bones["femoral_ml_mm"]),
               _clamp(out, z["x"] + 8, y - 8), COLORS["femur"], scale=0.5)

    if "tibia" in structures:
        z = zones["tibia"]
        if "tibia" in polygons:
            _draw_polygon(out, polygons["tibia"], COLORS["tibia"], "TIBIA", title_pos="below")
        else:
            _draw_zone(out, z, COLORS["tibia"], "TIBIA", title_pos="below")

        # Slope line sits on the plateau, its label one row under it; the ML arrow
        # and its label take the two rows below that, so nothing ever collides.
        slope = bones["tibial_slope_deg"]
        x0, x1 = z["x"] + 10, z["x"] + z["w"] - 10
        dy = int((x1 - x0) * np.tan(np.radians(slope)) * 0.25)
        cv2.line(out, (x0, z["y"] + 6), (x1, z["y"] + 6 + dy), COLORS["tibia"], 2, cv2.LINE_AA)
        # The joint line is crowded by the meniscus callouts, so the slope reading
        # is parked at the bottom-right of the tibia instead, with a leader line.
        slope_text = "Tibial Slope {:.1f} deg".format(slope)
        tw = cv2.getTextSize(slope_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0][0] + 14
        sx, sy = _clamp(out, z["x"] + z["w"] - tw, z["y"] + z["h"] - 16)
        cv2.line(out, (x1 - 6, z["y"] + 8 + dy), (sx + tw - 12, sy - 18), COLORS["tibia"], 1, cv2.LINE_AA)
        _label(out, slope_text, (sx, sy), COLORS["tibia"], scale=0.5)

        arrow_y = min(z["y"] + max(int(z["h"] * 0.34), 62), z["y"] + z["h"] - 10)
        _width_arrow(out, z, arrow_y, COLORS["tibia"])
        _label(out, "Tibial ML {:.1f} mm".format(bones["tibial_ml_mm"]),
               _clamp(out, z["x"] + 8, arrow_y + 24), COLORS["tibia"], scale=0.5)

    if "meniscus" in structures:
        if "meniscus" in polygons:
            _draw_polygon(out, polygons["meniscus"], COLORS["meniscus"], None, alpha=0.30)
            _draw_polygon_measurements(out, polygons["meniscus"], COLORS["meniscus"], measurements)
        else:
            _draw_zone(out, zones["meniscus"], COLORS["meniscus"], None, alpha=0.22)
            _draw_measurements(out, zones["meniscus"], COLORS["meniscus"], measurements)

    return out


def _width_arrow(img, zone, y, color):
    """Double-headed arrow spanning the zone width at height y."""
    x0, x1 = zone["x"] + 6, zone["x"] + zone["w"] - 6
    cv2.arrowedLine(img, (x0, y), (x1, y), color, 2, tipLength=0.03)
    cv2.arrowedLine(img, (x1, y), (x0, y), color, 2, tipLength=0.03)


def _clamp(img, x, y, pad=4):
    """Keep a label anchor inside the frame."""
    h, w = img.shape[:2]
    return (max(min(x, w - pad), pad), max(min(y, h - pad), 16))


def encode_png(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise RuntimeError("PNG encode failed")
    return buf.tobytes()


def _encode_data_url(img: np.ndarray) -> str:
    """Encode an image as a base64 JPEG data URL (much smaller than PNG)."""
    import base64
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 82])
    if not ok:
        raise RuntimeError("JPEG encode failed")
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return "data:image/jpeg;base64,{}".format(b64)


def save_png(img: np.ndarray, path: str) -> str:
    with open(path, "wb") as fh:
        fh.write(encode_png(img))
    return path


def render_variants(
    img: np.ndarray,
    zones: Dict,
    measurements: List[Dict],
    bones: Dict,
    out_dir: str,
    analysis_id: str,
    polygons: Optional[Dict[str, List]] = None,
) -> Dict[str, Dict[str, str]]:
    """Pre-render every on/off combination of the three overlays.

    Returns ``{"filenames": {...}, "data": {...}}`` where *filenames* maps
    variant keys to on-disk basenames and *data* maps them to base64 JPEG
    data-URLs.  The inline data lets the frontend display images immediately
    without a second round-trip — critical in serverless environments where
    ``/tmp`` is ephemeral.
    """
    os.makedirs(out_dir, exist_ok=True)
    filenames = {}
    data = {}

    original_path = os.path.join(out_dir, "{}_original.png".format(analysis_id))
    save_png(img, original_path)
    filenames["none"] = os.path.basename(original_path)
    data["none"] = _encode_data_url(img)

    for mask in range(1, 8):
        active = [s for i, s in enumerate(STRUCTURES) if mask & (1 << i)]
        key = "-".join(sorted(active))
        rendered = annotate(img, zones, measurements, bones, active, polygons)
        path = os.path.join(out_dir, "{}_{}.png".format(analysis_id, key))
        save_png(rendered, path)
        filenames[key] = os.path.basename(path)
        data[key] = _encode_data_url(rendered)

    return {"filenames": filenames, "data": data}

