"""AI-generated food & diet advice for a patient's knee analysis."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routers.analysis import get_current_user
from services import featherless_client as fc

router = APIRouter(prefix="/api", tags=["advice"])


class AdviceRequest(BaseModel):
    record: dict


def _build_messages(record: dict) -> list:
    patient = record.get("patient", {})
    meniscus = record.get("meniscus", {})
    assessment = meniscus.get("assessment", {})
    kl = meniscus.get("kl_grade", {})

    system = (
        "You are a clinical nutrition assistant helping patients understand food and diet "
        "choices for managing knee osteoarthritis. Given one patient's knee analysis, write "
        "practical, food-focused guidance: anti-inflammatory foods to favor, foods or patterns "
        "to limit, weight-management and hydration notes where relevant to their profile, and "
        "2-3 sample meal ideas. Tailor it to their OA severity, age, and sex.\n\n"
        "Output plain text only. This is a strict rule: never use markdown syntax of any kind - "
        "no asterisks, no **bold**, no # headers, no numbered lists like '1.'. Structure the "
        "answer as short paragraphs, and for any list use a line starting with a plain hyphen "
        "and a space ('- item'), nothing else. End with one sentence noting this is general "
        "guidance, not a substitute for their clinician or a registered dietitian."
    )
    user = (
        f"Patient: {patient.get('name', 'the patient')}, age {patient.get('age')}, "
        f"sex {patient.get('sex')}, affected knee: {patient.get('affected_side')}.\n"
        f"OA classification: {assessment.get('classification')} "
        f"(KL grade {kl.get('grade')} - {kl.get('description')}).\n"
        f"Mean medial meniscus thickness: {assessment.get('mean_thickness_mm')} mm "
        f"(minimum {assessment.get('min_thickness_mm')} mm across measured locations).\n\n"
        "Give this patient food and diet advice for managing their knee condition."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


@router.post("/advice")
def get_food_advice(req: AdviceRequest, user_id: str = Depends(get_current_user)):
    messages = _build_messages(req.record)
    try:
        advice = fc.chat(messages)
    except fc.FeatherlessError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"advice": fc.strip_markdown(advice)}
