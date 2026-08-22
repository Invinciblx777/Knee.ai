# AI-Assisted Knee Analysis Platform

Clinical decision-support demo with two modules:

1. **Medial Meniscus OA Assessment** — simulated segmentation, three-point thickness
   measurement, OA classification, KL grade, and population comparison charts.
2. **Patient-Specific Implant Sizing** — simulated bone morphometry matched against a
   built-in catalogue of six implant systems, ranked by euclidean distance.

The analysis pipeline is **hybrid**, and the app always tells you which path ran:

| Path | When | Badge |
|------|------|-------|
| **Model Inference** | The upload matches one of the 5 shipped sample films (MD5, then filename), or is launched from the sample picker. Segmentation polygons, thicknesses, bone dimensions, KL grade and implant picks are read from that sample's JSON sidecar — what an nnU-Net / MedSAM run would emit. | 🟢 Model Inference |
| **Demo Mode** | Any other upload. The deterministic simulation runs instead, seeded from the SHA-256 of the image, and an unmissable amber banner says so on screen and in the PDF. | 🟡 Demo Mode |

No live model weights ship with this repo, so nothing is passed off as a real inference that
is not one.

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

## Demo flow

1. **New Analysis** — either click one of the five pre-analyzed sample cards (runs the model
   path immediately, no form needed), or drop any knee X-ray or MRI
   (JPEG/PNG/BMP/TIFF/DICOM-lite), fill in name, age, sex, imaging type and affected side,
   and hit **Run Analysis**. Typical response is well under one second.
2. **Results** — patient header, OA badge, KL grade, side-by-side original vs annotated
   image with per-structure overlay toggles, thickness table, comparison bar + radar charts,
   bone measurements, and ranked implant recommendations with match confidence.
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
│   │   ├── analysis_builder.py   # assembles the record from either inference path
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
│   └── test_e2e.py               # 72-check end-to-end API suite (no test framework)
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
sidecars, falling back to a filename match. A hit loads that sidecar; a miss runs the
simulation and stamps the record with `mode: "demo"` plus the banner text. The record shape is
identical either way, so the dashboard, history and PDF never branch except to show the badge.

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

Used on the demo path only.

**Determinism.** `sha256(image bytes)` seeds a namespaced RNG per subsystem
(`meniscus`, `bones`, `zones`), so identical uploads reproduce identical output while the
three subsystems stay independent.

**Meniscus thickness.** Clamped normal draws per location (Anterior Horn, Mid-Body,
Posterior Horn) inside 2.5–6.5 mm, centred on location means, shifted down for female
patients and drifting ~0.02 mm/year past age 35.

**OA classification** on mean thickness:

| Mean thickness | Class       |
|----------------|-------------|
| `< 3 mm`       | Severe OA   |
| `3 – 4 mm`     | Moderate OA |
| `4 – 5 mm`     | Mild OA     |
| `> 5 mm`       | Normal      |

Female patients get a **−0.3 mm** shift on every threshold; **age > 60** escalates severity
by one grade. The KL grade (0–4) maps from the final class, nudged within its band by
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
Zones are drawn with OpenCV — blue femur, green meniscus, red tibia — with
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

72 checks across nine groups:

| Group | Covers |
|-------|--------|
| Health + catalogue | 6 systems, XS–XL per system, all three manufacturers present |
| Analysis contract | 3 locations, thickness inside 2.5–6.5 mm, KL 0–4, one primary plus two *distinct* alternatives, 8 overlay variants, response under 5 s |
| Determinism | Same image reproduces identical thickness, bone dims, implant pick and hash; a different image changes all of them |
| Classification rules | Age > 60 escalates, age ≤ 60 does not, female thresholds land exactly 0.3 mm below male |
| Implant matching | Reported distance equals a recomputed euclidean, the primary really is the nearest of all 30 catalogued sizes, confidence stays in range |
| Validation | Bad extension, out-of-range age, invalid sex, empty file, undecodable bytes → 400; unknown id → 404; path traversal on the image route blocked; rejected uploads never reach history |
| Images, history, report | Every variant serves a real PNG, history rows carry thumbnails, the PDF has 2 pages and 2 embedded images, delete then 404 |
| Overlay placement | The bone ROI is found on a bilateral film, covers one limb rather than the whole frame, and the affected side selects the correct limb; ROI never comes back empty |
| Hybrid inference | The picker lists 5 samples spanning KL 0–4 with mixed sexes/sides; the picker and an MD5-matched upload both run the model path with sidecar values and no banner; an unknown image falls back to demo mode with the banner; the mode reaches history and both PDFs |

The suite creates 15 analyses and deletes eight; wipe the rest before a demo with:

```bash
rm -rf backend/storage/images backend/storage/reports backend/storage/analyses.json
```

Browser click-through of the overlay toggles and the Generate Report button is not automated
— the endpoints behind both are covered directly.

---

## Design system

White background · `#0F172A` headers · `#3B82F6` accent · `#10B981` normal · `#EF4444`
severe · Inter · 8 px radius · 1 px `#E2E8F0` borders · no gradients · tables without zebra
striping · responsive down to mobile with a collapsible sidebar.

---

## Disclaimer

This tool is intended for research and decision support only. Final diagnosis remains with
the clinician. No validated model is used; all measurements are simulated.
