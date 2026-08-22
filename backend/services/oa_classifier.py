"""Medial meniscus measurement simulation + OA / KL grading.

Thresholds follow the spec:
    < 3 mm  -> Severe OA
    3 - 4   -> Moderate OA
    4 - 5   -> Mild OA
    > 5     -> Normal
Female patients get a -0.3 mm shift applied to every threshold, and patients
over 60 are escalated by one severity grade.
"""

from typing import Dict, List

from services.seed import bounded_normal, rng_for

LOCATIONS = ["anterior_horn", "mid_body", "posterior_horn"]

LOCATION_LABELS = {
    "anterior_horn": "Anterior Horn",
    "mid_body": "Mid-Body",
    "posterior_horn": "Posterior Horn",
}

# Severity ladder, least to most advanced.
SEVERITY_ORDER = ["Normal", "Mild OA", "Moderate OA", "Severe OA"]

BASE_THRESHOLDS = {"severe": 3.0, "moderate": 4.0, "mild": 5.0}

# Per-location mean thickness used as the centre of the simulated draw.
LOCATION_MEANS = {"anterior_horn": 4.6, "mid_body": 4.2, "posterior_horn": 5.1}

MEASUREMENT_RANGE = (2.5, 6.5)


def _age_drift(age: int) -> float:
    """Older knees thin out. ~0.02 mm lost per year past 35, capped at 1.2 mm."""
    return min(max(age - 35, 0) * 0.02, 1.2)


def measure_meniscus(digest: str, age: int, sex: str) -> List[Dict]:
    """Simulate thickness at the three anatomical locations."""
    rng = rng_for(digest, "meniscus")
    sex_offset = -0.25 if sex.lower().startswith("f") else 0.0
    drift = _age_drift(age)

    results = []
    for key in LOCATIONS:
        mean = LOCATION_MEANS[key] + sex_offset - drift
        value = bounded_normal(rng, mean, 0.55, MEASUREMENT_RANGE, ndigits=1)
        results.append(
            {
                "location": key,
                "label": LOCATION_LABELS[key],
                "thickness_mm": value,
            }
        )
    return results


def thresholds_for(sex: str) -> Dict[str, float]:
    """Female thresholds shift down 0.3 mm."""
    shift = -0.3 if sex.lower().startswith("f") else 0.0
    return {k: round(v + shift, 2) for k, v in BASE_THRESHOLDS.items()}


def _base_class(mean_thickness: float, th: Dict[str, float]) -> str:
    if mean_thickness < th["severe"]:
        return "Severe OA"
    if mean_thickness < th["moderate"]:
        return "Moderate OA"
    if mean_thickness < th["mild"]:
        return "Mild OA"
    return "Normal"


def escalate(classification: str, steps: int = 1) -> str:
    idx = SEVERITY_ORDER.index(classification)
    return SEVERITY_ORDER[min(idx + steps, len(SEVERITY_ORDER) - 1)]


def classify_oa(measurements: List[Dict], age: int, sex: str) -> Dict:
    values = [m["thickness_mm"] for m in measurements]
    mean_thickness = round(sum(values) / len(values), 2)
    min_thickness = min(values)

    th = thresholds_for(sex)
    base = _base_class(mean_thickness, th)

    age_escalated = age > 60
    classification = escalate(base) if age_escalated else base

    reasons = [
        "Mean medial meniscus thickness {:.2f} mm (min {:.1f} mm at {}).".format(
            mean_thickness,
            min_thickness,
            next(m["label"] for m in measurements if m["thickness_mm"] == min_thickness),
        ),
        "Sex-adjusted thresholds: severe < {severe} mm, moderate < {moderate} mm, "
        "mild < {mild} mm.".format(**th),
    ]
    if age_escalated:
        reasons.append(
            "Age {} > 60: severity escalated one grade from {} to {}.".format(age, base, classification)
        )

    return {
        "classification": classification,
        "base_classification": base,
        "age_escalated": age_escalated,
        "mean_thickness_mm": mean_thickness,
        "min_thickness_mm": min_thickness,
        "thresholds_mm": th,
        "rationale": reasons,
    }


def estimate_kl_grade(classification: str, mean_thickness: float, age: int) -> Dict:
    """Map severity + thickness onto the Kellgren-Lawrence 0-4 scale."""
    grade_map = {"Normal": 0, "Mild OA": 1, "Moderate OA": 2, "Severe OA": 4}
    grade = grade_map[classification]

    # Nudge within the band using absolute thickness so grades 1-3 are reachable.
    if classification == "Mild OA" and mean_thickness < 4.4:
        grade = 2
    if classification == "Moderate OA" and mean_thickness < 3.4:
        grade = 3
    if classification == "Severe OA" and mean_thickness > 2.9:
        grade = 3
    if classification == "Normal" and age > 60 and mean_thickness < 5.6:
        grade = 1

    descriptions = {
        0: "No radiographic features of osteoarthritis.",
        1: "Doubtful joint space narrowing, possible osteophytic lipping.",
        2: "Definite osteophytes, possible joint space narrowing.",
        3: "Moderate multiple osteophytes, definite narrowing, some sclerosis.",
        4: "Large osteophytes, marked narrowing, severe sclerosis and deformity.",
    }
    return {"grade": grade, "description": descriptions[grade]}


def population_comparison(measurements: List[Dict], sex: str, reference: Dict) -> List[Dict]:
    """Patient value vs male and female population means, per location."""
    male_ref = reference["male"]
    female_ref = reference["female"]
    own = female_ref if sex.lower().startswith("f") else male_ref

    rows = []
    for m in measurements:
        key = m["location"]
        rows.append(
            {
                "location": key,
                "label": m["label"],
                "patient": m["thickness_mm"],
                "population_male": male_ref[key],
                "population_female": female_ref[key],
                "deviation_mm": round(m["thickness_mm"] - own[key], 2),
                "deviation_pct": round((m["thickness_mm"] - own[key]) / own[key] * 100, 1),
            }
        )
    return rows
