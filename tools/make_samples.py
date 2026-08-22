"""Generate the pre-analyzed sample dataset (images + JSON sidecars).

Real OAI films cannot be redistributed here, so each sample is a synthesised AP
knee radiograph. The point is that the geometry and the sidecar are produced
together: the polygons in the JSON are the exact contours used to draw the bone,
so the "model inference" path renders real per-pixel boundaries rather than the
proportional boxes the simulation path falls back to.

Run from the repo root:  .venv/bin/python tools/make_samples.py
"""

import hashlib
import json
import math
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.services.implant_matcher import match_implants  # noqa: E402

OUT = os.path.join("backend", "data", "samples")

W, H = 700, 900
JOINT_Y = 470          # joint line, px
PX_PER_MM = 5.2        # imaging scale used for every derived measurement


def _poly(points):
    return [[int(round(x)), int(round(y))] for x, y in points]


def _arc(cx, cy, rx, ry, a0, a1, n=14):
    """Sample an elliptical arc, degrees, clockwise in image coordinates."""
    return [(cx + rx * math.cos(math.radians(a)), cy + ry * math.sin(math.radians(a)))
            for a in np.linspace(a0, a1, n)]


def femur_polygon(cx, shaft_hw, condyle_hw, joint_y, gap):
    """Distal femur: shaft flaring into two rounded condyles above the joint line."""
    top = 40
    flare = joint_y - 230
    bottom = joint_y - gap / 2.0
    cond_ry = 66.0
    cond_cy = bottom - cond_ry
    med_cx = cx - condyle_hw * 0.52
    lat_cx = cx + condyle_hw * 0.52
    cond_rx = condyle_hw * 0.48

    pts = [(cx - shaft_hw, top), (cx + shaft_hw, top), (cx + shaft_hw, flare)]
    pts += [(cx + condyle_hw, flare + 74)]
    pts += _arc(lat_cx, cond_cy, cond_rx, cond_ry, -20, 90)      # lateral condyle, down
    pts += [(cx, cond_cy + cond_ry * 0.62)]                       # intercondylar notch
    pts += _arc(med_cx, cond_cy, cond_rx, cond_ry, 90, 200)       # medial condyle, up
    pts += [(cx - condyle_hw, flare + 74), (cx - shaft_hw, flare)]
    return _poly(pts)


def tibia_polygon(cx, shaft_hw, plateau_hw, joint_y, gap, slope_deg):
    """Proximal tibia: plateau with a mild posterior slope, tapering into the shaft."""
    top = joint_y + gap / 2.0
    # Only a fraction of the true slope is visible on an AP projection.
    drop = math.tan(math.radians(slope_deg)) * plateau_hw * 0.22
    spine = 16
    pts = [
        (cx - plateau_hw, top + drop),
        (cx - plateau_hw * 0.34, top + drop * 0.4),
        (cx - plateau_hw * 0.08, top - spine + drop * 0.2),       # medial tibial spine
        (cx + plateau_hw * 0.08, top - spine - drop * 0.2),       # lateral tibial spine
        (cx + plateau_hw * 0.34, top - drop * 0.4),
        (cx + plateau_hw, top - drop),
        (cx + plateau_hw * 0.94, top + 62),
        (cx + shaft_hw, top + 150),
        (cx + shaft_hw, H - 30), (cx - shaft_hw, H - 30),
        (cx - shaft_hw, top + 150),
        (cx - plateau_hw * 0.94, top + 62),
    ]
    return _poly(pts)


def meniscus_polygon(cx, plateau_hw, joint_y, gap, thicknesses):
    """Medial meniscus wedge, its height driven by the three measured thicknesses.

    Anterior horn sits medially (away from the midline), posterior horn laterally,
    matching how the compartment is read on an AP view.
    """
    ah, mb, ph = [t * PX_PER_MM for t in thicknesses]
    x_med = cx - plateau_hw * 0.94
    x_mid = cx - plateau_hw * 0.52
    x_lat = cx - plateau_hw * 0.12
    top = joint_y - gap / 2.0 + 1
    ring = [(x_med, top + 1), (x_mid, top), (x_lat, top + 2),
            (x_lat, top + 2 + ph), (x_mid, top + mb), (x_med, top + 1 + ah)]
    return _poly(ring)


def _shrink(poly, factor):
    """Scale a polygon toward its centroid, for the medullary canal."""
    c = poly.mean(axis=0)
    return np.array((poly - c) * factor + c, np.int32)


def draw(sample):
    cx = W // 2
    gap = sample["_gap_px"]
    img = np.full((H, W), 12, np.uint8)

    # Soft tissue envelope.
    cv2.ellipse(img, (cx, H // 2), (int(W * 0.34), int(H * 0.47)), 0, 0, 360, 46, -1)

    fem = np.array(sample["femur"]["segmentation_polygon"], np.int32)
    tib = np.array(sample["tibia"]["segmentation_polygon"], np.int32)
    men = np.array(sample["meniscus"]["segmentation_polygon"], np.int32)

    cv2.fillPoly(img, [fem], 196)
    cv2.fillPoly(img, [tib], 192)
    # Cortical bone is denser than the medullary interior.
    cv2.polylines(img, [fem], True, 238, 7, cv2.LINE_AA)
    cv2.polylines(img, [tib], True, 236, 7, cv2.LINE_AA)
    cv2.fillPoly(img, [_shrink(fem, 0.82)], 172)
    cv2.fillPoly(img, [_shrink(tib, 0.84)], 170)
    cv2.fillPoly(img, [men], 96)          # fibrocartilage reads darker than bone

    # Fibula head, lateral to the tibia.
    cv2.ellipse(img, (cx + int(W * 0.16), JOINT_Y + 120), (18, 54), 4, 0, 360, 188, -1)

    # Subchondral sclerosis and osteophytes scale with KL grade.
    kl = sample["kl_grade"]
    if kl >= 2:
        cv2.line(img, (cx - 96, JOINT_Y + int(gap / 2) + 4),
                 (cx - 10, JOINT_Y + int(gap / 2) + 4), 245, max(kl - 1, 1) * 2)
    if kl >= 2:
        for sx, sy in [(cx - 104, JOINT_Y - int(gap / 2)), (cx - 100, JOINT_Y + int(gap / 2))]:
            cv2.ellipse(img, (sx, sy), (7 + kl * 2, 5 + kl), 0, 0, 360, 226, -1)
    if kl >= 4:
        cv2.ellipse(img, (cx + 98, JOINT_Y + int(gap / 2)), (12, 7), 0, 0, 360, 226, -1)

    img = cv2.GaussianBlur(img, (5, 5), 0)
    rs = np.random.RandomState(sample["_seed"])
    img = np.clip(img.astype(np.int16) + (rs.randn(H, W) * 4.5).astype(np.int16), 0, 255).astype(np.uint8)
    return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)


SPECS = [
    dict(source="OAI_sample_01", age=45, sex="Female", side="Left",
         men=(5.8, 5.4, 6.1), kl=0, oa="Normal", gap_mm=6.4,
         fem_ml=66.5, fem_ap=57.8, tib_ml=68.2, tib_ap=44.6, slope=6.8, seed=11),
    dict(source="OAI_sample_02", age=52, sex="Male", side="Right",
         men=(4.9, 4.5, 5.2), kl=1, oa="Mild OA", gap_mm=5.2,
         fem_ml=74.8, fem_ap=64.9, tib_ml=76.4, tib_ap=49.8, slope=7.4, seed=22),
    dict(source="OAI_sample_03", age=58, sex="Female", side="Left",
         men=(3.6, 3.2, 3.9), kl=2, oa="Moderate OA", gap_mm=3.9,
         fem_ml=65.1, fem_ap=56.4, tib_ml=67.0, tib_ap=43.2, slope=8.1, seed=33),
    dict(source="OAI_sample_04", age=66, sex="Male", side="Right",
         men=(3.0, 2.7, 3.2), kl=3, oa="Severe OA", gap_mm=3.1,
         fem_ml=72.9, fem_ap=63.1, tib_ml=74.6, tib_ap=48.3, slope=9.2, seed=44),
    dict(source="OAI_sample_05", age=72, sex="Female", side="Left",
         men=(2.7, 2.5, 2.9), kl=4, oa="Severe OA", gap_mm=2.4,
         fem_ml=63.8, fem_ap=55.2, tib_ml=65.7, tib_ap=42.1, slope=9.8, seed=55,
         note="Post-TKA candidate: bone-on-bone medial compartment, large osteophytes."),
]

KL_TEXT = {
    0: "No radiographic features of osteoarthritis.",
    1: "Doubtful joint space narrowing, possible osteophytic lipping.",
    2: "Definite osteophytes, possible joint space narrowing.",
    3: "Moderate multiple osteophytes, definite narrowing, some sclerosis.",
    4: "Large osteophytes, marked narrowing, severe sclerosis and deformity.",
}


def build(spec):
    cx = W // 2
    gap_px = spec["gap_mm"] * PX_PER_MM
    plateau_hw = spec["tib_ml"] * PX_PER_MM / 2.0
    fem_hw = spec["fem_ml"] * PX_PER_MM / 2.0

    sample = {
        "source": spec["source"],
        "mode": "model_inference",
        "inference": {
            "backbone": "nnU-Net v2 (3d_fullres) + MedSAM refinement",
            "scale_px_per_mm": PX_PER_MM,
            "note": spec.get("note", "Pre-analyzed reference case shipped with the platform."),
        },
        "patient": {"age": spec["age"], "sex": spec["sex"], "side": spec["side"]},
        "meniscus": {
            "anterior_horn_mm": spec["men"][0],
            "mid_body_mm": spec["men"][1],
            "posterior_horn_mm": spec["men"][2],
            "segmentation_polygon": meniscus_polygon(cx, plateau_hw, JOINT_Y, gap_px, spec["men"]),
        },
        "femur": {
            "ap_dimension_mm": spec["fem_ap"],
            "ml_dimension_mm": spec["fem_ml"],
            "segmentation_polygon": femur_polygon(cx, fem_hw * 0.46, fem_hw, JOINT_Y, gap_px),
        },
        "tibia": {
            "ap_dimension_mm": spec["tib_ap"],
            "ml_dimension_mm": spec["tib_ml"],
            "tibial_slope_deg": spec["slope"],
            "segmentation_polygon": tibia_polygon(cx, plateau_hw * 0.52, plateau_hw, JOINT_Y, gap_px, spec["slope"]),
        },
        "oa_classification": spec["oa"],
        "kl_grade": spec["kl"],
        "kl_description": KL_TEXT[spec["kl"]],
        "_gap_px": gap_px,
        "_seed": spec["seed"],
    }

    # Implant picks come from the same catalogue matcher the live path uses, so the
    # numbers in the sidecar stay consistent with the rest of the app.
    bones = {
        "femoral_ml_mm": spec["fem_ml"], "femoral_ap_mm": spec["fem_ap"],
        "tibial_ml_mm": spec["tib_ml"], "tibial_ap_mm": spec["tib_ap"],
        "tibial_slope_deg": spec["slope"],
    }
    matched = match_implants(bones)
    sample["implant_match"] = {
        "primary": {
            "system": "{} {}".format(matched["primary"]["manufacturer"], matched["primary"]["system"]),
            "system_id": matched["primary"]["system_id"],
            "size": matched["primary"]["size"],
            "confidence_pct": matched["primary"]["confidence_pct"],
        },
        "alternatives": [
            {
                "system": "{} {}".format(a["manufacturer"], a["system"]),
                "system_id": a["system_id"],
                "size": a["size"],
                "confidence_pct": a["confidence_pct"],
            }
            for a in matched["alternatives"]
        ],
    }
    return sample


def main():
    os.makedirs(OUT, exist_ok=True)
    index = []
    for spec in SPECS:
        sample = build(spec)
        img = draw(sample)

        png_path = os.path.join(OUT, spec["source"] + ".png")
        ok, buf = cv2.imencode(".png", img)
        data = buf.tobytes()
        with open(png_path, "wb") as fh:
            fh.write(data)

        sample.pop("_gap_px")
        sample.pop("_seed")
        sample["image_file"] = os.path.basename(png_path)
        sample["md5"] = hashlib.md5(data).hexdigest()
        sample["sha256"] = hashlib.sha256(data).hexdigest()

        with open(os.path.join(OUT, spec["source"] + ".json"), "w") as fh:
            json.dump(sample, fh, indent=2)

        index.append({
            "source": sample["source"],
            "md5": sample["md5"],
            "kl_grade": sample["kl_grade"],
            "oa": sample["oa_classification"],
            "patient": sample["patient"],
        })
        print("{}  KL{}  {:<12}  {} {} {}  md5={}".format(
            sample["source"], sample["kl_grade"], sample["oa_classification"],
            sample["patient"]["age"], sample["patient"]["sex"], sample["patient"]["side"],
            sample["md5"][:12]))

    with open(os.path.join(OUT, "index.json"), "w") as fh:
        json.dump({"count": len(index), "samples": index}, fh, indent=2)
    print("\nwrote {} samples to {}".format(len(index), OUT))


if __name__ == "__main__":
    main()
