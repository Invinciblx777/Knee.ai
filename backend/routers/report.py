"""Image serving + PDF report endpoints."""

import base64
import os
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from fastapi.responses import FileResponse

import store
from services.report_builder import build_report

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


class ReportRequest(BaseModel):
    record: dict


@router.post("/report")
def generate_report(req: ReportRequest):
    record = req.record
    analysis_id = record.get("analysis_id", "unknown")

    # Reconstruct image files from base64 if provided, since Vercel drops them
    variants_data = record.get("images", {}).get("variants_data", {})
    variants = record.get("images", {}).get("variants", {})
    for key, b64_data in variants_data.items():
        if key in variants:
            filepath = os.path.join(store.IMAGE_DIR, variants[key])
            if b64_data.startswith("data:image"):
                b64_data = b64_data.split(",", 1)[1]
            try:
                with open(filepath, "wb") as f:
                    f.write(base64.b64decode(b64_data))
            except Exception:
                pass

    out_dir = os.path.join(store.STORAGE_DIR, "reports")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "knee_report_{}.pdf".format(analysis_id))

    build_report(record, store.IMAGE_DIR, out_path)

    patient_name = record.get("patient", {}).get("name", "patient")
    safe_patient = re.sub(r"[^A-Za-z0-9]+", "_", patient_name).strip("_") or "patient"
    filename = "Knee_Report_{}_{}.pdf".format(safe_patient, analysis_id)
    return FileResponse(out_path, media_type="application/pdf", filename=filename)

