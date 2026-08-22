"""Bone-dimension simulation and implant size matching.

Matching is a plain euclidean distance in 4-D component space
(femoral ML/AP, tibial ML/AP) between the patient's measured dimensions and
each catalogued size centroid. Lowest distance wins.
"""

import json
import math
import os
from typing import Dict, List, Optional

from services.seed import bounded_normal, rng_for

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "implant_database.json")

DIM_KEYS = ["femoral_ml", "femoral_ap", "tibial_ml", "tibial_ap"]

DIM_LABELS = {
    "femoral_ml": "Femoral Width (ML)",
    "femoral_ap": "Femoral Width (AP)",
    "tibial_ml": "Tibial Width (ML)",
    "tibial_ap": "Tibial Width (AP)",
}

# Plausible adult ranges (mm) used to clamp the simulated draws.
DIM_BOUNDS = {
    "femoral_ml": (52.0, 84.0),
    "femoral_ap": (46.0, 74.0),
    "tibial_ml": (55.0, 86.0),
    "tibial_ap": (36.0, 58.0),
}

SLOPE_BOUNDS = (2.0, 14.0)

_DB_CACHE = None


def load_database() -> Dict:
    global _DB_CACHE
    if _DB_CACHE is None:
        with open(DATA_PATH, "r") as fh:
            _DB_CACHE = json.load(fh)
    return _DB_CACHE


def measure_bones(digest: str, age: int, sex: str) -> Dict:
    """Simulate femoral/tibial dimensions and tibial slope from the image hash."""
    rng = rng_for(digest, "bones")
    ref = load_database()["population_reference"]["bone_dimensions_mm"]
    is_female = sex.lower().startswith("f")
    means = ref["female"] if is_female else ref["male"]

    dims = {}
    for key in DIM_KEYS:
        dims[key] = bounded_normal(rng, means[key], 3.4, DIM_BOUNDS[key], ndigits=1)

    slope = bounded_normal(rng, means["tibial_slope"], 1.8, SLOPE_BOUNDS, ndigits=1)

    return {
        "femoral_ml_mm": dims["femoral_ml"],
        "femoral_ap_mm": dims["femoral_ap"],
        "tibial_ml_mm": dims["tibial_ml"],
        "tibial_ap_mm": dims["tibial_ap"],
        "tibial_slope_deg": slope,
        "aspect_ratio_femur": round(dims["femoral_ml"] / dims["femoral_ap"], 2),
        "aspect_ratio_tibia": round(dims["tibial_ml"] / dims["tibial_ap"], 2),
    }


def _patient_vector(bones: Dict) -> Dict[str, float]:
    return {
        "femoral_ml": bones["femoral_ml_mm"],
        "femoral_ap": bones["femoral_ap_mm"],
        "tibial_ml": bones["tibial_ml_mm"],
        "tibial_ap": bones["tibial_ap_mm"],
    }


def _distance(patient: Dict[str, float], size: Dict) -> float:
    return math.sqrt(sum((patient[k] - size[k]) ** 2 for k in DIM_KEYS))


def _confidence(distance: float) -> float:
    """Map euclidean distance (mm) to a 0-100 match confidence.

    0 mm -> 100 %, and confidence decays smoothly; 20 mm of total mismatch
    lands around 35 %.
    """
    conf = 100.0 * math.exp(-distance / 19.0)
    return round(max(min(conf, 99.5), 5.0), 1)


def match_implants(bones: Dict, top_n: int = 3) -> Dict:
    patient = _patient_vector(bones)
    db = load_database()

    candidates = []
    for system in db["systems"]:
        for size in system["sizes"]:
            dist = _distance(patient, size)
            deltas = {k: round(patient[k] - size[k], 1) for k in DIM_KEYS}
            candidates.append(
                {
                    "system_id": system["id"],
                    "manufacturer": system["manufacturer"],
                    "system": system["system"],
                    "type": system["type"],
                    "size": size["size"],
                    "dimensions": {k: size[k] for k in DIM_KEYS},
                    "built_in_slope_deg": system["built_in_slope"],
                    "distance_mm": round(dist, 2),
                    "confidence_pct": _confidence(dist),
                    "deltas_mm": deltas,
                    "max_abs_delta_mm": round(max(abs(v) for v in deltas.values()), 1),
                }
            )

    candidates.sort(key=lambda c: c["distance_mm"])

    # One recommendation per implant system so alternatives are genuinely distinct.
    seen = set()
    ranked = []
    for cand in candidates:
        if cand["system_id"] in seen:
            continue
        seen.add(cand["system_id"])
        ranked.append(cand)
        if len(ranked) == top_n:
            break

    primary = ranked[0]
    alternatives = ranked[1:]

    slope_note = (
        "Measured tibial slope {:.1f}deg vs {:.1f}deg built into the {} baseplate; "
        "resection plan should absorb the {:.1f}deg difference."
    ).format(
        bones["tibial_slope_deg"],
        primary["built_in_slope_deg"],
        primary["system"],
        abs(bones["tibial_slope_deg"] - primary["built_in_slope_deg"]),
    )

    return {
        "patient_dimensions_mm": patient,
        "primary": primary,
        "alternatives": alternatives,
        "slope_note": slope_note,
        "method": "Euclidean distance across femoral ML/AP and tibial ML/AP against each catalogued size centroid.",
    }


def resolve_size(system_id: str, size: str) -> Optional[Dict]:
    """Look up one catalogued size, so a sidecar's pick can be shown with its dims."""
    for system in load_database()["systems"]:
        if system["id"] != system_id:
            continue
        for entry in system["sizes"]:
            if entry["size"] == size:
                return {
                    "system_id": system["id"],
                    "manufacturer": system["manufacturer"],
                    "system": system["system"],
                    "type": system["type"],
                    "built_in_slope_deg": system["built_in_slope"],
                    "size": entry["size"],
                    "dimensions": {k: entry[k] for k in DIM_KEYS},
                }
    return None


def describe_candidate(bones: Dict, system_id: str, size: str, confidence_pct: float) -> Dict:
    """Expand a sidecar implant pick into the same shape the live matcher returns."""
    resolved = resolve_size(system_id, size)
    patient = _patient_vector(bones)
    if resolved is None:
        return {
            "system_id": system_id, "manufacturer": "", "system": system_id, "type": "",
            "size": size, "dimensions": {}, "built_in_slope_deg": 0.0,
            "distance_mm": None, "confidence_pct": confidence_pct,
            "deltas_mm": {}, "max_abs_delta_mm": None,
        }
    deltas = {k: round(patient[k] - resolved["dimensions"][k], 1) for k in DIM_KEYS}
    resolved.update({
        "distance_mm": round(_distance(patient, resolved["dimensions"]), 2),
        "confidence_pct": confidence_pct,
        "deltas_mm": deltas,
        "max_abs_delta_mm": round(max(abs(v) for v in deltas.values()), 1),
    })
    return resolved
