"""Image serving + PDF report endpoints."""

import os
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from .. import store
from ..services.report_builder import build_report

router = APIRouter(prefix="/api", tags=["report"])

SAFE_NAME = re.compile(r"^[A-Za-z0-9_\-.]+$")


@router.get("/images/{filename}")
def get_image(filename: str):
    if not SAFE_NAME.match(filename) or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid image name.")
    path = os.path.join(store.IMAGE_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Image not found.")
    return FileResponse(path, media_type="image/png")


@router.get("/report/{analysis_id}")
def report(analysis_id: str):
    record = store.get(analysis_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    out_dir = os.path.join(store.STORAGE_DIR, "reports")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "knee_report_{}.pdf".format(analysis_id))

    build_report(record, store.IMAGE_DIR, out_path)

    safe_patient = re.sub(r"[^A-Za-z0-9]+", "_", record["patient"]["name"]).strip("_") or "patient"
    filename = "Knee_Report_{}_{}.pdf".format(safe_patient, analysis_id)
    return FileResponse(out_path, media_type="application/pdf", filename=filename)
