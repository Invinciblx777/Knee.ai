"""Thin client for Featherless AI's OpenAI-compatible chat completions API."""

import os
import re
from typing import List, Optional

import httpx

FEATHERLESS_API_KEY = os.environ.get("FEATHERLESS_API_KEY")
FEATHERLESS_MODEL = os.environ.get("FEATHERLESS_MODEL", "deepseek-ai/DeepSeek-V3-0324")
FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1"


class FeatherlessError(Exception):
    pass


def chat(messages: List[dict], model: Optional[str] = None, max_tokens: int = 900, temperature: float = 0.5) -> str:
    if not FEATHERLESS_API_KEY:
        raise FeatherlessError("FEATHERLESS_API_KEY is not configured.")

    try:
        resp = httpx.post(
            f"{FEATHERLESS_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {FEATHERLESS_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model or FEATHERLESS_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
            timeout=60.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise FeatherlessError(f"Featherless API error ({e.response.status_code}): {e.response.text[:300]}") from e
    except httpx.HTTPError as e:
        raise FeatherlessError(f"Featherless request failed: {e}") from e

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as e:
        raise FeatherlessError("Unexpected response shape from Featherless.") from e


def strip_markdown(text: str) -> str:
    """Models don't always honour a plain-text instruction; clean up what leaks through."""
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"(?m)^#{1,6}\s*", "", text)
    text = re.sub(r"(?m)^\s*\d+\.\s+", "- ", text)
    text = re.sub(r"(?m)^\s*\*\s+", "- ", text)
    return text.strip()
