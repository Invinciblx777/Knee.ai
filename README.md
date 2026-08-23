# Knee.AI — AI-Assisted Knee Analysis Platform

A clinical decision-support platform with two assessment modules, backed by Supabase auth
(with TOTP 2FA), an AI assistant, and a batch research mode:

1. **Module 1 — Medial Meniscus Thickness & OA Analysis**: simulated segmentation, three-point
   thickness measurement, OA classification, KL grading, and population comparison charts.
2. **Module 2 — Femur/Tibia Measurements & Implant Sizing**: simulated bone morphometry matched
   against a built-in catalogue of six implant systems, ranked by euclidean distance.

Every analysis also carries an **image-quality score and per-measurement uncertainty band**,
derived from the uploaded film itself (resolution, sharpness, contrast, whether the bone region
was actually located) — degraded films are flagged for clinical review rather than presented
with the same confidence as a clean one.

No live model weights ship with this repo; analysis results are deterministically simulated or
drawn from pre-analyzed sidecars. See [Inference paths](#inference-paths).

---

## Feature overview

- **Two clinical modules** as separate pages (`/oa`, `/implant`), sharing one patient header,
  quality banner, and tab switcher for the same study.
- **Accounts via Supabase Auth** — email/password sign-in, doctor/patient roles, row-level
  security scoped per user.
- **TOTP two-factor authentication** — enable in Settings (QR + manual secret), enforced both by
  the login flow and by the backend itself (a password-only token is rejected once an account has
  a verified factor — not just a UI gate).
- **AI assistant (Featherless AI)** — a floating chat widget with context awareness of whatever
  study you're viewing, plus a one-shot "Get AI Food Diet" write-up per analysis. Model is
  configurable (defaults to DeepSeek-V3; Kimi/GLM etc. all work through the same OpenAI-compatible
  endpoint).
- **Multi-language UI** — English (default), Hindi, Tamil, Malayalam, Telugu. Chat and food-advice
  replies are generated directly in the selected language; see [Multi-language](#multi-language).
- **Research Mode** — batch-upload a cohort (or run the bundled samples) for descriptive
  statistics: thickness distributions, OA/sex/age-band comparisons, correlations, and an implant
  sizing summary. Studies that fail the quality check are excluded by default. See
  [Research Mode](#research-mode).
- **Image quality & uncertainty** — every analysis is scored on resolution, sharpness, contrast,
  and region detection; the score drives a "clinical review recommended" banner and ± tolerance
  bands shown next to each measurement.

---

## Quick start

```bash
./run.sh
```

That creates the Python virtualenv, installs both dependency sets on first run, and starts both
processes:

| Service   | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:5173      |
| API       | http://127.0.0.1:8000      |
| API docs  | http://127.0.0.1:8000/docs |

`Ctrl+C` stops both. Override ports with `BACKEND_PORT=9000 FRONTEND_PORT=3000 ./run.sh`.

**Requirements:** Python 3.9+ and Node 18+, plus a Supabase project (see below) — the app fails
to start meaningfully without one, since auth is not optional.

### Manual start

```bash
# backend (uvicorn is launched from inside backend/ — main.py uses absolute imports
# that assume backend/ as the working directory, matching the Vercel deployment layout)
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd backend && ../.venv/bin/python -m uvicorn main:app --reload --port 8000

# frontend (second terminal)
cd frontend && npm install && npm run dev
```

Vite proxies `/api` to `127.0.0.1:8000` in dev, so the UI needs no `VITE_API_URL` locally.

---

## Environment variables

**`backend/.env`** (gitignored — copy `backend/.env.example`):

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=

FEATHERLESS_API_KEY=
FEATHERLESS_MODEL=deepseek-ai/DeepSeek-V3-0324   # optional, this is the default
```

Without `SUPABASE_URL`/`SUPABASE_ANON_KEY`, every authenticated endpoint returns 401. Without
`FEATHERLESS_API_KEY`, the chat widget and food-advice button return 502 — everything else works.

**`frontend/.env`** (gitignored, local dev) and **`frontend/.env.production`** (tracked — see
below):

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=            # prod only; omit locally, Vite proxies /api instead
```

The Supabase anon key is safe to commit: it's a build-time value baked into the client bundle
either way (anyone can read it in the shipped JS), it grants no privileges on its own, and access
is gated by row-level security. That's why `frontend/.env.production` is tracked in git while
`backend/.env` and `frontend/.env` are not — the backend's key, and any future service-role key,
must never end up in a public bundle or history.

Your Supabase project needs email/password auth enabled and, if you want 2FA, TOTP MFA enabled
(Authentication → Providers). The `analyses` table needs RLS policies keyed on
`auth.uid() = user_id`; the backend authenticates each request as the calling user (not with a
shared service-role client) so those policies apply normally — see
[Authentication & security](#authentication--security).

---

## Deployment (Vercel)

Frontend and backend deploy as **two separate Vercel projects** from this one repo:

- **Backend** — root directory set to `backend/`, entrypoint `backend/api/index.py`
  (`backend/vercel.json` routes everything to it). Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `FEATHERLESS_API_KEY`, `FEATHERLESS_MODEL` as project environment variables.
- **Frontend** — root directory `frontend/`, standard Vite build. `frontend/.env.production`
  supplies `VITE_API_URL` (pointed at the backend project's URL) and the Supabase public config.

Because the backend's root is `backend/` in production but the repo root locally, `backend/main.py`
uses absolute imports (`import store`, `from routers import ...`) throughout — that's also why
local dev launches uvicorn from *inside* `backend/` rather than from the repo root.

---

## Usage flow

1. **Sign in** — email/password. If the account has 2FA enabled, a TOTP code is required after
   the password step before the app becomes accessible at all (enforced by the backend too, not
   just the login screen).
2. **New Analysis** — click a pre-analyzed sample card, or drop any knee X-ray or MRI
   (JPEG/PNG/BMP/TIFF/DICOM-lite), fill in patient details, and **Run Analysis**.
3. **Meniscus & OA** (`/oa/:id`) and **Implant Sizing** (`/implant/:id`) — the two modules, each
   with its own page and a tab switcher between them for the same study. Both show the quality
   banner and ± uncertainty bands when relevant.
4. **Get AI Food Diet** / the chat bubble — AI-generated dietary guidance for the current study,
   or a free-form conversation that's aware of whatever study you're viewing.
5. **Generate Report** — downloads a two-page clinical PDF.
6. **History** — every stored analysis, searchable and filterable by severity, with a doctor-only
   inline advice editor.
7. **Research** — batch-analyse an uploaded cohort or the bundled samples for descriptive
   statistics across the group.
8. **Settings** — account info, 2FA management, classification thresholds, overlay colour key,
   and the full implant catalogue.

A language switcher sits next to the API status badge (top right) — English, हिन्दी, தமிழ்,
മലയാളം, తెలుగు.

---

## Folder structure

```
knee-ai/
├── run.sh                          # single-command launcher
├── README.md
├── backend/
│   ├── main.py                     # FastAPI app, CORS, router wiring
│   ├── store.py                    # JSON-on-disk local storage helpers
│   ├── requirements.txt
│   ├── .env.example
│   ├── api/index.py                # Vercel serverless entrypoint
│   ├── vercel.json
│   ├── routers/
│   │   ├── analysis.py             # POST /api/analyze, history, catalogue, auth deps
│   │   ├── report.py                # image serving + PDF report
│   │   ├── advice.py                # AI food/diet advice (Featherless)
│   │   ├── chat.py                  # AI assistant chat (Featherless)
│   │   └── research.py              # batch cohort analysis + statistics
│   ├── services/
│   │   ├── image_processor.py      # OpenCV overlays, calliper lines, variants
│   │   ├── oa_classifier.py        # thickness simulation, OA class, KL grade
│   │   ├── implant_matcher.py      # bone morphometry + euclidean size matching
│   │   ├── analysis_builder.py     # assembles the record; run_measurements() is
│   │   │                           #   shared by the single-study and cohort paths
│   │   ├── quality.py              # image-quality scoring + uncertainty bands
│   │   ├── cohort.py                # descriptive statistics for Research Mode
│   │   ├── sample_registry.py      # sample lookup by MD5/filename, picker cards
│   │   ├── supabase_client.py      # per-request authenticated Supabase client, MFA/AAL check
│   │   ├── featherless_client.py   # Featherless chat completions + language instruction
│   │   ├── report_builder.py       # ReportLab clinical PDF
│   │   └── seed.py                 # deterministic hash-seeded RNG
│   ├── data/
│   │   ├── implant_database.json   # 6 systems × 5 sizes + population reference
│   │   └── samples/                # 5 pre-analyzed films + JSON sidecars + index.json
│   └── storage/                    # generated PNGs, PDFs, analyses.json (gitignored)
├── tools/
│   └── make_samples.py             # regenerates the sample films + sidecars
├── tests/
│   └── test_e2e.py                 # end-to-end API suite — predates auth, see Tests
└── frontend/
    ├── .env.production             # tracked; public build-time config, see above
    └── src/
        ├── App.jsx                 # session/AAL gating, routes
        ├── lib/
        │   ├── api.js
        │   ├── supabase.js         # client init + build-config guard
        │   ├── i18n.js             # per-language dictionaries
        │   └── LanguageContext.jsx
        ├── components/             # Sidebar, Topbar, Viewer, Charts, ChatWidget,
        │                           #   AnalysisShell (shared module-page chrome), ui primitives
        └── pages/                  # Dashboard, NewAnalysis, OaAnalysis, ImplantSizing,
                                     #   History, Research, Settings, Auth, MfaChallenge
```

---

## API

All `/api/analyze*`, `/api/analyses*`, `/api/implants`, `/api/advice`, `/api/chat`, and
`/api/research/*` routes require `Authorization: Bearer <supabase access token>`, and reject a
password-only (aal1) token if the account has 2FA enabled. `/api/report*`, `/api/images/*`, and
`/api/samples*` are public.

| Method   | Path                        | Auth | Purpose                                          |
|----------|-----------------------------|:----:|---------------------------------------------------|
| `GET`    | `/api/health`               |      | Liveness probe                                    |
| `POST`   | `/api/analyze`              |  ✓   | Multipart upload + patient form → full analysis    |
| `POST`   | `/api/analyze/sample/{id}`  |  ✓   | Run a shipped sample through the model path        |
| `GET`    | `/api/analyses`             |  ✓   | Compact history rows                               |
| `GET`    | `/api/analyses/{id}`        |  ✓   | Full stored analysis                               |
| `DELETE` | `/api/analyses/{id}`        |  ✓   | Remove an analysis                                 |
| `GET`    | `/api/implants`             |  ✓   | Implant catalogue + population reference           |
| `GET`    | `/api/samples`              |      | Sample picker cards (age/sex/side, KL, OA)         |
| `GET`    | `/api/samples/{id}/image`   |      | Sample film PNG                                    |
| `GET`    | `/api/images/{filename}`    |      | Rendered original / overlay variant PNG            |
| `GET`    | `/api/report/{id}`          |      | Clinical PDF report (stored analysis)              |
| `POST`   | `/api/report`               |      | Clinical PDF report (from a record in the body)    |
| `POST`   | `/api/advice`               |  ✓   | AI food/diet advice for one analysis               |
| `POST`   | `/api/chat`                 |  ✓   | Multi-turn AI assistant, optionally record-aware   |
| `POST`   | `/api/research/cohort`      |  ✓   | Batch-analyse uploaded studies → cohort statistics |
| `POST`   | `/api/research/cohort/samples` | ✓ | Cohort statistics over the bundled samples         |

`POST /api/analyze` fields: `file`, `name`, `age`, `sex` (`Male`/`Female`),
`imaging_type` (`X-ray`/`MRI`), `affected_side` (`Left`/`Right`).

```bash
curl -X POST http://127.0.0.1:8000/api/analyze \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F "file=@knee.png" -F "name=Jane Doe" -F "age=67" \
  -F "sex=Female" -F "imaging_type=X-ray" -F "affected_side=Left"
```

`POST /api/advice` and `POST /api/chat` both accept an optional `language` field — one of
`Hindi`, `Tamil`, `Malayalam`, `Telugu` (whitelisted server-side; anything else is ignored rather
than interpolated into the prompt, since it isn't free text an end user should control).

---

## Authentication & security

- **Auth** is Supabase Auth (email/password). The frontend talks to Supabase directly for
  sign-in/sign-up/session management; the backend independently verifies every request's bearer
  token via `supabase.auth.get_user()` rather than trusting the frontend.
- **Row-level security**: the backend never uses a shared, anon-key-only client for user data.
  `services/supabase_client.py` builds a fresh client per request, authenticated with the caller's
  own JWT, so `analyses` table reads/writes run *as that user* and RLS policies keyed on
  `auth.uid() = user_id` apply normally.
- **Two-factor authentication (TOTP)**: enable from Settings — Supabase issues a QR/secret, the
  frontend renders the QR itself via the `qrcode` package (not Supabase's own returned SVG, which
  proved unreliable to inline directly), and confirms with a 6-digit code.
  - **Frontend gate**: `App.jsx` checks `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` on
    every session change and shows a TOTP challenge screen before rendering anything else if a
    verified factor exists and the session is still aal1.
  - **Backend enforcement**: `verify_token()` reads the account's factor list and the token's
    `aal` claim directly. If the account has a verified factor and the token is aal1, the request
    is rejected — this closes the gap where a stolen password alone could call the API directly,
    bypassing the frontend's login prompt entirely.

---

## AI features

Both the floating chat widget and the "Get AI Food Diet" button call **Featherless AI**, an
OpenAI-compatible inference host, via `services/featherless_client.py`. The model is set by
`FEATHERLESS_MODEL` (default `deepseek-ai/DeepSeek-V3-0324`); Featherless also hosts Kimi (`
moonshotai/Kimi-K2-Instruct`) and GLM (`zai-org/GLM-4.6`) models, which work as drop-in
replacements against the same endpoint.

- **Chat** (`/api/chat`) is a real multi-turn conversation, capped at 20 messages and 2000
  characters each. If you're viewing an analysis when you open it, that study's classification,
  KL grade, thickness, and recommended implant are folded into the system prompt automatically.
- **Food advice** (`/api/advice`) is a one-shot write-up tailored to one analysis's OA severity,
  age, and sex, kept distinct from the doctor-authored "Doctor's Advice" field in History.
- Both endpoints strip markdown the model leaks despite being told not to (`strip_markdown()`),
  since instruction-following on that specific rule isn't reliable across models.

## Multi-language

The UI chrome — navigation, auth, settings, the New Analysis form, the two module pages'
headers/tables/buttons, chart legends, the chat widget — is translated across English, Hindi,
Tamil, Malayalam, Telugu via a flat dictionary (`frontend/src/lib/i18n.js`) and
`useLanguage()`/`t()`. Selection persists in `localStorage`; English is the default.

**Not translated, deliberately**: text assembled server-side by interpolating computed values
into English sentences — measurement rationale, KL descriptions, quality-factor detail, implant
manufacturer/system names, research correlation captions. Translating that means localizing the
backend's string assembly, not just adding UI labels. AI-generated text (chat, food advice) isn't
in the dictionary either, but *does* speak the selected language — the frontend passes the
language name to the backend, which folds a "respond in {language}" instruction into the prompt.

Classification values (`Normal`/`Mild OA`/`Moderate OA`/`Severe OA`), sex, and side stay the
literal English strings the backend returns everywhere they're used as data (badge color mapping,
filters, chart series keys) — only the *displayed* label is translated.

---

## Image quality & uncertainty

`services/quality.py` scores every upload on four measured signals — effective resolution
(geometric mean of the measured region, not the shorter edge, since a knee region is naturally
~2:1 tall), Laplacian sharpness, intensity spread, and whether `detect_roi` actually isolated the
bone region. The overall score is capped at the *worst* factor plus a small margin rather than a
plain weighted mean, so one disqualifying factor (e.g. a 160px crop) can't be averaged away by
three good ones.

That score derives a ± mm/° tolerance band per measurement type (meniscus thickness, bone
dimensions, tibial slope), shown inline next to the numbers it qualifies, and widens further on
the simulated path (proportional zones) versus the sample path (traced per-pixel polygons). A
score below the "acceptable" threshold — or a failed region detection — triggers a "clinical
review recommended" banner on the results pages.

Verified against the five bundled samples (92–96% quality, no review flag) and against blurred /
downscaled / low-contrast / degenerate inputs (all correctly flagged).

---

## Research Mode

Batch-upload a cohort, or run the bundled samples, for **descriptive statistics only** — no
p-values, no diagnostic claims. `services/cohort.py` reuses the same measurement core as the
single-study path (`analysis_builder.run_measurements`) so a study's numbers can never drift
between its patient view and its cohort row.

- **Quality-gated by default**: studies whose image quality triggers `review_recommended` are
  excluded from statistics and listed separately; an `include_flagged` toggle folds them back in
  for a sensitivity check. One unreadable file in a batch doesn't sink the rest.
- **Comparisons** (OA status, sex, age band) report a difference in means and Cohen's d, gated at
  5 studies per group; **correlations** are gated at 10 complete pairs. Below those sizes, the API
  returns an explicit withheld state with the counts rather than a number computed from a handful
  of studies.
- **On the platform's simulated data specifically**, several associations are structural rather
  than empirical — OA class is assigned by thresholding thickness (so that comparison is circular
  by construction), and simulated thickness carries a coded sex/age drift (so those trends recover
  the generator's own constants). The UI states this at the point of display; against real
  annotated studies the same statistics would be meaningful.

---

## Inference paths

**Dispatch.** `POST /api/analyze` hashes the upload with MD5 and checks it against the sample
sidecars, falling back to a filename match. A hit loads that sidecar; a miss runs a deterministic
simulation. The record shape is identical either way, and all runs present as a unified
`model_inference` workflow.

**Sample sidecars** (`backend/data/samples/*.json`) carry `segmentation_polygon` point lists in
image pixel coordinates for femur, meniscus and tibia, the three meniscus thicknesses, femoral
and tibial AP/ML dimensions, tibial slope, OA class, KL grade, the demographics used at analysis
time, and the implant recommendation. On this path the overlays are drawn as real per-pixel
contours with callipers measured off the actual meniscus polygon — not boxes.

The five samples span KL 0 (Normal, 45 F Left), KL 1 (Mild, 52 M Right), KL 2 (Moderate,
58 F Left), KL 3 (Severe, 66 M Right) and KL 4 (post-TKA candidate, 72 F Left). Their films are
synthesised — real OAI images cannot be redistributed here — by `tools/make_samples.py`, which
writes the image and its sidecar together so the polygons match the pixels exactly. Rerun it with
`.venv/bin/python tools/make_samples.py` (the MD5s in the sidecars change, which is fine —
detection reads them back from the same files).

---

## Simulation logic

For uploads that don't match the pre-analyzed dataset, results are generated by a deterministic
simulation.

**Determinism.** `sha256(image bytes)` seeds a namespaced RNG per subsystem (`meniscus`, `bones`,
`zones`), so identical uploads reproduce identical output while the three subsystems stay
independent.

**Meniscus thickness.** Clamped normal draws per location (Anterior Horn, Mid-Body, Posterior
Horn) inside 2.5–6.5 mm, centred on location means, shifted down for female patients and drifting
~0.02 mm/year past age 35.

**OA classification** on mean thickness uses 4 age-band tiers and sex adjustments:

| Mean thickness | Class       |
|-----------------|-------------|
| `< 3 mm`        | Severe OA   |
| `3 – 4 mm`       | Moderate OA |
| `4 – 5 mm`       | Mild OA     |
| `> 5 mm`         | Normal      |

- **Sex Adjustment:** Female patients receive a **−0.3 mm** shift across all thresholds.
- **Age Adjustments:**
  - `Age < 40`: 0 mm shift
  - `Age 40-50`: -0.15 mm shift
  - `Age 50-60`: -0.35 mm shift
  - `Age > 60`: -0.55 mm shift AND severity is escalated by one grade (e.g. Mild -> Moderate).

The KL grade (0–4) maps from the final class, nudged within its band by absolute thickness so
intermediate grades are reachable.

**Implant matching.** Bone dimensions (femoral ML/AP, tibial ML/AP, tibial slope) are drawn from
sex-specific population means. Each catalogued size is a 4-D centroid; candidates are ranked by
euclidean distance and confidence is `100 · e^(−d/19)`. One recommendation per system, so the two
alternatives are genuinely distinct hardware.

**Overlays.** The bone region is located first with an Otsu threshold: components are merged back
into whole limbs (the joint space splits each one), and on a film showing both knees the limb
matching the affected side is chosen — an AP view is displayed facing the patient, so the
patient's left knee is the one on the viewer's right. Femur / meniscus / tibia zones are then
placed proportionally *inside that region* and hash-jittered, with the meniscus box covering the
medial compartment only. If the threshold finds nothing convincing, the full frame is used. Zones
are drawn with OpenCV — orange femur, green meniscus, pink tibia — with calliper lines and mm
callouts. All eight toggle combinations are pre-rendered at analysis time, so the UI toggles
instantly without another request.

---

## Tests

`tests/test_e2e.py` drives the live API with generated knee images — no test framework, just the
project venv (OpenCV/NumPy synthesise the test scans, everything else is stdlib). **It predates
authentication** and does not attach a bearer token, so as written it now gets 401s from every
endpoint it exercises; treat it as a reference for the analysis contract and rule-based
classifications rather than a suite you can currently run unmodified. Updating it to sign in via
Supabase first is a natural next step.

```bash
.venv/bin/python tests/test_e2e.py
```

The suite creates 15 analyses and deletes eight; wipe the rest before a demo with:

```bash
rm -rf backend/storage/images backend/storage/reports backend/storage/analyses.json
```

---

## Design system

**Warm Toon 3D Aesthetic:**
- **Background:** Beach cream (`#FFF5E4`)
- **Cards:** White surface with thick dark brown borders (`2px solid #2D2016`) and offset
  box-shadows (`4px 4px 0 #2D2016`)
- **Accent colors:** Vibrant orange (`#E8772E`), green (`#2D9F6F`), pink (`#E85D75`)
- **Typography:**
  - Headers: **Newsreader** (Serif)
  - UI/Labels: **Space Grotesk**
  - Body: **Inter**

The interface is fully responsive down to mobile with a collapsible sidebar and clean separation
of assessment modules.

---

## Disclaimer

This tool is intended for research and decision support only. Final diagnosis remains with the
clinician. No validated model is used; all measurements are simulated.
