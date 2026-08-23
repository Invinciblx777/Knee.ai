"""AI visual observations on the uploaded image itself (Featherless vision model).

Distinct from advice.py/chat.py: those reason over the *computed* record (measurements,
classification). This one sends the actual image pixels to a vision-language model and
asks what it can literally see — a second, independent read of the film, not a
restatement of numbers this platform's own (simulated) pipeline already produced.
"""

import base64
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import store
from routers.analysis import get_current_user
from services import featherless_client as fc
from services import supabase_client as db

router = APIRouter(prefix="/api", tags=["vision"])

# A small, fast vision-language model by default — large ones on Featherless run
# into capacity limits more often, and this is a live, interactive UI action.
VISION_MODEL = os.environ.get("FEATHERLESS_VISION_MODEL", "Qwen/Qwen3-VL-4B-Instruct")

SYSTEM = (
    "You are a radiology-education assistant describing a knee X-ray or MRI for a "
    "clinician's reference. Point out visually notable features you can actually see: "
    "joint space width and symmetry, bone alignment, any visible spurring or sclerosis "
    "patterns, soft-tissue shadows, and image positioning or quality. Be specific about "
    "what is visually present, not what it might mean diagnostically, and say so plainly "
    "if part of the image is unclear rather than guessing.\n\n"
    "You are not a diagnostic tool: never state a diagnosis, a severity grade, or a "
    "treatment recommendation — that judgment belongs to the clinician viewing this "
    "image, not to you.\n\n"
    "Output plain text only, no markdown syntax: no asterisks, no headers, no numbered "
    "lists. For any list use a line starting with a plain hyphen and a space. Keep it to "
    "a short paragraph or two, and end with one sentence noting these are visual "
    "observations, not a diagnosis."
)


class VisionRequest(BaseModel):
    filename: str  # the original ("none" variant) image filename
    record: Optional[dict] = None
    language: Optional[str] = None


def _resolve_image_data_uri(filename: str) -> str:
    """Inline the actual image bytes rather than pass a URL for Featherless to
    fetch — a local dev backend (127.0.0.1) isn't reachable from Featherless's
    servers, but our own backend can always reach Supabase storage, in dev or
    prod alike. Mirrors the local-file-then-Supabase lookup report.py's
    /api/images/{filename} already uses.
    """
    local_path = os.path.join(store.IMAGE_DIR, filename)
    if os.path.exists(local_path):
        with open(local_path, "rb") as fh:
            data = fh.read()
        return "data:image/png;base64," + base64.b64encode(data).decode()

    url = db.get_image_url(filename)
    if not url:
        raise HTTPException(status_code=404, detail="Image not found.")
    try:
        resp = httpx.get(url, timeout=20.0)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail="Could not fetch the stored image: {}".format(e))

    content_type = resp.headers.get("content-type", "image/jpeg")
    return "data:{};base64,{}".format(content_type, base64.b64encode(resp.content).decode())


@router.post("/vision")
def analyze_image_visually(req: VisionRequest, user_id: str = Depends(get_current_user)):
    data_uri = _resolve_image_data_uri(req.filename)

    context = ""
    if req.record:
        patient = req.record.get("patient", {})
        context = " Context: age {}, sex {}, {} knee, {}.".format(
            patient.get("age"), patient.get("sex"),
            patient.get("affected_side"), patient.get("imaging_type"),
        )

    system = SYSTEM + fc.language_instruction(req.language)
    messages = [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Describe what you can see in this knee image." + context},
                {"type": "image_url", "image_url": {"url": data_uri}},
            ],
        },
    ]

    try:
        observations = fc.chat(messages, model=VISION_MODEL, max_tokens=500, temperature=0.4)
    except fc.FeatherlessError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"observations": fc.strip_markdown(observations)}
