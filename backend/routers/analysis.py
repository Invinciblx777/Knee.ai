"""Upload + analysis endpoints."""

import os
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from .. import store
from ..services import analysis_builder as builder
from ..services import image_processor as ip
from ..services import sample_registry as sr
from ..services.implant_matcher import load_database
from ..services.seed import image_hash

router = APIRouter(prefix="/api", tags=["analysis"])

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".dcm", ".dicom"}
MAX_BYTES = 25 * 1024 * 1024


def _validate(filename: str, size: int) -> None:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type '{}'. Accepted: JPEG, PNG, BMP, TIFF, DICOM-lite.".format(ext or "unknown"),
        )
    if size > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 25 MB limit.")
    if size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")


def _decode(data: bytes):
    try:
        return ip.load_image(data)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode the image. Try a JPEG or PNG export.")


@router.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    name: str = Form(...),
    age: int = Form(...),
    sex: str = Form(...),
    imaging_type: str = Form(...),
    affected_side: str = Form(...),
):
    """Analyse an upload.

    A file matching one of the shipped samples (by MD5, then by filename) is
    served from its JSON sidecar as model inference; anything else falls through
    to the deterministic simulation and is flagged as demo mode.
    """
    data = await file.read()
    _validate(file.filename, len(data))

    if not 1 <= age <= 120:
        raise HTTPException(status_code=400, detail="Age must be between 1 and 120.")
    if sex not in ("Male", "Female"):
        raise HTTPException(status_code=400, detail="Sex must be 'Male' or 'Female'.")

    img = _decode(data)
    digest = image_hash(data)

    sample = sr.match(data, file.filename)
    if sample is not None:
        record = builder.build_from_sample(
            sample, file.filename,
            {"name": name.strip(), "imaging_type": imaging_type},
            digest, img, store.IMAGE_DIR,
        )
    else:
        patient = {
            "name": name.strip(), "age": age, "sex": sex,
            "imaging_type": imaging_type, "affected_side": affected_side,
        }
        record = builder.build_simulated(img, digest, file.filename, patient, img, store.IMAGE_DIR)

    store.save(record)
    return record


@router.get("/samples")
def samples():
    """Cards for the sample picker on the upload page."""
    return {"count": len(sr.summary_cards()), "items": sr.summary_cards()}


@router.get("/samples/{source}/image")
def sample_image(source: str):
    sample = sr.get(source)
    if sample is None:
        raise HTTPException(status_code=404, detail="Sample not found.")
    return FileResponse(sample["_path"], media_type="image/png")


@router.post("/analyze/sample/{source}")
def analyze_sample(source: str, name: Optional[str] = Form(None)):
    """Run a shipped sample straight through the model-inference path."""
    sample = sr.get(source)
    if sample is None:
        raise HTTPException(status_code=404, detail="Sample not found.")

    data = sr.read_image(source)
    img = _decode(data)
    record = builder.build_from_sample(
        sample, sample["image_file"], {"name": (name or "").strip() or None},
        image_hash(data), img, store.IMAGE_DIR,
    )
    store.save(record)
    return record


@router.get("/analyses")
def list_analyses():
    """Compact rows for the History page."""
    rows = []
    for r in store.list_all():
        rows.append(
            {
                "analysis_id": r["analysis_id"],
                "created_at": r["created_at"],
                "patient": r["patient"],
                "classification": r["meniscus"]["assessment"]["classification"],
                "kl_grade": r["meniscus"]["kl_grade"]["grade"],
                "mean_thickness_mm": r["meniscus"]["assessment"]["mean_thickness_mm"],
                "primary_implant": "{} {} ({})".format(
                    r["implant"]["primary"]["system"],
                    r["implant"]["primary"]["size"],
                    r["implant"]["primary"]["manufacturer"],
                ),
                "confidence_pct": r["implant"]["primary"]["confidence_pct"],
                "mode": r.get("mode", "demo"),
                "mode_label": r.get("mode_label", "Demo Mode"),
                "thumbnail": r["images"]["variants"]["femur-meniscus-tibia"],
            }
        )
    return {"count": len(rows), "items": rows}


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: str):
    record = store.get(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return record


@router.delete("/analyses/{analysis_id}")
def delete_analysis(analysis_id: str):
    if not store.delete(analysis_id):
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return {"deleted": analysis_id}


@router.get("/implants")
def implants():
    """Expose the implant catalogue for the Settings / reference view."""
    return load_database()
