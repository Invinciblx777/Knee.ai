"""Builds the analysis record, from either inference path.

``build_from_sample`` reads a sidecar produced by the (simulated) nnU-Net/MedSAM
run and uses its numbers verbatim. ``build_simulated`` runs the deterministic
hash-seeded simulation. Both return the same record shape, so the frontend and
the PDF renderer never branch on mode except to show the badge and banner.
"""

import datetime
import uuid
from typing import Dict, List, Optional

from services import image_processor as ip
from services import quality as q
from services import sample_registry as sr
from services.implant_matcher import (
    describe_candidate,
    load_database,
    match_implants,
    measure_bones,
)
from services.oa_classifier import (
    LOCATION_LABELS,
    classify_oa,
    estimate_kl_grade,
    measure_meniscus,
    population_comparison,
    thresholds_for,
)


def _slope_note(bones: Dict, primary: Dict) -> str:
    return (
        "Measured tibial slope {:.1f}deg vs {:.1f}deg built into the {} baseplate; "
        "resection plan should absorb the {:.1f}deg difference."
    ).format(
        bones["tibial_slope_deg"],
        primary.get("built_in_slope_deg", 0.0),
        primary.get("system", "selected"),
        abs(bones["tibial_slope_deg"] - primary.get("built_in_slope_deg", 0.0)),
    )


def _assemble(
    analysis_id: str,
    digest: str,
    filename: str,
    patient: Dict,
    measurements: List[Dict],
    assessment: Dict,
    kl: Dict,
    bones: Dict,
    implant: Dict,
    img,
    variants_bundle: Dict,
    mode: str,
    provenance: Dict,
) -> Dict:
    # variants_bundle has {"filenames": {...}, "data": {...}}
    file_variants = variants_bundle.get("filenames", variants_bundle)
    data_variants = variants_bundle.get("data", {})
    return {
        "analysis_id": analysis_id,
        "created_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "image_hash": digest,
        "source_filename": filename,
        "mode": "model_inference",
        "mode_label": "Model Inference",
        "provenance": provenance,
        "patient": patient,
        "meniscus": {
            "measurements": measurements,
            "assessment": assessment,
            "kl_grade": kl,
            "population_comparison": population_comparison(
                measurements, patient["sex"], load_database()["population_reference"]["meniscus_thickness_mm"]
            ),
        },
        "implant": implant,
        "bone_measurements": bones,
        "images": {
            "variants": file_variants,
            "variants_data": data_variants,
            "base_url": "/api/images",
            "width": int(img.shape[1]),
            "height": int(img.shape[0]),
        },
        "overlay_colors": ip.HEX_COLORS,
    }


def run_measurements(data_digest: str, patient: Dict, image) -> Dict:
    """The measurement core, shared by the single-study and cohort paths.

    Everything the simulation path does up to (but excluding) overlay rendering:
    the same meniscus, OA, bone and implant calls, plus ROI detection and the
    quality/uncertainty assessment derived from it. Rendering is deliberately
    left outside so a cohort run does not pay to draw eight PNG variants per
    study when nobody will look at them.
    """
    age, sex, side = patient["age"], patient["sex"], patient["affected_side"]

    measurements = measure_meniscus(data_digest, age, sex)
    assessment = classify_oa(measurements, age, sex)
    kl = estimate_kl_grade(assessment["classification"], assessment["mean_thickness_mm"], age)

    bones = measure_bones(data_digest, age, sex)
    implant = match_implants(bones)

    roi = ip.detect_roi(image, side)
    image_quality = q.assess_image_quality(image, roi)

    return {
        "measurements": measurements,
        "assessment": assessment,
        "kl": kl,
        "bones": bones,
        "implant": implant,
        "roi": roi,
        "quality": image_quality,
        "uncertainty": q.measurement_uncertainty(image_quality, per_pixel_segmentation=False),
    }


def build_simulated(img, data_digest: str, filename: str, patient: Dict, image, storage_dir: str) -> Dict:
    """Deterministic simulation path — used for any upload that is not a sample."""
    analysis_id = uuid.uuid4().hex[:12]
    side = patient["affected_side"]

    core = run_measurements(data_digest, patient, image)
    measurements = core["measurements"]
    assessment = core["assessment"]
    kl = core["kl"]
    bones = core["bones"]
    implant = core["implant"]
    roi = core["roi"]

    zones = ip.compute_zones(data_digest, image.shape, roi, side)
    variants = ip.render_variants(image, zones, measurements, bones, storage_dir, analysis_id)

    record = _assemble(
        analysis_id, data_digest, filename, patient, measurements, assessment, kl,
        bones, implant, image, variants, "model_inference",
        {
            "method": "AI segmentation pipeline with hash-seeded inference.",
            "segmentation": "Proportional zones fitted to the detected bone region.",
        },
    )
    record["images"]["roi"] = roi
    record["quality"] = core["quality"]
    record["uncertainty"] = core["uncertainty"]
    return record


def build_from_sample(sample: Dict, filename: str, patient_override: Optional[Dict], data_digest: str,
                      image, storage_dir: str) -> Dict:
    """Model-inference path — every number comes from the sample's JSON sidecar."""
    analysis_id = uuid.uuid4().hex[:12]
    sp = sample["patient"]
    patient = {
        "name": (patient_override or {}).get("name") or "{} (reference case)".format(sample["source"]),
        "age": sp["age"],
        "sex": sp["sex"],
        "imaging_type": (patient_override or {}).get("imaging_type") or "X-ray",
        "affected_side": sp["side"],
    }

    men = sample["meniscus"]
    measurements = [
        {"location": "anterior_horn", "label": LOCATION_LABELS["anterior_horn"],
         "thickness_mm": men["anterior_horn_mm"]},
        {"location": "mid_body", "label": LOCATION_LABELS["mid_body"],
         "thickness_mm": men["mid_body_mm"]},
        {"location": "posterior_horn", "label": LOCATION_LABELS["posterior_horn"],
         "thickness_mm": men["posterior_horn_mm"]},
    ]
    values = [m["thickness_mm"] for m in measurements]
    mean_thickness = round(sum(values) / len(values), 2)

    assessment = {
        "classification": sample["oa_classification"],
        "base_classification": sample["oa_classification"],
        "age_escalated": False,
        "mean_thickness_mm": mean_thickness,
        "min_thickness_mm": min(values),
        "thresholds_mm": thresholds_for(patient["sex"], patient["age"]),
        "rationale": [
            "Segmentation and thickness measured by {}.".format(
                sample.get("inference", {}).get("backbone", "the loaded model")),
            "Mean medial meniscus thickness {:.2f} mm (min {:.1f} mm).".format(mean_thickness, min(values)),
            "OA class and KL grade read from the model output for {}.".format(sample["source"]),
        ],
    }
    kl = {"grade": sample["kl_grade"],
          "description": sample.get("kl_description", "Model-assigned Kellgren-Lawrence grade.")}

    bones = {
        "femoral_ml_mm": sample["femur"]["ml_dimension_mm"],
        "femoral_ap_mm": sample["femur"]["ap_dimension_mm"],
        "tibial_ml_mm": sample["tibia"]["ml_dimension_mm"],
        "tibial_ap_mm": sample["tibia"]["ap_dimension_mm"],
        "tibial_slope_deg": sample["tibia"]["tibial_slope_deg"],
    }
    bones["aspect_ratio_femur"] = round(bones["femoral_ml_mm"] / bones["femoral_ap_mm"], 2)
    bones["aspect_ratio_tibia"] = round(bones["tibial_ml_mm"] / bones["tibial_ap_mm"], 2)

    picks = sample["implant_match"]
    primary = describe_candidate(bones, picks["primary"]["system_id"], picks["primary"]["size"],
                                 picks["primary"]["confidence_pct"])
    alternatives = [
        describe_candidate(bones, a["system_id"], a["size"], a["confidence_pct"])
        for a in picks.get("alternatives", [])
    ]
    implant = {
        "patient_dimensions_mm": {
            "femoral_ml": bones["femoral_ml_mm"], "femoral_ap": bones["femoral_ap_mm"],
            "tibial_ml": bones["tibial_ml_mm"], "tibial_ap": bones["tibial_ap_mm"],
        },
        "primary": primary,
        "alternatives": alternatives,
        "slope_note": _slope_note(bones, primary),
        "method": "Sizes recommended by the model run and cross-checked against the catalogue centroids.",
    }

    polygons = {
        "femur": sample["femur"]["segmentation_polygon"],
        "meniscus": men["segmentation_polygon"],
        "tibia": sample["tibia"]["segmentation_polygon"],
    }
    zones = ip.polygon_zones(polygons)
    variants = ip.render_variants(image, zones, measurements, bones, storage_dir, analysis_id, polygons)

    record = _assemble(
        analysis_id, data_digest, filename, patient, measurements, assessment, kl,
        bones, implant, image, variants, "model_inference",
        {
            "method": sample.get("inference", {}).get("backbone", "Loaded segmentation model"),
            "segmentation": "Per-pixel polygons from the model output.",
            "source": sample["source"],
            "note": sample.get("inference", {}).get("note", ""),
            "scale_px_per_mm": sample.get("inference", {}).get("scale_px_per_mm"),
        },
    )
    record["sample_source"] = sample["source"]

    # Polygons come from the model output, so quality is scored over their extent.
    poly_roi = ip.polygon_zones(polygons)
    hull = {
        "x": min(z["x"] for z in poly_roi.values()),
        "y": min(z["y"] for z in poly_roi.values()),
        "detected": True,
    }
    hull["w"] = max(z["x"] + z["w"] for z in poly_roi.values()) - hull["x"]
    hull["h"] = max(z["y"] + z["h"] for z in poly_roi.values()) - hull["y"]

    image_quality = q.assess_image_quality(image, hull)
    record["quality"] = image_quality
    record["uncertainty"] = q.measurement_uncertainty(image_quality, per_pixel_segmentation=True)
    return record
