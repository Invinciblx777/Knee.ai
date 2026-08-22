"""Deterministic seeding helpers.

Every simulated measurement is derived from the SHA-256 hash of the uploaded
image bytes, so the same image always produces the same analysis.
"""

import hashlib
import random
from typing import Tuple


def image_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rng_for(digest: str, salt: str = "") -> random.Random:
    """Return a Random seeded from the image digest plus a namespace salt."""
    seed_material = "{}:{}".format(digest, salt).encode("utf-8")
    seed_int = int(hashlib.sha256(seed_material).hexdigest()[:16], 16)
    return random.Random(seed_int)


def scaled(rng: random.Random, low: float, high: float, ndigits: int = 1) -> float:
    return round(rng.uniform(low, high), ndigits)


def bounded_normal(
    rng: random.Random, mean: float, sd: float, bounds: Tuple[float, float], ndigits: int = 1
) -> float:
    """Normal draw clamped into a clinically plausible interval."""
    value = rng.gauss(mean, sd)
    low, high = bounds
    return round(min(max(value, low), high), ndigits)
