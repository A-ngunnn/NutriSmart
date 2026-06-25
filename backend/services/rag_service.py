"""
RAG Service – Thai Nutrition Knowledge Base
ค้นหาบริบทความรู้โภชนาการไทย (Thai RDI + คำแนะนำทางการแพทย์) แบบ keyword-matching

หมายเหตุสำคัญ:
  เดิมไฟล์นี้ใช้ ChromaDB + sentence-transformers (vector embeddings) แต่ถูกถอดออก
  เนื่องจากโมเดล embedding กิน RAM เกินขีดจำกัดของ Render Free Tier จนเซิร์ฟเวอร์ล่ม
  จึงเปลี่ยนมาใช้การค้นหาแบบ keyword overlap ที่เบากว่ามาก (ไม่ต้องโหลดโมเดลใดๆ)
  แต่ยังคงดึงข้อมูลจากคลังความรู้ไฟล์ JSON ใน database/knowledge/ เหมือนเดิม
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List

from config import get_settings

settings = get_settings()
logger = logging.getLogger("nutrismart.rag_service")

_NO_CONTEXT = "ไม่มีข้อมูลอ้างอิง"

# ── Knowledge Base Loading (cached in-memory, loaded once at import time) ────

_knowledge_cache: List[Dict[str, str]] = []
_load_error: str | None = None


def _load_knowledge() -> List[Dict[str, str]]:
    """โหลดความรู้ทั้งหมดจากไฟล์ .json ใน knowledge_dir (เช่น thai-rdi.json)"""
    global _load_error
    items: List[Dict[str, str]] = []
    knowledge_dir = Path(settings.knowledge_dir)

    if not knowledge_dir.exists():
        _load_error = f"knowledge_dir not found: {knowledge_dir}"
        logger.warning("[RAG] %s", _load_error)
        return items

    for json_file in sorted(knowledge_dir.glob("*.json")):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                for entry in data:
                    if isinstance(entry, dict) and entry.get("content"):
                        items.append({
                            "id": str(entry.get("id", "")),
                            "topic": str(entry.get("topic", "")),
                            "content": str(entry.get("content", "")),
                        })
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("[RAG] Failed to load knowledge file %s: %s", json_file, exc)

    if not items:
        _load_error = "no knowledge entries loaded"
        logger.warning("[RAG] %s (dir=%s)", _load_error, knowledge_dir)
    else:
        logger.info("[RAG] Loaded %d knowledge entries from %s", len(items), knowledge_dir)

    return items


def _get_knowledge() -> List[Dict[str, str]]:
    global _knowledge_cache
    if not _knowledge_cache:
        _knowledge_cache = _load_knowledge()
    return _knowledge_cache


# ── Public API ────────────────────────────────────────────────────────────────

def load_knowledge() -> int:
    """
    เรียกครั้งเดียวตอน FastAPI startup (lifespan ใน main.py) เพื่อโหลดคลังความรู้เข้า cache ทันที
    คืนค่าจำนวนรายการที่โหลดสำเร็จ (สำหรับ log ตอนเริ่มระบบ)
    """
    global _knowledge_cache
    _knowledge_cache = _load_knowledge()
    return len(_knowledge_cache)

def get_all_context() -> str:
    """คืนค่าความรู้ทั้งหมดในคลัง (ใช้สำหรับ debug หรือ context แบบเหมาเข่ง)"""
    try:
        items = _get_knowledge()
        if not items:
            return _NO_CONTEXT
        return "\n".join(item["content"] for item in items)
    except Exception:
        logger.exception("[RAG] get_all_context failed")
        return _NO_CONTEXT


def get_relevant_context(query: str, max_items: int = 3) -> str:
    """
    ค้นหาความรู้ที่เกี่ยวข้องกับ query มากที่สุด โดยให้คะแนนตามจำนวนคำที่ตรงกับ topic/content
    (keyword overlap แบบเบาๆ ไม่ต้องใช้ vector embeddings)
    คำที่ตรงกับ "topic" (เช่น ชื่อโรค) มีน้ำหนักสูงกว่าคำที่ตรงกับ "content" เฉยๆ
    เพื่อให้รายการที่เจาะจงเฉพาะ (เช่น โรคประจำตัว) ไม่ถูกกลบด้วยคำศัพท์โภชนาการทั่วไปที่ซ้ำกันหลายรายการ
    """
    try:
        items = _get_knowledge()
        if not items:
            return _NO_CONTEXT
        if not query or not query.strip():
            return "\n\n".join(item["content"] for item in items[:max_items])

        query_words = [w for w in query.lower().split() if w]
        scored: List[tuple[int, str]] = []
        for item in items:
            topic_lower = item["topic"].lower()
            content_lower = item["content"].lower()
            topic_score = sum(3 for w in query_words if w in topic_lower)
            content_score = sum(1 for w in query_words if w in content_lower)
            score = topic_score + content_score
            if score > 0:
                scored.append((score, item["content"]))

        if not scored:
            # ไม่เจอคำที่ตรงกันเลย → ส่งความรู้หลักไปให้ AI สรุปแทน (ดีกว่าไม่มีบริบทเลย)
            return "\n\n".join(item["content"] for item in items[:max_items])

        scored.sort(key=lambda x: x[0], reverse=True)
        return "\n\n".join(content for _, content in scored[:max_items])
    except Exception:
        logger.exception("[RAG] get_relevant_context failed for query=%r", query)
        return _NO_CONTEXT


def check_chroma_status() -> Dict[str, Any]:
    """
    สถานะของระบบ RAG (เรียกจาก storage_service.get_service_status สำหรับ /api/health/status)
    ชื่อฟังก์ชันคงไว้แบบเดิมเพื่อความเข้ากันได้ แม้ปัจจุบันไม่ได้ใช้ ChromaDB จริงแล้ว
    """
    try:
        items = _get_knowledge()
        if items:
            return {
                "status": "ok",
                "backend": "keyword-index (no vector DB — optimized for low RAM)",
                "entries_loaded": len(items),
            }
        return {
            "status": "degraded",
            "backend": "keyword-index (no vector DB — optimized for low RAM)",
            "entries_loaded": 0,
            "error": _load_error or "no knowledge entries loaded",
        }
    except Exception as exc:
        logger.exception("[RAG] check_chroma_status failed")
        return {"status": "error", "backend": "keyword-index", "error": str(exc)}
