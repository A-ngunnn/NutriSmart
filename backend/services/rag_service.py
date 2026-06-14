"""
Knowledge Service – loads Thai RDI knowledge base from JSON files
and provides context for AI prompts.

Uses ChromaDB for Vector Search (Retrieval-Augmented Generation).
"""

import json
import logging
import uuid
from pathlib import Path
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.utils import embedding_functions

from config import get_settings

settings = get_settings()

logger = logging.getLogger("nutrismart.rag_service")
logging.basicConfig(level=logging.INFO)

# ── ChromaDB Configuration ───────────────────────────────────────────────────
_chroma_client: Optional[chromadb.PersistentClient] = None
_collection = None

# We use the open-source sentence-transformers model locally for embeddings.
_embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)


def _init_chroma():
    """Initialize ChromaDB persistent client and get/create collection."""
    global _chroma_client, _collection
    if _chroma_client is not None:
        return

    persist_dir = Path(settings.chroma_persist_dir)
    persist_dir.mkdir(parents=True, exist_ok=True)

    try:
        _chroma_client = chromadb.PersistentClient(path=str(persist_dir))
        _collection = _chroma_client.get_or_create_collection(
            name=settings.chroma_collection_name,
            embedding_function=_embedding_function,
        )
        logger.info("ChromaDB initialized successfully.")
    except Exception as exc:
        logger.error(f"Failed to initialize ChromaDB: {exc}")
        _chroma_client = None


def load_knowledge() -> int:
    """Load knowledge base from JSON files into ChromaDB at startup."""
    _init_chroma()
    if not _collection:
        logger.error("ChromaDB collection is not available.")
        return 0

    knowledge_path = Path(settings.knowledge_dir)
    all_items: list[dict] = []

    if not knowledge_path.exists():
        logger.warning("Knowledge path not found: %s", knowledge_path)
        return 0

    json_files = [knowledge_path] if knowledge_path.is_file() else list(knowledge_path.glob("*.json"))

    for json_file in json_files:
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                items = json.load(f)
                if isinstance(items, list):
                    all_items.extend(items)
        except Exception as exc:
            logger.error("Failed to load knowledge file %s: %s", json_file, exc)

    if not all_items:
        return 0

    documents = []
    metadatas = []
    ids = []

    for idx, item in enumerate(all_items):
        topic = item.get("topic", "")
        content = item.get("content", "")
        text = f"{topic}\n{content}"
        documents.append(text)
        metadatas.append({"topic": topic})
        ids.append(str(uuid.uuid5(uuid.NAMESPACE_DNS, text)))

    try:
        # Add to ChromaDB. It handles duplicates implicitly if IDs match.
        _collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        count = _collection.count()
        print(f"[KNOWLEDGE] Loaded {count} knowledge items into ChromaDB.")
        return count
    except Exception as exc:
        logger.error(f"Failed to add documents to ChromaDB: {exc}")
        return 0


def get_all_context() -> str:
    """Return ALL knowledge items (only recommended for very small sets)."""
    _init_chroma()
    if not _collection:
        return "ไม่มีข้อมูลอ้างอิง"

    try:
        results = _collection.get()
        documents = results.get("documents", [])
        if not documents:
            return "ไม่มีข้อมูลอ้างอิง"
        
        parts = [f"- {doc}" for doc in documents]
        return "\n\n".join(parts)
    except Exception as exc:
        logger.error(f"Failed to get all context: {exc}")
        return "ไม่มีข้อมูลอ้างอิง"


def get_relevant_context(query: str, max_items: int = 10) -> str:
    """Retrieve relevant knowledge items using Semantic Vector Search."""
    _init_chroma()
    if not _collection:
        return "ไม่มีข้อมูลอ้างอิง"

    try:
        results = _collection.query(
            query_texts=[query],
            n_results=max_items
        )
        
        documents = results.get("documents", [[]])[0]
        if not documents:
            return "ไม่มีข้อมูลอ้างอิง"
        
        parts = [f"- {doc}" for doc in documents]
        return "\n\n".join(parts)
    except Exception as exc:
        logger.error(f"ChromaDB Query Error: {exc}")
        return "ไม่มีข้อมูลอ้างอิง"


def check_chroma_status() -> dict:
    """Check if ChromaDB is healthy and loaded."""
    _init_chroma()
    status = {"status": "error", "message": "Not initialized"}
    
    if _chroma_client and _collection:
        try:
            count = _collection.count()
            status["status"] = "ok"
            status["documents_loaded"] = count
            status["message"] = f"Collection {settings.chroma_collection_name} is active"
        except Exception as exc:
            status["message"] = str(exc)
            
    return status