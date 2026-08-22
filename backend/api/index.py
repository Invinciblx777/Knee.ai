"""Vercel serverless entrypoint for the Knee AI FastAPI app.

Vercel root directory is set to `backend/` in the dashboard, so this file
lives at `api/index.py` relative to that root. The working directory in
Vercel's runtime is the project root (backend/), so all imports resolve
as absolute top-level imports.
"""

from main import app  # noqa: F401  — Vercel picks up `app` automatically
