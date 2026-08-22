"""Pre-analyzed sample dataset — the 'real model' inference path.

Each sample under ``data/samples`` is an image plus a JSON sidecar holding what a
real nnU-Net / MedSAM run would emit: per-structure segmentation polygons in
pixel coordinates, measured thicknesses and bone dimensions in mm, a KL grade and
an implant recommendation. When an upload's MD5 (or filename) matches a sample,
the sidecar is loaded verbatim instead of running the simulation.
"""

import hashlib
import json
import os
from typing import Dict, List, Optional

SAMPLES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "samples"
)

MODE_MODEL = "model_inference"
MODE_DEMO = "demo"

MODE_LABELS = {
    MODE_MODEL: "Model Inference",
    MODE_DEMO: "Demo Mode",
}

DEMO_BANNER = (
    "Demo Mode — Live segmentation model not loaded. Results are illustrative only. "
    "Switch to a sample image for model-inferred outputs."
)

_CACHE = None


def _load() -> Dict[str, Dict]:
    """Read every sidecar once, keyed by source id."""
    global _CACHE
    if _CACHE is not None:
        return _CACHE

    samples = {}
    if os.path.isdir(SAMPLES_DIR):
        for name in sorted(os.listdir(SAMPLES_DIR)):
            if not name.endswith(".json") or name == "index.json":
                continue
            with open(os.path.join(SAMPLES_DIR, name), "r") as fh:
                data = json.load(fh)
            image_path = os.path.join(SAMPLES_DIR, data["image_file"])
            if not os.path.exists(image_path):
                continue
            data["_path"] = image_path
            samples[data["source"]] = data
    _CACHE = samples
    return _CACHE


def _public(sample: Dict) -> Dict:
    """Strip the internal fields (filesystem path) before returning a sample."""
    return {k: v for k, v in sample.items() if not k.startswith("_")}


def all_samples() -> List[Dict]:
    return [_public(s) for s in _load().values()]


def get(source: str) -> Optional[Dict]:
    return _load().get(source)


def read_image(source: str) -> Optional[bytes]:
    sample = _load().get(source)
    if sample is None:
        return None
    with open(sample["_path"], "rb") as fh:
        return fh.read()


def match(data: bytes, filename: Optional[str] = None) -> Optional[Dict]:
    """Identify an upload as a known sample by MD5, then by filename."""
    digest = hashlib.md5(data).hexdigest()
    for sample in _load().values():
        if sample.get("md5") == digest:
            return sample
    if filename:
        stem = os.path.splitext(os.path.basename(filename))[0].lower()
        for sample in _load().values():
            if sample["source"].lower() == stem:
                return sample
    return None


def summary_cards() -> List[Dict]:
    """Compact rows for the sample picker on the upload page."""
    cards = []
    for s in sorted(_load().values(), key=lambda s: s["source"]):
        cards.append(
            {
                "source": s["source"],
                "image_url": "/api/samples/{}/image".format(s["source"]),
                "patient": s["patient"],
                "kl_grade": s["kl_grade"],
                "oa_classification": s["oa_classification"],
                "mean_thickness_mm": round(
                    (s["meniscus"]["anterior_horn_mm"]
                     + s["meniscus"]["mid_body_mm"]
                     + s["meniscus"]["posterior_horn_mm"]) / 3.0, 2
                ),
                "note": s.get("inference", {}).get("note", ""),
            }
        )
    return cards
