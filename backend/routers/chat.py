"""General-purpose assistant chat, available from anywhere in the app.

Distinct from /api/advice (a one-shot food/diet write-up for a specific
analysis): this is a multi-turn conversation. If the caller is looking at an
analysis when they open the chat, its key numbers are folded into the system
prompt as context; otherwise the assistant just talks about the platform and
knee OA in general.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routers.analysis import get_current_user
from services import featherless_client as fc

router = APIRouter(prefix="/api", tags=["chat"])

MAX_TURNS = 20
MAX_MESSAGE_CHARS = 2000

BASE_SYSTEM = (
    "You are the assistant built into Knee.AI, a clinical decision-support platform for "
    "knee osteoarthritis assessment and patient-specific implant sizing. You can explain "
    "what the platform's measurements and terms mean (meniscus thickness, KL grade, "
    "implant sizing/confidence, image quality), answer general questions about knee "
    "osteoarthritis, and give general food/lifestyle guidance. You are not a diagnostic "
    "tool and do not have access to any patient's data beyond what is given to you in "
    "this conversation; if asked to diagnose or prescribe, say that's for their "
    "clinician.\n\n"
    "Output plain text only. Never use markdown syntax: no asterisks, no **bold**, no "
    "# headers, no numbered lists. For lists use a line starting with a plain hyphen and "
    "a space. Keep replies conversational and concise, a few short paragraphs at most "
    "unless the user asks for detail."
)


class ChatMessage(BaseModel):
    role: str
    content: str = Field(max_length=MAX_MESSAGE_CHARS)


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    record: Optional[dict] = None
    language: Optional[str] = None


def _context_line(record: dict) -> str:
    patient = record.get("patient", {})
    assessment = record.get("meniscus", {}).get("assessment", {})
    kl = record.get("meniscus", {}).get("kl_grade", {})
    implant = record.get("implant", {}).get("primary", {})

    parts = [
        "The user is currently viewing this analysis, for context if relevant "
        "(don't restate it unless asked):",
        f"Patient: age {patient.get('age')}, sex {patient.get('sex')}, "
        f"{patient.get('affected_side')} knee.",
    ]
    if assessment:
        parts.append(
            f"OA classification: {assessment.get('classification')} "
            f"(KL grade {kl.get('grade')}), mean meniscus thickness "
            f"{assessment.get('mean_thickness_mm')} mm."
        )
    if implant:
        parts.append(
            f"Recommended implant: {implant.get('system')} size {implant.get('size')} "
            f"({implant.get('confidence_pct')}% match)."
        )
    return " ".join(parts)


@router.post("/chat")
def send_message(req: ChatRequest, user_id: str = Depends(get_current_user)):
    if not req.messages:
        raise HTTPException(status_code=400, detail="Send at least one message.")
    if len(req.messages) > MAX_TURNS:
        raise HTTPException(
            status_code=400,
            detail="Conversation limited to {} messages; start a new chat.".format(MAX_TURNS),
        )
    if any(m.role not in ("user", "assistant") for m in req.messages):
        raise HTTPException(status_code=400, detail="Message role must be 'user' or 'assistant'.")
    if req.messages[-1].role != "user":
        raise HTTPException(status_code=400, detail="The last message must be from the user.")

    system = BASE_SYSTEM
    if req.record:
        system = system + "\n\n" + _context_line(req.record)
    system = system + fc.language_instruction(req.language)

    messages = [{"role": "system", "content": system}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    try:
        reply = fc.chat(messages, max_tokens=500, temperature=0.6)
    except fc.FeatherlessError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"reply": fc.strip_markdown(reply)}
