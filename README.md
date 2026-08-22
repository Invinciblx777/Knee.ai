# AI-Assisted Knee Analysis Platform

Clinical decision-support tool with two modules:

1. **Module 1: Medial Meniscus OA Assessment** — simulated segmentation, three-point thickness
   measurement, OA classification, KL grade, and population comparison charts.
2. **Module 2: Patient-Specific Implant Sizing** — simulated bone morphometry matched against a
   built-in catalogue of six implant systems, ranked by euclidean distance.

This application acts as a front-end demonstration of a fully integrated clinical pipeline. It processes all uploads using `model_inference` workflows to present a production-ready interface.

No live model weights ship with this repo; analysis results are deterministically simulated or drawn from pre-analyzed sidecars.

---

## Quick start

```bash
./run.sh
```

That creates the Python virtualenv, installs both dependency sets on first run, and starts
both processes:

| Service   | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:5173      |
| API       | http://127.0.0.1:8000      |
| API docs  | http://127.0.0.1:8000/docs |

`Ctrl+C` stops both. Override ports with `BACKEND_PORT=9000 FRONTEND_PORT=3000 ./run.sh`.

**Requirements:** Python 3.9+ and Node 18+.

### Manual start

```bash
# backend
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000

# frontend (second terminal)
cd frontend && npm install && npm run dev
```

Vite proxies `/api` to `127.0.0.1:8000`, so the UI needs no environment configuration.

---

## Usage Flow

1. **New Analysis** — either click one of the five pre-analyzed sample cards, or drop any knee X-ray or MRI
   (JPEG/PNG/BMP/TIFF/DICOM-lite), fill in name, age, sex, imaging type and affected side,
   and hit **Run Analysis**. Typical response is well under one second.
2. **Results** — patient header, OA badge, KL grade, side-by-side original vs annotated
   image with per-structure overlay toggles, thickness table, comparison bar + radar charts,
   bone measurements, and ranked implant recommendations with match confidence. Separated into Module 1 and Module 2.
3. **Generate Report** — downloads a two-page clinical PDF.
4. **History** — every stored analysis, searchable and filterable by severity.
5. **Settings** — classification thresholds, overlay colour key, and the full implant catalogue.

---

## Folder structure

```
knee-ai/
├── run.sh                        # single-command launcher
├── README.md
├── backend/
│   ├── main.py                   # FastAPI app, CORS, router wiring
│   ├── store.py                  # JSON-on-disk analysis store
│   ├── requirements.txt
│   ├── routers/
│   │   ├── analysis.py           # POST /api/analyze, history, catalogue
│   │   └── report.py             # image serving + PDF report
│   ├── services/
│   │   ├── image_processor.py    # OpenCV overlays, calliper lines, variants
│   │   ├── oa_classifier.py      # thickness simulation, OA class, KL grade
│   │   ├── implant_matcher.py    # bone morphometry + euclidean size matching
│   │   ├── analysis_builder.py   # assembles the record from deterministic simulation
│   │   ├── sample_registry.py    # sample lookup by MD5/filename, picker cards
│   │   ├── report_builder.py     # ReportLab clinical PDF
│   │   └── seed.py               # deterministic hash-seeded RNG
│   ├── data/
│   │   ├── implant_database.json # 6 systems × 5 sizes + population reference
│   │   └── samples/              # 5 pre-analyzed films + JSON sidecars + index.json
│   └── storage/                  # generated PNGs, PDFs, analyses.json (gitignored)
├── tools/
│   └── make_samples.py           # regenerates the sample films + sidecars
├── tests/
│   └── test_e2e.py               # end-to-end API suite (no test framework)
└── frontend/
    └── src/
        ├── App.jsx
        ├── lib/api.js
        ├── components/           # Sidebar, Topbar, Viewer, Charts, ui primitives
        └── pages/                # Dashboard, NewAnalysis, Results, History, Settings
```

---

## API

| Method   | Path                       | Purpose                                        |
|----------|----------------------------|------------------------------------------------|
| `GET`    | `/api/health`              | Liveness probe                                 |
| `POST`   | `/api/analyze`             | Multipart upload + patient form → full analysis |
| `GET`    | `/api/analyses`            | Compact history rows                           |
| `GET`    | `/api/analyses/{id}`       | Full stored analysis                           |
| `DELETE` | `/api/analyses/{id}`       | Remove an analysis                             |
| `GET`    | `/api/implants`            | Implant catalogue + population reference       |
| `GET`    | `/api/samples`             | Sample picker cards (age/sex/side, KL, OA)     |
| `GET`    | `/api/samples/{id}/image`  | Sample film PNG                                |
| `POST`   | `/api/analyze/sample/{id}` | Run a shipped sample through the model path    |
| `GET`    | `/api/images/{filename}`   | Rendered original / overlay variant PNG        |
| `GET`    | `/api/report/{id}`         | Clinical PDF report                            |

`POST /api/analyze` fields: `file`, `name`, `age`, `sex` (`Male`/`Female`),
`imaging_type` (`X-ray`/`MRI`), `affected_side` (`Left`/`Right`).

```bash
curl -X POST http://127.0.0.1:8000/api/analyze \
  -F "file=@knee.png" -F "name=Jane Doe" -F "age=67" \
  -F "sex=Female" -F "imaging_type=X-ray" -F "affected_side=Left"
```

---

## Inference paths

**Dispatch.** `POST /api/analyze` hashes the upload with MD5 and checks it against the sample
sidecars, falling back to a filename match. A hit loads that sidecar; a miss runs a deterministic simulation. The record shape is identical either way, and all runs present as a unified `model_inference` workflow.

**Sample sidecars** (`backend/data/samples/*.json`) carry `segmentation_polygon` point lists in
image pixel coordinates for femur, meniscus and tibia, the three meniscus thicknesses, femoral
and tibial AP/ML dimensions, tibial slope, OA class, KL grade, the demographics used at
analysis time, and the implant recommendation. On this path the overlays are drawn as real
per-pixel contours with callipers measured off the actual meniscus polygon — not boxes.

The five samples span KL 0 (Normal, 45 F Left), KL 1 (Mild, 52 M Right), KL 2 (Moderate,
58 F Left), KL 3 (Severe, 66 M Right) and KL 4 (post-TKA candidate, 72 F Left). Their films are
synthesised — real OAI images cannot be redistributed here — by `tools/make_samples.py`, which
writes the image and its sidecar together so the polygons match the pixels exactly. Rerun it
with `.venv/bin/python tools/make_samples.py` (the MD5s in the sidecars change, which is fine —
detection reads them back from the same files).

---

## Simulation logic

For uploads that don't match the pre-analyzed dataset, results are generated by a deterministic simulation.

**Determinism.** `sha256(image bytes)` seeds a namespaced RNG per subsystem
(`meniscus`, `bones`, `zones`), so identical uploads reproduce identical output while the
three subsystems stay independent.

**Meniscus thickness.** Clamped normal draws per location (Anterior Horn, Mid-Body,
Posterior Horn) inside 2.5–6.5 mm, centred on location means, shifted down for female
patients and drifting ~0.02 mm/year past age 35.

**OA classification** on mean thickness uses 4 age-band tiers and sex adjustments:

| Mean thickness | Class       |
|----------------|-------------|
| `< 3 mm`       | Severe OA   |
| `3 – 4 mm`     | Moderate OA |
| `4 – 5 mm`     | Mild OA     |
| `> 5 mm`       | Normal      |

- **Sex Adjustment:** Female patients receive a **−0.3 mm** shift across all thresholds.
- **Age Adjustments:**
  - `Age < 40`: 0 mm shift
  - `Age 40-50`: -0.15 mm shift
  - `Age 50-60`: -0.35 mm shift
  - `Age > 60`: -0.55 mm shift AND severity is escalated by one grade (e.g. Mild -> Moderate).

The KL grade (0–4) maps from the final class, nudged within its band by
absolute thickness so intermediate grades are reachable.

**Implant matching.** Bone dimensions (femoral ML/AP, tibial ML/AP, tibial slope) are drawn
from sex-specific population means. Each catalogued size is a 4-D centroid; candidates are
ranked by euclidean distance and confidence is `100 · e^(−d/19)`. One recommendation per
system, so the two alternatives are genuinely distinct hardware.

**Overlays.** The bone region is located first with an Otsu threshold: components are merged
back into whole limbs (the joint space splits each one), and on a film showing both knees the
limb matching the affected side is chosen — an AP view is displayed facing the patient, so the
patient's left knee is the one on the viewer's right. Femur / meniscus / tibia zones are then
placed proportionally *inside that region* and hash-jittered, with the meniscus box covering
the medial compartment only. If the threshold finds nothing convincing, the full frame is used.
Zones are drawn with OpenCV — orange femur, green meniscus, pink tibia — with
calliper lines and mm callouts. All eight toggle combinations are pre-rendered at analysis
time, so the UI toggles instantly without another request.

---

## Tests

`tests/test_e2e.py` drives the live API with generated knee images. No test framework — it
runs on the project venv (OpenCV and NumPy synthesise the test scans, everything else is
stdlib). Start the stack, then in a second terminal:

```bash
.venv/bin/python tests/test_e2e.py
```

Check groups cover liveness, the analysis contract, determinism, the rule-based classifications (age-band and sex checks), euclidean implant matching, form validation, and image variations.

The suite creates 15 analyses and deletes eight; wipe the rest before a demo with:

```bash
rm -rf backend/storage/images backend/storage/reports backend/storage/analyses.json
```

---

## Design system

**Warm Toon 3D Aesthetic:**
- **Background:** Beach cream (`#FFF5E4`)
- **Cards:** White surface with thick dark brown borders (`2px solid #2D2016`) and offset box-shadows (`4px 4px 0 #2D2016`)
- **Accent colors:** Vibrant orange (`#E8772E`), green (`#2D9F6F`), pink (`#E85D75`)
- **Typography:**
  - Headers: **Newsreader** (Serif)
  - UI/Labels: **Space Grotesk**
  - Body: **Inter**

The interface is fully responsive down to mobile with a collapsible sidebar and clean separation of assessment modules.

---

## Disclaimer

This tool is intended for research and decision support only. Final diagnosis remains with
the clinician. No validated model is used; all measurements are simulated.
