"""
AI Service – MedGemma via OpenRouter (LangChain ChatOpenAI)
Uses RAG (Retrieval-Augmented Generation) to ground answers in Thai RDI knowledge.
"""

import base64
import json
import re
import asyncio
from typing import Optional

from langchain_community.chat_models import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
import logging

from config import get_settings
from services.rag_service import get_all_context, get_relevant_context

settings = get_settings()

logger = logging.getLogger("nutrismart.ai_service")
logging.basicConfig(level=logging.INFO)


# ── Shared LLM instance (ChatOpenAI pointing to OpenRouter) ──────────────────
def _get_llm(temperature: float = 0.3):
    api_key = settings.medgemma_api_key or settings.gemini_api_key or ""
    if not api_key:
        logger.error("Missing LLM API key. Set MEDGEMMA_API_KEY or GEMINI_API_KEY in environment.")
        raise ValueError("Missing LLM API key. Set MEDGEMMA_API_KEY or GEMINI_API_KEY in environment.")

    # ChatOpenAI accepts openai_api_base/openai_api_key to point at OpenRouter
    model = getattr(settings, "medgemma_model", "google/gemma-2-9b-it")
    return ChatOpenAI(
        model_name=model,
        temperature=temperature,
        max_tokens=4096,
        openai_api_key=api_key,
        openai_api_base="https://openrouter.ai/api/v1",
    )


# ── 1. Label Analysis (image → structured nutrition JSON) ────────────────────

ANALYSIS_SYSTEM_PROMPT = """คุณคือ NutriSmart AI — ผู้เชี่ยวชาญด้านโภชนาการอาหารของประเทศไทย
หน้าที่ของคุณคือวิเคราะห์ภาพฉลากโภชนาการ (Nutrition Facts) ของสินค้าอาหารหรือเครื่องดื่ม

คุณต้อง:
1. อ่านข้อมูลจากภาพฉลากโภชนาการ (OCR) ให้ครบถ้วน
2. ประเมินและให้คะแนนสุขภาพ (Health Score) 0-100 โดยอิงตามเกณฑ์ Thai RDI

── เกณฑ์ Thai RDI อ้างอิง ──
{rag_context}

── กฎการให้คะแนน Health Score ──
- คะแนนเริ่มต้น = 100
- หักคะแนนตามระดับความเสี่ยงของแต่ละสารอาหาร:
  • น้ำตาล > 12g/หน่วยบริโภค → หัก 20 คะแนน, > 6g → หัก 10
  • โซเดียม > 600mg/หน่วยบริโภค → หัก 25 คะแนน, > 300mg → หัก 12
  • ไขมัน > 20g/หน่วยบริโภค → หัก 15 คะแนน, > 13g → หัก 8
  • แคลอรี > 300kcal/หน่วยบริโภค → หัก 10 คะแนน
  • โปรตีน > 10g → เพิ่ม 5 คะแนน (ดี)
- คะแนนต่ำสุด = 0, สูงสุด = 100

── กฎการประเมินสถานะ ──
- score >= 70 → "safe" (ปลอดภัย ✅)
- score >= 40 → "moderate" (ระวัง ⚠️)  
- score < 40  → "danger" (อันตราย 🔴)

── คำตอบต้องเป็น JSON เท่านั้น ──
ตอบเป็น JSON ตามรูปแบบนี้เท่านั้น ห้ามมีข้อความอื่น:
{
  "productName": "ชื่อสินค้า (ภาษาไทย ถ้ามี)",
  "servingSize": "ขนาดหนึ่งหน่วยบริโภค",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "totalFat": 0,
  "saturatedFat": 0,
  "transFat": 0,
  "sugar": 0,
  "sodium": 0,
  "fiber": 0,
  "score": 0,
  "status": "safe|moderate|danger",
  "warnings": ["คำเตือน 1", "คำเตือน 2"],
  "advice": "คำแนะนำสั้นๆ 1-2 ประโยคเกี่ยวกับสินค้านี้"
}
"""


async def analyze_label_image(image_base64: str, mime_type: str = "image/jpeg") -> dict:
    """
    Analyze a nutrition label image and return structured data + health score.
    """
    # Retrieve RAG context for nutrition-related queries
    rag_context = get_all_context()

    system_prompt = ANALYSIS_SYSTEM_PROMPT.replace("{rag_context}", rag_context)

    llm = _get_llm(temperature=0.1)

    message_text = (
        "กรุณาวิเคราะห์ฉลากโภชนาการจากภาพนี้\n"
        "ให้สรุปข้อมูลโภชนาการจากภาพพร้อมให้คะแนนสุขภาพตามเกณฑ์ Thai RDI\n"
        f"data:{mime_type};base64,{image_base64}"
    )
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=message_text)]

    # Use sync ChatOpenAI via thread to avoid blocking event loop if not async
    try:
        result = await asyncio.to_thread(llm.generate, [messages])
    except Exception as exc:
        err_text = str(exc)
        logger.warning("LLM generate failed: %s", err_text)
        # Retry with fallback model if OpenRouter reports no endpoints for the requested model
        if "No endpoints found" in err_text or "No endpoints" in err_text or "404" in err_text:
            fallback = getattr(settings, "medgemma_fallback_model", "gpt-4o-mini")
            logger.info("Falling back to model: %s", fallback)
            llm = ChatOpenAI(
                model_name=fallback,
                temperature=0.1,
                max_tokens=4096,
                openai_api_key=settings.medgemma_api_key or settings.gemini_api_key,
                openai_api_base="https://openrouter.ai/api/v1",
            )
            result = await asyncio.to_thread(llm.generate, [messages])
        else:
            raise

    text = result.generations[0][0].text.strip()
    # Remove markdown code block markers if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract JSON from the text
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            result = json.loads(json_match.group())
        else:
            raise ValueError(f"AI did not return valid JSON: {text[:300]}")

    return result


# ── 2. Text-only Analysis (manual input) ─────────────────────────────────────

async def analyze_manual_input(
    product_name: str,
    calories: float,
    protein: float,
    carbs: float,
    total_fat: float,
    sugar: float,
    sodium: float,
) -> dict:
    """Analyze manually-entered nutrition data."""
    rag_context = get_all_context()

    system_prompt = ANALYSIS_SYSTEM_PROMPT.replace("{rag_context}", rag_context)

    user_prompt = f"""กรุณาวิเคราะห์ข้อมูลโภชนาการที่กรอกมาด้วยมือ:
- ชื่อสินค้า: {product_name}
- พลังงาน: {calories} kcal
- โปรตีน: {protein} g
- คาร์โบไฮเดรต: {carbs} g
- ไขมันทั้งหมด: {total_fat} g
- น้ำตาล: {sugar} g
- โซเดียม: {sodium} mg

กรุณาให้คะแนนสุขภาพและคำแนะนำ ตอบเป็น JSON เท่านั้น"""

    llm = _get_llm(temperature=0.1)
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    try:
        result = await asyncio.to_thread(llm.generate, [messages])
    except Exception as exc:
        err_text = str(exc)
        if "No endpoints found" in err_text or "No endpoints" in err_text or "404" in err_text:
            fallback = getattr(settings, "medgemma_fallback_model", "gpt-4o-mini")
            llm = ChatOpenAI(
                model_name=fallback,
                temperature=0.1,
                max_tokens=4096,
                openai_api_key=settings.medgemma_api_key or settings.gemini_api_key,
                openai_api_base="https://openrouter.ai/api/v1",
            )
            result = await asyncio.to_thread(llm.generate, [messages])
        else:
            raise
    text = result.generations[0][0].text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            result = json.loads(json_match.group())
        else:
            raise ValueError(f"AI did not return valid JSON: {text[:300]}")

    return result


# ── 3. NutriChat (RAG-enhanced conversation) ─────────────────────────────────

CHAT_SYSTEM_PROMPT = """คุณคือ NutriSmart AI — ผู้ช่วยด้านโภชนาการส่วนตัว
คุณสามารถตอบคำถามเกี่ยวกับโภชนาการ อาหาร สุขภาพ แคลอรี่ และคำแนะนำในการกินอาหารเพื่อสุขภาพ

── ข้อมูลอ้างอิงจากฐานความรู้ ──
{rag_context}

── กฎ ──
1. ตอบเป็นภาษาไทยเสมอ
2. ใช้ข้อมูลจากฐานความรู้ด้านบนในการอ้างอิง
3. หากไม่แน่ใจ ให้บอกตรงๆ ว่า "ข้อมูลนี้อยู่นอกเหนือขอบเขตของผม"
4. ห้ามให้คำแนะนำทางการแพทย์โดยตรง ให้แนะนำให้ปรึกษาแพทย์เสมอ
5. ตอบสั้นกระชับ ไม่เกิน 3-4 ประโยค ยกเว้นผู้ใช้ขอรายละเอียด
6. ใช้ Emoji เพื่อให้อ่านง่ายขึ้น
"""


async def chat(user_message: str, chat_history: Optional[list[dict]] = None) -> str:
    """RAG-enhanced chat with NutriSmart AI."""
    # Retrieve relevant context
    rag_context = get_relevant_context(user_message, max_items=6)
    system_prompt = CHAT_SYSTEM_PROMPT.replace("{rag_context}", rag_context)

    messages = [SystemMessage(content=system_prompt)]

    # Add chat history if provided
    if chat_history:
        for msg in chat_history[-6:]:  # Keep last 6 messages for context
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg.get("role") == "assistant":
                messages.append(AIMessage(content=msg["content"]))

    messages.append(HumanMessage(content=user_message))

    try:
        llm = _get_llm(temperature=0.5)
        result = await asyncio.to_thread(llm.generate, [messages])
    except Exception as exc:
        err_text = str(exc)
        if "No endpoints found" in err_text or "No endpoints" in err_text or "404" in err_text:
            fallback = getattr(settings, "medgemma_fallback_model", "gpt-4o-mini")
            llm = ChatOpenAI(
                model_name=fallback,
                temperature=0.5,
                max_tokens=4096,
                openai_api_key=settings.medgemma_api_key or settings.gemini_api_key,
                openai_api_base="https://openrouter.ai/api/v1",
            )
            result = await asyncio.to_thread(llm.generate, [messages])
        else:
            raise

    return result.generations[0][0].text
