"""Cohort-level descriptive statistics over a batch of analyses.

Everything here is *descriptive*. Nothing in this module tests a hypothesis,
reports a p-value, or supports a diagnostic claim about any individual: it
summarises what a set of measurements looks like and where groups differ in
magnitude. Comparisons and correlations are suppressed below the sample sizes
where they would be noise rather than signal, so an under-powered cohort
returns an explicit "insufficient sample" state instead of a confident-looking
number computed from four studies.

A caveat worth stating loudly, because it determines how these outputs may be
read: on the platform's simulated measurements, several of these associations
are structural rather than empirical.

  * OA class is assigned by thresholding mean meniscus thickness
    (``oa_classifier._base_class``), so an OA-vs-non-OA thickness comparison is
    circular by construction — the groups are *defined* by the variable being
    compared, and the separation is guaranteed, not discovered.
  * Simulated thickness is drawn around a mean carrying a coded -0.25 mm female
    offset and a -0.02 mm/year age drift, so sex and age trends recover the
    generator's own constants.

``build_summary`` therefore tags each association with whether it is
independent of how the cohort was produced. Against real annotated studies the
same statistics become meaningful; against simulated ones they describe the
simulator.
"""

import math
from typing import Dict, List, Optional, Sequence

from services.oa_classifier import SEVERITY_ORDER, _age_band_label

# Below these sizes a comparison or correlation is reported as unavailable
# rather than computed. Small enough to stay usable in a demo cohort, large
# enough that the number returned is not dominated by a single study.
MIN_GROUP_N = 5
MIN_CORRELATION_N = 10

AGE_BANDS = ["<40", "40-50", "50-60", ">60"]


# ── descriptive primitives ────────────────────────────────────────────────────

def _mean(xs: Sequence[float]) -> Optional[float]:
    return sum(xs) / len(xs) if xs else None


def _median(xs: Sequence[float]) -> Optional[float]:
    if not xs:
        return None
    s = sorted(xs)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2.0


def _sd(xs: Sequence[float]) -> Optional[float]:
    """Sample standard deviation (n-1). Undefined for a single observation."""
    if len(xs) < 2:
        return None
    m = _mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))


def _quantile(xs: Sequence[float], p: float) -> Optional[float]:
    """Linear-interpolation quantile, matching numpy's default."""
    if not xs:
        return None
    s = sorted(xs)
    if len(s) == 1:
        return s[0]
    pos = p * (len(s) - 1)
    lo = int(math.floor(pos))
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def describe(xs: Sequence[float], ndigits: int = 2) -> Dict:
    """Standard descriptive block for one numeric series."""
    def r(v):
        return round(v, ndigits) if v is not None else None

    return {
        "n": len(xs),
        "mean": r(_mean(xs)),
        "median": r(_median(xs)),
        "sd": r(_sd(xs)),
        "min": r(min(xs)) if xs else None,
        "max": r(max(xs)) if xs else None,
        "q1": r(_quantile(xs, 0.25)),
        "q3": r(_quantile(xs, 0.75)),
    }


def _cohens_d(a: Sequence[float], b: Sequence[float]) -> Optional[float]:
    """Standardised mean difference, pooled SD. None when either group is trivial."""
    if len(a) < 2 or len(b) < 2:
        return None
    sa, sb = _sd(a), _sd(b)
    na, nb = len(a), len(b)
    pooled_var = ((na - 1) * sa ** 2 + (nb - 1) * sb ** 2) / (na + nb - 2)
    if pooled_var <= 0:
        return None
    return (_mean(a) - _mean(b)) / math.sqrt(pooled_var)


def _interpret_d(d: Optional[float]) -> Optional[str]:
    """Cohen's conventional bands. A label for magnitude, not significance."""
    if d is None:
        return None
    a = abs(d)
    if a < 0.2:
        return "negligible"
    if a < 0.5:
        return "small"
    if a < 0.8:
        return "medium"
    return "large"


def _pearson(xs: Sequence[float], ys: Sequence[float]) -> Optional[float]:
    if len(xs) != len(ys) or len(xs) < 2:
        return None
    mx, my = _mean(xs), _mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    if dx == 0 or dy == 0:
        return None
    return num / (dx * dy)


def _interpret_r(r: Optional[float]) -> Optional[str]:
    if r is None:
        return None
    a = abs(r)
    if a < 0.1:
        return "negligible"
    if a < 0.3:
        return "weak"
    if a < 0.5:
        return "moderate"
    if a < 0.7:
        return "strong"
    return "very strong"


def _compare(label_a: str, a: Sequence[float], label_b: str, b: Sequence[float]) -> Dict:
    """Two-group magnitude comparison, gated on both groups clearing MIN_GROUP_N."""
    if len(a) < MIN_GROUP_N or len(b) < MIN_GROUP_N:
        return {
            "available": False,
            "reason": (
                "Needs at least {} studies per group; have {} ({}) and {} ({})."
            ).format(MIN_GROUP_N, len(a), label_a, len(b), label_b),
        }
    d = _cohens_d(a, b)
    return {
        "available": True,
        "difference_mm": round(_mean(a) - _mean(b), 2),
        "cohens_d": round(d, 2) if d is not None else None,
        "magnitude": _interpret_d(d),
        "groups": {label_a: describe(a), label_b: describe(b)},
    }


def histogram(xs: Sequence[float], bin_width: float = 0.5) -> List[Dict]:
    """Fixed-width bins over the observed range, for the distribution chart."""
    if not xs:
        return []
    lo = math.floor(min(xs) / bin_width) * bin_width
    hi = math.ceil(max(xs) / bin_width) * bin_width
    if hi <= lo:
        hi = lo + bin_width
    bins = []
    edge = lo
    while edge < hi - 1e-9:
        upper = edge + bin_width
        # Final bin is closed so the maximum observation is not dropped.
        last = upper >= hi - 1e-9
        count = sum(1 for x in xs if edge <= x < upper or (last and x == upper))
        bins.append({
            "label": "{:.1f}".format(edge),
            "range": "{:.1f}-{:.1f}".format(edge, upper),
            "count": count,
        })
        edge = upper
    return bins


# ── cohort assembly ───────────────────────────────────────────────────────────

def _row(rec: Dict) -> Dict:
    """Flatten one analysis record to the fields the statistics need."""
    patient = rec.get("patient", {})
    men = rec.get("meniscus", {})
    assess = men.get("assessment", {})
    quality = rec.get("quality", {})
    implant = rec.get("implant", {}).get("primary", {})
    bones = rec.get("bone_measurements", {})

    classification = assess.get("classification")
    per_location = {m["location"]: m["thickness_mm"] for m in men.get("measurements", [])}

    return {
        "analysis_id": rec.get("analysis_id"),
        "label": rec.get("source_filename") or rec.get("sample_source") or rec.get("analysis_id"),
        "age": patient.get("age"),
        "sex": patient.get("sex"),
        "age_band": _age_band_label(patient["age"]) if patient.get("age") is not None else None,
        "classification": classification,
        "has_oa": None if classification is None else classification != "Normal",
        "kl_grade": men.get("kl_grade", {}).get("grade"),
        "mean_thickness_mm": assess.get("mean_thickness_mm"),
        "min_thickness_mm": assess.get("min_thickness_mm"),
        "thickness_by_location": per_location,
        "quality_score_pct": quality.get("score_pct"),
        "quality_level": quality.get("level"),
        "review_recommended": bool(quality.get("review_recommended")),
        "implant_system": implant.get("system"),
        "implant_size": implant.get("size"),
        "implant_confidence_pct": implant.get("confidence_pct"),
        "implant_max_delta_mm": implant.get("max_abs_delta_mm"),
        "femoral_ml_mm": bones.get("femoral_ml_mm"),
        "femoral_ap_mm": bones.get("femoral_ap_mm"),
        "tibial_ml_mm": bones.get("tibial_ml_mm"),
        "tibial_ap_mm": bones.get("tibial_ap_mm"),
    }


def _oa_section(rows: List[Dict]) -> Dict:
    oa = [r["mean_thickness_mm"] for r in rows if r["has_oa"] is True]
    non_oa = [r["mean_thickness_mm"] for r in rows if r["has_oa"] is False]

    by_class = []
    for cls in SEVERITY_ORDER:
        vals = [r["mean_thickness_mm"] for r in rows if r["classification"] == cls]
        by_class.append({"label": cls, **describe(vals)})

    section = {
        "by_class": by_class,
        "comparison": _compare("OA", oa, "Non-OA", non_oa),
        "circular_on_simulated_data": True,
        "note": (
            "OA class is assigned by thresholding mean meniscus thickness, so this "
            "contrast is definitional rather than an observed association. It "
            "describes where the classifier's cut-points fall, not evidence that "
            "thickness predicts OA."
        ),
    }
    return section


def _sex_section(rows: List[Dict]) -> Dict:
    female = [r["mean_thickness_mm"] for r in rows if (r["sex"] or "").lower().startswith("f")]
    male = [r["mean_thickness_mm"] for r in rows if (r["sex"] or "").lower().startswith("m")]
    return {
        "groups": [
            {"label": "Female", **describe(female)},
            {"label": "Male", **describe(male)},
        ],
        "comparison": _compare("Female", female, "Male", male),
    }


def _age_section(rows: List[Dict]) -> Dict:
    groups = []
    for band in AGE_BANDS:
        vals = [r["mean_thickness_mm"] for r in rows if r["age_band"] == band]
        groups.append({"label": band, **describe(vals)})
    return {"groups": groups}


def _correlations(rows: List[Dict]) -> List[Dict]:
    """Pairwise Pearson r, each gated on MIN_CORRELATION_N complete pairs."""
    specs = [
        ("age", "mean_thickness_mm", "Age vs mean meniscus thickness",
         "Simulated thickness carries a coded -0.02 mm/year drift, so this recovers "
         "the generator's constant rather than an observed trend."),
        ("age", "kl_grade", "Age vs KL grade",
         "KL grade is derived from the OA class, which is derived from thickness."),
        ("mean_thickness_mm", "kl_grade", "Mean thickness vs KL grade",
         "KL grade is derived from thickness by threshold; the relationship is definitional."),
    ]
    out = []
    for xk, yk, label, caveat in specs:
        pairs = [(r[xk], r[yk]) for r in rows if r.get(xk) is not None and r.get(yk) is not None]
        if len(pairs) < MIN_CORRELATION_N:
            out.append({
                "label": label, "x": xk, "y": yk, "n": len(pairs), "available": False,
                "reason": "Needs at least {} studies with both values; have {}.".format(
                    MIN_CORRELATION_N, len(pairs)),
                "caveat": caveat,
            })
            continue
        r_val = _pearson([p[0] for p in pairs], [p[1] for p in pairs])
        out.append({
            "label": label, "x": xk, "y": yk, "n": len(pairs), "available": True,
            "r": round(r_val, 3) if r_val is not None else None,
            "strength": _interpret_r(r_val),
            "direction": None if r_val is None else ("negative" if r_val < 0 else "positive"),
            "caveat": caveat,
        })
    return out


def _implant_section(rows: List[Dict]) -> Dict:
    """Descriptive summary of the sizing module's output across the cohort."""
    sized = [r for r in rows if r["implant_size"]]
    if not sized:
        return {"available": False, "reason": "No implant matches in the included studies."}

    size_counts, system_counts = {}, {}
    for r in sized:
        size_counts[r["implant_size"]] = size_counts.get(r["implant_size"], 0) + 1
        if r["implant_system"]:
            system_counts[r["implant_system"]] = system_counts.get(r["implant_system"], 0) + 1

    conf = [r["implant_confidence_pct"] for r in sized if r["implant_confidence_pct"] is not None]
    delta = [r["implant_max_delta_mm"] for r in sized if r["implant_max_delta_mm"] is not None]

    return {
        "available": True,
        "n": len(sized),
        "size_distribution": [
            {"label": k, "count": v}
            for k, v in sorted(size_counts.items(), key=lambda kv: -kv[1])
        ],
        "system_distribution": [
            {"label": k, "count": v}
            for k, v in sorted(system_counts.items(), key=lambda kv: -kv[1])
        ],
        "match_confidence_pct": describe(conf, ndigits=1),
        "max_deviation_mm": describe(delta, ndigits=2),
        "bone_dimensions_mm": {
            "femoral_ml": describe([r["femoral_ml_mm"] for r in sized if r["femoral_ml_mm"] is not None], 1),
            "femoral_ap": describe([r["femoral_ap_mm"] for r in sized if r["femoral_ap_mm"] is not None], 1),
            "tibial_ml": describe([r["tibial_ml_mm"] for r in sized if r["tibial_ml_mm"] is not None], 1),
            "tibial_ap": describe([r["tibial_ap_mm"] for r in sized if r["tibial_ap_mm"] is not None], 1),
        },
        "note": (
            "Size distribution reflects the catalogue centroids the matcher ranks "
            "against, so it characterises the matching rule as much as the cohort."
        ),
    }


def build_summary(records: List[Dict], failures: Optional[List[Dict]] = None,
                  include_flagged: bool = False) -> Dict:
    """Aggregate a batch of analysis records into cohort statistics.

    Studies whose image quality triggered ``review_recommended`` are excluded by
    default and listed under ``excluded``, so a degraded film cannot quietly
    shift a cohort mean. ``include_flagged`` folds them back in for sensitivity
    checks; the returned counts always say which happened.
    """
    failures = failures or []
    all_rows = [_row(r) for r in records]

    flagged = [r for r in all_rows if r["review_recommended"]]
    kept = all_rows if include_flagged else [r for r in all_rows if not r["review_recommended"]]

    # Statistics need a thickness; a record missing one is unusable either way.
    rows = [r for r in kept if r["mean_thickness_mm"] is not None]
    thickness = [r["mean_thickness_mm"] for r in rows]

    by_location = {}
    for key in ("anterior_horn", "mid_body", "posterior_horn"):
        vals = [r["thickness_by_location"][key] for r in rows if key in r["thickness_by_location"]]
        by_location[key] = describe(vals)

    return {
        "counts": {
            "submitted": len(records) + len(failures),
            "analysed": len(records),
            "failed": len(failures),
            "quality_flagged": len(flagged),
            "included": len(rows),
            "include_flagged": include_flagged,
        },
        "failures": failures,
        "excluded": [
            {
                "label": r["label"],
                "quality_score_pct": r["quality_score_pct"],
                "quality_level": r["quality_level"],
                "reason": "Image quality below threshold — flagged for clinical review.",
            }
            for r in flagged
        ] if not include_flagged else [],
        "quality": describe([r["quality_score_pct"] for r in rows if r["quality_score_pct"] is not None], 1),
        "thickness": {
            "overall": describe(thickness),
            "by_location": by_location,
            "histogram": histogram(thickness),
        },
        "oa": _oa_section(rows),
        "sex": _sex_section(rows),
        "age": _age_section(rows),
        "correlations": _correlations(rows),
        "implant": _implant_section(rows),
        "scatter": [
            {
                "label": r["label"], "age": r["age"], "sex": r["sex"],
                "mean_thickness_mm": r["mean_thickness_mm"],
                "kl_grade": r["kl_grade"], "classification": r["classification"],
                "has_oa": r["has_oa"],
            }
            for r in rows
        ],
        "thresholds": {"min_group_n": MIN_GROUP_N, "min_correlation_n": MIN_CORRELATION_N},
        "interpretation": (
            "Descriptive cohort statistics only. These summarise measurement "
            "distributions and group differences in magnitude; they are not "
            "hypothesis tests and support no diagnostic claim about any individual "
            "study. Comparisons below the stated sample sizes are withheld rather "
            "than estimated."
        ),
    }
