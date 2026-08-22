"""Image-quality assessment and measurement uncertainty bands.

These are heuristics computed from the uploaded film — sharpness, contrast,
resolution, and whether the bone region was actually located — not a model's
own posterior. A segmentation network that reported calibrated confidence would
replace them. They exist so the UI can say which measurements deserve a manual
look instead of presenting every number with identical authority.
"""

from typing import Dict, List, Optional

import cv2
import numpy as np

# (metric value, score) pairs, ascending. Scores interpolate linearly between
# points and clamp at the ends.
_RESOLUTION_BANDS = [(200, 20), (400, 55), (700, 85), (1100, 100)]
_SHARPNESS_BANDS = [(5, 20), (30, 55), (120, 85), (400, 100)]
_CONTRAST_BANDS = [(10, 25), (25, 60), (45, 88), (70, 100)]

_WEIGHTS = {"resolution": 0.25, "sharpness": 0.30, "contrast": 0.25, "region": 0.20}

# How far above its worst factor a film's overall score may sit. Keeps one
# disqualifying factor from being averaged away by the others.
_WORST_FACTOR_HEADROOM = 25.0

# The simulated path fits proportional zones rather than per-pixel contours, so
# its measurements carry more slack than a real segmentation would.
_SIMULATED_UNCERTAINTY_MULTIPLIER = 1.6


def _band_score(value: float, bands) -> float:
    """Piecewise-linear map from a raw metric to a 0-100 sub-score."""
    if value <= bands[0][0]:
        return float(bands[0][1])
    if value >= bands[-1][0]:
        return float(bands[-1][1])
    for (x0, y0), (x1, y1) in zip(bands, bands[1:]):
        if x0 <= value <= x1:
            t = (value - x0) / float(x1 - x0)
            return y0 + t * (y1 - y0)
    return float(bands[-1][1])


def _crop_to_roi(gray: np.ndarray, roi: Optional[Dict]) -> np.ndarray:
    """Measure quality on the anatomy, not on surrounding black frame."""
    if not roi:
        return gray
    x, y, w, h = roi.get("x", 0), roi.get("y", 0), roi.get("w", 0), roi.get("h", 0)
    if w < 8 or h < 8:
        return gray
    crop = gray[y:y + h, x:x + w]
    return crop if crop.size else gray


def assess_image_quality(img: np.ndarray, roi: Optional[Dict] = None) -> Dict:
    """Score the uploaded film's suitability for automated measurement."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    region = _crop_to_roi(gray, roi)

    # Geometric mean rather than the shortest edge: a knee region is naturally
    # about twice as tall as it is wide, and min(h, w) would score that narrow
    # dimension as low resolution when the pixel density is actually fine.
    rh, rw = region.shape[:2]
    effective_px = int(round((rh * rw) ** 0.5))
    # Laplacian variance is the standard blur proxy: sharp edges -> high variance.
    sharpness = float(cv2.Laplacian(region, cv2.CV_64F).var()) if region.size > 4 else 0.0
    contrast = float(region.std()) if region.size else 0.0
    region_found = bool(roi.get("detected")) if roi else False

    subs = {
        "resolution": _band_score(effective_px, _RESOLUTION_BANDS),
        "sharpness": _band_score(sharpness, _SHARPNESS_BANDS),
        "contrast": _band_score(contrast, _CONTRAST_BANDS),
        "region": 100.0 if region_found else 45.0,
    }

    # Any one of these can independently make a film unmeasurable — a 160 px crop
    # is useless however sharp it is, and a blurred film is useless however large.
    # A plain weighted mean lets three good factors mask one disqualifying one, so
    # the worst factor caps the total rather than just diluting it.
    weighted = sum(subs[k] * w for k, w in _WEIGHTS.items())
    score = min(weighted, min(subs.values()) + _WORST_FACTOR_HEADROOM)

    if score >= 75:
        level, label = "good", "Good"
    elif score >= 55:
        level, label = "acceptable", "Acceptable"
    else:
        level, label = "poor", "Below optimal"

    factors = [
        {
            "name": "Resolution",
            "detail": "{} px effective resolution over the measured region".format(effective_px),
            "score_pct": round(subs["resolution"]),
            "status": _status(subs["resolution"]),
        },
        {
            "name": "Sharpness",
            "detail": "Laplacian variance {:.0f}".format(sharpness),
            "score_pct": round(subs["sharpness"]),
            "status": _status(subs["sharpness"]),
        },
        {
            "name": "Contrast",
            "detail": "Intensity spread {:.1f} of 255".format(contrast),
            "score_pct": round(subs["contrast"]),
            "status": _status(subs["contrast"]),
        },
        {
            "name": "Bone region",
            "detail": "Located by thresholding" if region_found
                      else "Not isolated — measurements fall back to the full frame",
            "score_pct": round(subs["region"]),
            "status": _status(subs["region"]),
        },
    ]

    return {
        "score_pct": round(score),
        "level": level,
        "level_label": label,
        "review_recommended": level == "poor" or not region_found,
        "factors": factors,
        "metrics": {
            "effective_px": effective_px,
            "sharpness": round(sharpness, 1),
            "contrast": round(contrast, 1),
            "region_detected": region_found,
        },
    }


def _status(sub_score: float) -> str:
    if sub_score >= 75:
        return "good"
    if sub_score >= 55:
        return "fair"
    return "low"


def measurement_uncertainty(quality: Dict, per_pixel_segmentation: bool) -> Dict:
    """Tolerance bands to report alongside each measurement.

    Widens as image quality drops, and again when the zones are proportional
    rather than traced per-pixel from a segmentation mask.
    """
    shortfall = 1.0 - (quality["score_pct"] / 100.0)
    mult = 1.0 if per_pixel_segmentation else _SIMULATED_UNCERTAINTY_MULTIPLIER

    return {
        "meniscus_mm": round((0.25 + shortfall * 1.00) * mult, 2),
        "bone_mm": round((0.80 + shortfall * 3.00) * mult, 1),
        "slope_deg": round((0.50 + shortfall * 2.50) * mult, 1),
        "basis": (
            "Derived from image quality ({}%) and {} segmentation."
        ).format(
            quality["score_pct"],
            "per-pixel" if per_pixel_segmentation else "proportional-zone",
        ),
    }
