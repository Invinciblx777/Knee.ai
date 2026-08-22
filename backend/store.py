"""Tiny JSON-on-disk store for analyses.

Enough to back the History page and let report generation happen in a second
request without recomputing. Not a database; a hackathon needs neither.
"""

import json
import os
import threading
from typing import Dict, List, Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
IMAGE_DIR = os.path.join(STORAGE_DIR, "images")
INDEX_PATH = os.path.join(STORAGE_DIR, "analyses.json")

_lock = threading.Lock()


def init() -> None:
    os.makedirs(IMAGE_DIR, exist_ok=True)
    if not os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, "w") as fh:
            json.dump([], fh)


def _read_all() -> List[Dict]:
    init()
    try:
        with open(INDEX_PATH, "r") as fh:
            return json.load(fh)
    except (ValueError, IOError):
        return []


def save(analysis: Dict) -> None:
    with _lock:
        records = _read_all()
        records = [r for r in records if r["analysis_id"] != analysis["analysis_id"]]
        records.insert(0, analysis)
        with open(INDEX_PATH, "w") as fh:
            json.dump(records[:200], fh, indent=2)


def get(analysis_id: str) -> Optional[Dict]:
    for record in _read_all():
        if record["analysis_id"] == analysis_id:
            return record
    return None


def list_all() -> List[Dict]:
    return _read_all()


def delete(analysis_id: str) -> bool:
    with _lock:
        records = _read_all()
        remaining = [r for r in records if r["analysis_id"] != analysis_id]
        if len(remaining) == len(records):
            return False
        with open(INDEX_PATH, "w") as fh:
            json.dump(remaining, fh, indent=2)
        return True
