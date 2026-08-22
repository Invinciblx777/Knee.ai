"""Research mode — batch analysis and cohort-level descriptive statistics."""

import tempfile
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from routers.analysis import ALLOWED_EXT, MAX_BYTES, _decode, _validate, get_current_user
from services import analysis_builder as builder
from services import cohort
from services import sample_registry as sr
from services.seed import image_hash

router = APIRouter(prefix="/api/research", tags=["research"])

MAX_BATCH = 200


def _study_record(data: bytes, filename: str, patient: dict) -> dict:
    """One study through the shared measurement core, without overlay rendering.

    Uses ``analysis_builder.run_measurements`` — the same meniscus, OA, bone,
    implant and quality calls the single-study path runs — so cohort numbers and
    per-patient numbers can never drift apart.
    """
    img = _decode(data)
    digest = image_hash(data)
    core = builder.run_measurements(digest, patient, img)

    return {
        "analysis_id": digest[:12],
        "source_filename": filename,
        "patient": patient,
        "meniscus": {
            "measurements": core["measurements"],
            "assessment": core["assessment"],
            "kl_grade": core["kl"],
        },
        "implant": core["implant"],
        "bone_measurements": core["bones"],
        "quality": core["quality"],
        "uncertainty": core["uncertainty"],
    }


def _parse_meta(raw: Optional[str], count: int) -> List[dict]:
    """Per-study age/sex/side, supplied as parallel comma-separated lists."""
    if not raw:
        return [{} for _ in range(count)]
    parts = [p.strip() for p in raw.split(",")]
    if len(parts) != count:
        raise HTTPException(
            status_code=400,
            detail="Expected {} values to match {} files, got {}.".format(count, count, len(parts)),
        )
    return parts


@router.post("/cohort")
async def analyse_cohort(
    files: List[UploadFile] = File(...),
    ages: Optional[str] = Form(None),
    sexes: Optional[str] = Form(None),
    sides: Optional[str] = Form(None),
    include_flagged: bool = Form(False),
    user_id: str = Depends(get_current_user),
):
    """Run a batch of studies and return cohort statistics.

    ``ages``/``sexes``/``sides`` are optional comma-separated lists parallel to
    ``files``; anything missing falls back to a neutral default so a cohort can
    be explored before its metadata is complete.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Upload at least one study.")
    if len(files) > MAX_BATCH:
        raise HTTPException(
            status_code=400,
            detail="Batch limited to {} studies; received {}.".format(MAX_BATCH, len(files)),
        )

    age_list = _parse_meta(ages, len(files))
    sex_list = _parse_meta(sexes, len(files))
    side_list = _parse_meta(sides, len(files))

    records, failures = [], []
    for i, upload in enumerate(files):
        name = upload.filename or "study_{}".format(i + 1)
        try:
            data = await upload.read()
            _validate(name, len(data))

            raw_age = age_list[i] if isinstance(age_list[i], str) else ""
            try:
                age = int(raw_age) if raw_age else 55
            except ValueError:
                raise ValueError("Age '{}' is not a whole number.".format(raw_age))
            if not 1 <= age <= 120:
                raise ValueError("Age must be between 1 and 120.")

            raw_sex = (sex_list[i] if isinstance(sex_list[i], str) else "") or "Female"
            sex = "Female" if raw_sex.lower().startswith("f") else "Male"
            raw_side = (side_list[i] if isinstance(side_list[i], str) else "") or "Left"
            side = "Left" if raw_side.lower().startswith("l") else "Right"

            patient = {
                "name": name, "age": age, "sex": sex,
                "imaging_type": "X-ray", "affected_side": side,
            }
            records.append(_study_record(data, name, patient))
        except HTTPException as e:
            failures.append({"label": name, "reason": e.detail})
        except Exception as e:  # one unreadable film must not sink the batch
            failures.append({"label": name, "reason": str(e)})

    if not records:
        raise HTTPException(
            status_code=422,
            detail="No study could be analysed. " + "; ".join(f["reason"] for f in failures[:3]),
        )

    return cohort.build_summary(records, failures=failures, include_flagged=include_flagged)


@router.post("/cohort/samples")
def analyse_bundled_samples(
    include_flagged: bool = Form(False),
    user_id: str = Depends(get_current_user),
):
    """Cohort over the bundled reference samples — a zero-upload demo path.

    Runs ``build_from_sample``, the same path ``/api/analyze/sample/{source}``
    uses, so a sample's cohort row reports exactly what its patient view does.
    Re-deriving these from the image hash instead would have the cohort call a
    study Moderate OA while the patient page called it Normal. Rendering into a
    temporary directory is wasted work, but it is bounded by the five bundled
    samples and is the price of having one pipeline rather than two.
    """
    records, failures = [], []
    with tempfile.TemporaryDirectory() as tmp:
        for card in sr.all_samples():
            source = card["source"]
            sample = sr.get(source)
            data = sr.read_image(source)
            if sample is None or data is None:
                failures.append({"label": source, "reason": "Sample image unavailable."})
                continue
            try:
                img = _decode(data)
                rec = builder.build_from_sample(
                    sample, sample["image_file"], None, image_hash(data), img, tmp,
                )
                rec["images"].pop("variants_data", None)  # cohort never renders them
                records.append(rec)
            except Exception as e:
                failures.append({"label": source, "reason": str(e)})

    if not records:
        raise HTTPException(status_code=422, detail="No bundled sample could be analysed.")

    return cohort.build_summary(records, failures=failures, include_flagged=include_flagged)
