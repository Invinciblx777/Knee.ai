# Knee.AI — Tech Stack & Modules

Companion to [`README.md`](README.md) (setup, API reference, usage flow). This one is a map of
*what's built with what* — every technology in use and every functional module, each pointing at
the actual files, not a generic list.

---

## Tech stack

### Frontend

| Tech | Version | Used for |
|---|---|---|
| [React](https://react.dev) | 18.3 | UI, all pages/components as function components + hooks |
| [Vite](https://vitejs.dev) | 5.4 | Dev server, build, `/api` proxy in local dev |
| [React Router](https://reactrouter.com) | 6.28 | Client-side routing (`App.jsx`), incl. session/AAL-gated routes |
| [Tailwind CSS](https://tailwindcss.com) | 3.4 | Styling — custom theme (`tailwind.config.js`) for the toon-3D design system |
| [Recharts](https://recharts.org) | 2.13 | All charts — thickness comparison/radar, cohort histograms/scatter (`components/Charts.jsx`) |
| [Supabase JS client](https://supabase.com/docs/reference/javascript) | 2.112 | Auth (sign-in/up, session, TOTP MFA), and direct RLS-scoped reads for History/Dashboard |
| [`qrcode`](https://www.npmjs.com/package/qrcode) | 1.5 | Generates the 2FA setup QR client-side from the `otpauth://` URI |
| PostCSS + Autoprefixer | — | Tailwind build pipeline |

No UI component library — every card, button, badge, and chip is a hand-built primitive in
`components/ui.jsx` and `components/Icon.jsx` (inline SVGs, no icon package).

### Backend

| Tech | Version | Used for |
|---|---|---|
| [FastAPI](https://fastapi.tiangolo.com) | 0.115 | The whole API — routers in `backend/routers/` |
| [Uvicorn](https://www.uvicorn.org) | 0.32 (installed, not yet pinned in `requirements.txt` — see note below) | ASGI server, local dev only (Vercel handles the ASGI entrypoint itself in prod) |
| [Pydantic](https://docs.pydantic.dev) | 2.10 | Request/response models on every router |
| [OpenCV](https://opencv.org) (`opencv-python-headless`) | 4.10 | Otsu bone-region detection, overlay drawing, calliper lines, Laplacian sharpness for quality scoring |
| [NumPy](https://numpy.org) | 2.0 | Array ops backing the OpenCV pipeline and quality metrics |
| [Pillow](https://python-pillow.org) | 11.0 | Fallback image decode for formats OpenCV declines |
| [ReportLab](https://www.reportlab.com/opensource) | 4.2 | The two-page clinical PDF report |
| [`httpx`](https://www.python-httpx.org) | 0.28 | Outbound calls — Featherless AI, and fetching stored images server-side for the vision endpoint |
| [`supabase-py`](https://github.com/supabase/supabase-py) | 2.11 | Same Supabase project as the frontend, used server-side for token verification, RLS-scoped queries, and storage |
| `python-dotenv` | 1.0 | Loads `backend/.env` locally |
| `python-multipart` | 0.0.20 | Multipart file upload parsing (`POST /api/analyze`) |

**Note:** `uvicorn` is genuinely required for local dev (`run.sh` launches it directly) but isn't
listed in `backend/requirements.txt` — it was deliberately dropped for the Vercel deployment
(unneeded there; Vercel's Python runtime owns the ASGI entrypoint), but that same requirements
file is also what `run.sh` installs from for local dev. A fresh clone needs `pip install uvicorn`
separately until that's reconciled.

### Auth, database & storage

- **[Supabase Auth](https://supabase.com/docs/guides/auth)** — email/password, plus TOTP MFA
  (`supabase.auth.mfa.*`) for 2FA. AAL (authenticator assurance level) is enforced both by the
  frontend (`App.jsx`) and independently by the backend (`services/supabase_client.py`).
- **Supabase Postgres** — one table, `analyses` (`user_id`, `analysis_id`, `patient_name`,
  `classification`, `record` JSON, plus `advice` text set later via History's doctor-note editor),
  with row-level security keyed on `auth.uid() = user_id`.
- **Supabase Storage** — the `images` bucket holds rendered overlay PNGs for analyses that don't
  keep local disk (i.e. every production request, since Vercel's filesystem is ephemeral).

### AI

- **[Featherless AI](https://featherless.ai)** — one OpenAI-compatible endpoint
  (`services/featherless_client.py`) serving three distinct features:
  - **Chat** — multi-turn assistant, text model (default `deepseek-ai/DeepSeek-V3-0324`).
  - **Food/diet advice** — one-shot write-up, same text model.
  - **AI Visual Scan** — a real **vision-language model** (default `Qwen/Qwen3-VL-4B-Instruct`)
    reads the actual uploaded image. This is the one place in the app where a genuine pretrained
    model looks at pixels; everything in Modules 1/2 is simulated (see `README.md`).
- Both the text and vision models are swappable via `FEATHERLESS_MODEL` /
  `FEATHERLESS_VISION_MODEL` — Featherless hosts drop-in alternatives (Kimi, GLM for text;
  Qwen2.5-VL, InternVL for vision) behind the same API shape.

### Deployment & infra

- **[Vercel](https://vercel.com)** — two separate projects from this one repo: a static Vite build
  for the frontend, and a Python serverless deployment for the backend (`backend/api/index.py`,
  `backend/vercel.json`).
- **Git / GitHub** — version control, this repo.

### Dev tooling

- **Bash** (`run.sh`) — single-command local launcher: creates the venv, installs both dependency
  sets, runs FastAPI + Vite together.
- **`tools/make_samples.py`** — regenerates the 5 bundled synthetic sample films + JSON sidecars.
- No test framework — `tests/test_e2e.py` is a plain Python script driving the live API.

---

## Modules

Grouped by what a user actually interacts with, each pointing at its real implementation.

### 1. Authentication & security
- Sign in / sign up — `frontend/src/pages/Auth.jsx`
- TOTP 2FA enrollment + management — `frontend/src/pages/Settings.jsx` (the "Two-Factor
  Authentication" card), backed by Supabase MFA
- Login-time 2FA challenge — `frontend/src/pages/MfaChallenge.jsx`
- Session/AAL gating (blocks the app until 2FA is satisfied, if enabled) — `frontend/src/App.jsx`
- Backend token + AAL verification, per-request RLS-scoped Supabase client —
  `backend/services/supabase_client.py`

### 2. New Analysis (upload & intake)
- Sample picker + upload form + patient intake — `frontend/src/pages/NewAnalysis.jsx`
- Upload handling, MD5/hash dispatch to sample vs. simulated path —
  `backend/routers/analysis.py`, `backend/services/sample_registry.py`

### 3. Module 1 — Meniscus & OA Analysis
- Page — `frontend/src/pages/OaAnalysis.jsx`
- Thickness simulation, OA classification, KL grading —
  `backend/services/oa_classifier.py`
- Population comparison charts — `frontend/src/components/Charts.jsx`

### 4. Module 2 — Implant Sizing
- Page — `frontend/src/pages/ImplantSizing.jsx`
- Bone morphometry + euclidean size matching against the implant catalogue —
  `backend/services/implant_matcher.py`, `backend/data/implant_database.json`

### 5. Shared analysis chrome
- Patient header, quality banner, module tab switcher, meniscus/implant tables, quality card —
  all in `frontend/src/components/AnalysisShell.jsx` (shared by Modules 1 and 2 so they can never
  show different numbers for the same study)

### 6. Image quality & measurement uncertainty
- Resolution/sharpness/contrast/region-detection scoring, ± tolerance bands —
  `backend/services/quality.py`

### 7. AI Visual Scan
- Button + result card — `frontend/src/components/AnalysisShell.jsx`
- Endpoint — `backend/routers/vision.py` (see [Tech stack → AI](#ai) above)

### 8. AI chat assistant
- Floating widget, any page, context-aware of the study you're viewing —
  `frontend/src/components/ChatWidget.jsx`
- Endpoint — `backend/routers/chat.py`

### 9. AI food & diet advice
- "Get AI Food Diet" button — `frontend/src/components/AnalysisShell.jsx`
- Endpoint — `backend/routers/advice.py`

### 10. Report generation
- PDF build — `backend/services/report_builder.py`
- Endpoints — `backend/routers/report.py`

### 11. History
- Searchable/filterable analysis list, doctor-only advice editor, per-row PDF/delete —
  `frontend/src/pages/History.jsx`

### 12. Dashboard
- At-a-glance stats + recent analyses table — `frontend/src/pages/Dashboard.jsx`

### 13. Research Mode (batch cohort statistics)
- Page — `frontend/src/pages/Research.jsx`
- Descriptive statistics engine (gated comparisons/correlations, quality exclusion) —
  `backend/services/cohort.py`
- Endpoints — `backend/routers/research.py`

### 14. Settings
- Account + 2FA management, OA threshold reference, overlay colour key, full implant catalogue —
  `frontend/src/pages/Settings.jsx`

### 15. About
- Platform explanation, pipeline steps, contact info — `frontend/src/pages/About.jsx`

### 16. Multi-language (i18n)
- Dictionaries (5 languages) — `frontend/src/lib/i18n.js`
- Provider/hook — `frontend/src/lib/LanguageContext.jsx`
- Switcher (top-right, next to the API status badge) — `frontend/src/components/LanguageSwitcher.jsx`

### 17. Design system
- Toon-3D aesthetic (cream background, thick dark borders, offset drop shadows) — Tailwind theme
  in `frontend/tailwind.config.js`, applied consistently across every card/button/badge

---

For setup instructions, the full API reference, and an honest breakdown of what's real AI vs.
simulated output, see [`README.md`](README.md).
