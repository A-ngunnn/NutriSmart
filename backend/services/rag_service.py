"""
Knowledge Service – loads Thai RDI knowledge base from JSON files
and provides context for AI prompts.

Uses direct context injection (no vector DB needed for small knowledge bases).
"""

import json
from pathlib import Path
from typing import Optional

from config import get_settings

settings = get_settings()

# ── Cached knowledge ─────────────────────────────────────────────────────────
_knowledge_items: Optional[list[dict]] = None


def _load_knowledge() -> list[dict]:
    """Load all JSON knowledge files from the knowledge directory."""
    global _knowledge_items
    if _knowledge_items is not None:
        return _knowledge_items

    knowledge_path = Path(settings.knowledge_dir)
    all_items: list[dict] = []

    if not knowledge_path.exists():
        print(f"[KNOWLEDGE] Warning: directory not found: {knowledge_path}")
        _knowledge_items = []
        return _knowledge_items

    for json_file in knowledge_path.glob("*.json"):
        with open(json_file, "r", encoding="utf-8") as f:
            items = json.load(f)
            if isinstance(items, list):
                all_items.extend(items)

    _knowledge_items = all_items
    return _knowledge_items


def load_knowledge() -> int:
    """Load knowledge base at startup. Returns count of items."""
    items = _load_knowledge()
    print(f"[KNOWLEDGE] Loaded {len(items)} knowledge items.")
    return len(items)


def get_all_context() -> str:
    """Return ALL knowledge items formatted as context text."""
    items = _load_knowledge()
    if not items:
        return "ไม่มีข้อมูลอ้างอิง"

    parts = []
    for item in items:
        parts.append(f"- {item['topic']}: {item['content']}")
    return "\n".join(parts)


def get_relevant_context(query: str, max_items: int = 6) -> str:
    """
    Simple keyword-based retrieval.
    Returns knowledge items that share keywords with the query.
    Falls back to all context if no keyword matches.
    """
    items = _load_knowledge()
    if not items:
        return "ไม่มีข้อมูลอ้างอิง"

    query_lower = query.lower()

    # Score each item by keyword overlap
    scored = []
    for item in items:
        text = f"{item['topic']} {item['content']}".lower()
        # Count matching words (simple keyword matching)
        score = sum(1 for word in query_lower.split() if word in text and len(word) > 1)
        scored.append((score, item))

    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)

    # Take top items with score > 0, or all if none match
    relevant = [item for score, item in scored[:max_items] if score > 0]
    if not relevant:
        relevant = [item for _, item in scored[:max_items]]

    parts = []
    for item in relevant:
        parts.append(f"- {item['topic']}: {item['content']}")
    return "\n".join(parts)
