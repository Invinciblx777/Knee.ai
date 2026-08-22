"""AI-Assisted Knee Analysis Platform — FastAPI entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import store
from .routers import analysis, report

app = FastAPI(
    title="AI-Assisted Knee Analysis Platform",
    description=(
        "Clinical decision-support API. Module 1: medial meniscus OA assessment. "
        "Module 2: patient-specific knee implant sizing. All AI outputs are simulated "
        "and seeded deterministically from the uploaded image hash."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router)
app.include_router(report.router)


@app.on_event("startup")
def _startup():
    store.init()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "knee-analysis", "version": "1.0.0"}
