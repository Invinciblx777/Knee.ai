"""AI-Assisted Knee Analysis Platform — FastAPI entrypoint."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import store
from routers import advice, analysis, report, research

app = FastAPI(
    title="AI-Assisted Knee Analysis Platform",
    description=(
        "Clinical decision-support API. Module 1: medial meniscus OA assessment. "
        "Module 2: patient-specific knee implant sizing. All AI outputs are simulated "
        "and seeded deterministically from the uploaded image hash."
    ),
    version="1.0.0",
)

# Allow the production frontend URL (set via env var) plus local dev origins.
_PROD_FRONTEND = os.getenv("FRONTEND_URL", "").strip()
_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://knee-mu.vercel.app",
    "https://kneeai.vercel.app",
]
if _PROD_FRONTEND and _PROD_FRONTEND not in _ORIGINS:
    _ORIGINS.append(_PROD_FRONTEND)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router)
app.include_router(report.router)
app.include_router(advice.router)
app.include_router(research.router)


@app.on_event("startup")
def _startup():
    store.init()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "knee-analysis", "version": "1.0.0"}
