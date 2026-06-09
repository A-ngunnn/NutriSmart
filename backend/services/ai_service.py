"""
AI Service – Google Gemini API Directly (LangChain ChatGoogleGenerationAI)
Uses RAG (Retrieval-Augmented Generation) to ground answers in Thai RDI knowledge.
100% Free Plan.
"""

import base64
import json
import re
import asyncio
from typing import Optional

# เปลี่ยนมาใช้ Module ของ Google Gemini โดยตรงแทน OpenRouter
from langchain_google_genai import ChatGoogleGenerationAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage
import logging

from config import get_settings

try:
    from services.rag_service import get_all_context, get_relevant_context
except ImportError:
    def get_all_context():
        return "ไม่มีข้อมูลอ้างอิง"
    def get_relevant_context(query, max_items=2):
        return "ไม่มีข้อมูลอ้างอิง"

settings = get_settings()

logger = logging.getLogger("nutrismart.ai_service")
logging.basicConfig(level=logging.INFO)


# ── Shared LLM instance (Direct connection to Google Gemini API) ─────────────
def _get_llm(model_name: Optional[str] = None, temperature: float = 0.3):
    # ดึงคีย์จากตัวแปรระบบที่เราเตรียมไว้
    api_key = settings.gemini_api_key or ""
    if not api_key:
        logger.error("Missing Gemini API key. Set GEMINI_API_KEY in environment.")
        raise ValueError("Missing Gemini API key. Set GEMINI_API_KEY in environment.")

    # ตั้งค่ามาตรฐานเป็นโมเดลยอดนิยมที่ฉลาดและฟรี
    if not model_name:
        model_name = "gemini-2.5-flash"
        
    return ChatGoogleGenerationAI(
        model=model_name,
        temperature=temperature,
        max_tokens=4096,
        google_api_key=api_key,
    )


# ── 1. Label Analysis (image → structured nutrition JSON) ────────────────────

ANALYSIS_SYSTEM_PROMPT = """คุณคือ NutriSmart AI — ผู้เชี่ยวชาญด้านโภชนาการอาหารของประเทศไทย
หน้าที่ของคุณคือวิเคราะห์ภาพฉลากโภชนาการ (Nutrition Facts) ของสินค้าอาหารหรือเครื่องดื่มอย่างละเอียดครบถ้วนทุกสารอาหาร

คุณต้อง:
1. อ่านข้อมูลทั้งหมดจากภาพฉลากโภชนาการ (OCR) ให้ครบถ้วน ห้ามข้ามรายละเอียดใดๆ ทั้งแคลอรี โปรตีน คาร์โบไฮเดรต ไขมัน น้ำตาล โซเดียม และสารอาหารเสริม
2. ประเมินและให้คะแนนสุขภาพ (Health Score) 0-100 โดยอิงตามเกณฑ์ Thai RDI อย่างเที่ยงตรง

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
ตอบเป็น JSON ตามรูปแบบนี้เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจากโครงสร้าง JSON:
{{
  "productName": "ชื่อสินค้า (ภาษาไทย)",
  "servingSize": "ขนาดหนึ่งหน่วยบริโภคที่ระบุบนฉลาก",
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
  "warnings": ["คำเตือนสารอาหารตัวที่สูงเกินไปอย่างละเอียด 1", "คำเตือนเพิ่มเติม 2"],
  "advice": "คำแนะนำและบทวิเคราะห์สารอาหารบนฉลากนี้อย่างละเอียด ครบถ้วน เพื่อสุขภาพของผู้บริโภค"
}}
"""


async def analyze_label_image(image_base64: str, mime_type: str = "image/jpeg") -> dict:
    """
    Analyze a nutrition label image and return structured data + health score.
    """
    rag_context = (
        "เกณฑ์แนะนำต่อวันสำหรับคนไทยอายุ 6 ปีขึ้นไป (Thai RDI): "
        "พลังงาน 2000 kcal, คาร์โบไฮเดรต 300g, โปรตีน 50g, ไขมันทั้งหมด 65g, "
        "ไขมันอิ่มตัว 20g, โซเดียม 2000mg, น้ำตาลไม่ควรเกิน 24g"
    )
    system_prompt = ANALYSIS_SYSTEM_PROMPT.format(rag_context=rag_context)

    # ปรับเป็นโมเดล Gemini ตาไว อ่านรูปภาพแม่นยำ
    vision_model = "gemini-2.5-flash" 
    llm = _get_llm(model_name=vision_model, temperature=0.1)

    content = [
        {
            "type": "text",
            "text": "กรุณาสแกนและอ่านข้อมูลฉลากโภชนาการทั้งหมดจากภาพนี้อย่างละเอียดยิบครบทุกสารอาหาร สรุปข้อมูลสารอาหารทั้งหมดพร้อมคำนวณคะแนนสุขภาพตามเกณฑ์อ้างอิงให้ถูกต้อง"
        },
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime_type};base64,{image_base64}"
            }
        }
    ]
    
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=content)]

    try:
        result = await asyncio.to_thread(llm.generate, [messages])
    except Exception as exc:
        err_text = str(exc)
        logger.warning("Vision Model LLM generate failed: %s, trying fallback...", err_text)
        fallback = "gemini-2.5-flash"
        llm = _get_llm(model_name=fallback, temperature=0.1)
        result = await asyncio.to_thread(llm.generate, [messages])

    text = result.generations[0][0].text.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
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
    rag_context = (
        "เกณฑ์แนะนำต่อวันสำหรับคนไทยอายุ 6 ปีขึ้นไป (Thai RDI): "
        "พลังงาน 2000 kcal, คาร์โบไฮเดรต 300g, โปรตีน 50g, ไขมันทั้งหมด 65g, "
        "ไขมันอิ่มตัว 20g, โซเดียม 2000mg, น้ำตาลไม่ควรเกิน 24g"
    )
    system_prompt = ANALYSIS_SYSTEM_PROMPT.format(rag_context=rag_context)

    user_prompt = (
        f"กรุณาวิเคราะห์ข้อมูลโภชนาการที่กรอกมาด้วยมือ:\n"
        f"- ชื่อสินค้า: {product_name}\n"
        f"- พลังงาน: {calories} kcal\n"
        f"- โปรตีน: {protein} g\n"
        f"- คาร์โบไฮเดรต: {carbs} g\n"
        f"- ไขมันทั้งหมด: {total_fat} g\n"
        f"- น้ำตาล: {sugar} g\n"
        f"- โซเดียม: {sodium} mg\n\n"
        f"กรุณาให้คะแนนสุขภาพและคำแนะนำแบบวิเคราะห์ละเอียด ตอบเป็น JSON เท่านั้น"
    )

    llm = _get_llm(temperature=0.1)
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    try:
        result = await asyncio.to_thread(llm.generate, [messages])
    except Exception as exc:
        logger.warning("Manual input analysis failed: %s, falling back...", str(exc))
        llm = _get_llm(model_name="gemini-2.5-flash", temperature=0.1)
        result = await asyncio.to_thread(llm.generate, [messages])

    text = result.generations[0][0].text.strip()
    text = text.replace("```json", "").replace("```", "").strip()

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

CHAT_SYSTEM_PROMPT = """คุณคือ NutriSmart AI — ผู้ช่วยด้านโภชนาการและการแพทย์ส่วนตัว
คุณสามารถตอบคำถามเกี่ยวกับโภชนาการ อาหาร สุขภาพ แคลอรี่ และแนะนำการกินอาหารที่ถูกต้องตามหลักการแพทย์อ้างอิง

── ข้อมูลอ้างอิงจากฐานความรู้ ──
{rag_context}

── กฎการให้บริการตอบแชต ──
1. ตอบเป็นภาษาไทยเสมอด้วยน้ำเสียงที่เป็นมิตรและเป็นมืออาชีพ
2. นำข้อมูลจากฐานความรู้อ้างอิงด้านบนมาปรับใช้ตอบให้สอดคล้องกันอย่างดีที่สุด
3. หากคำถามอยู่นอกเหนือการแพทย์และโภชนาการ ให้แจ้งว่า "ข้อมูลนี้อยู่นอกเหนือขอบเขตด้านสุขภาพของผม"
4. ให้เน้นคำแนะนำที่ปรับใช้ได้จริงในชีวิตประจำวัน ปลอดภัย และอิงตามโภชนาการสากล
5. ตอบอย่างเป็นระบบ มีรายละเอียดสนับสนุนชัดเจน แต่กระชับเข้าใจง่าย
6. ใช้ Emoji ตกแต่งหัวข้อเพื่อให้อ่านและทำความเข้าใจได้ง่ายขึ้น
"""


async def chat(user_message: str, chat_history: Optional[list[dict]] = None) -> str:
    """RAG-enhanced chat with NutriSmart AI using Gemini for Medical & Nutrition expertise."""
    try:
        rag_context = get_relevant_context(user_message, max_items=3)
    except Exception:
        rag_context = "ไม่มีข้อมูลอ้างอิง"
        
    system_prompt = CHAT_SYSTEM_PROMPT.replace("{rag_context}", rag_context)

    messages = [SystemMessage(content=system_prompt)]

    if chat_history:
        for msg in chat_history[-6:]:
            if msg.get("role") == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg.get("role") == "assistant":
                messages.append(AIMessage(content=msg["content"]))

    messages.append(HumanMessage(content=user_message))

    # ปรับแชทบอทให้เรียกสมองกลภาษาไทยของ Gemini 2.5 Flash
    gemini_model = "gemini-2.5-flash"
    try:
        llm = _get_llm(model_name=gemini_model, temperature=0.4)
        result = await asyncio.to_thread(llm.generate, [messages])
    except Exception as exc:
        err_text = str(exc)
        logger.warning("Gemini Chat failed: %s, falling back...", err_text)
        fallback = "gemini-2.5-flash"
        llm = _get_llm(model_name=fallback, temperature=0.5)
        result = await asyncio.to_thread(llm.generate, [messages])

    return result.generations[0][0].text


# ── 4. Meal Analysis (Food Image + User Text → Estimated Calories JSON) ──────

FOOD_MEAL_SYSTEM_PROMPT = """คุณคือ NutriSmart AI — ผู้เชี่ยวชาญด้านการประเมินแคลอรี่และโภชนาการอาหารไทย
หน้าที่ของคุณคือวิเคราะห์ภาพถ่ายเมนูอาหาร ร่วมกับข้อความอธิบายที่ผู้ใช้พิมพ์บอก เพื่อประมาณการพลังงาน (Calories) และสารอาหารหลักอย่างใกล้เคียงความจริงที่สุด

คุณต้อง:
1. วิเคราะห์จาก "ภาพถ่ายอาหาร" เพื่อดูขนาดจาน ปริมาณ และสัดส่วน
2. อ่าน "ข้อความเมนูที่ผู้ใช้พิมพ์บอก" เพื่อระบุวัตถุดิบและวิธีการปรุง (เช่น ผัดข้าวน้อย, ไม่ใส่น้ำมัน, เพิ่มไข่ดาว)
3. ประมาณการพลังงาน (Calories) เป็นกิโลแคลอรี และสารอาหาร โปรตีน, คาร์บ, ไขมัน เป็นกรัม

── คำตอบต้องเป็น JSON เท่านั้น ──
ตอบกลับเป็นโครงสร้าง JSON ตามรูปแบบนี้เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON:
{{
  "mealName": "ชื่อเมนูอาหารที่ระบุหรือตรวจพบ",
  "estimatedCalories": 0,
  "protein": 0,
  "carbs": 0,
  "totalFat": 0,
  "confidence": "high|medium|low",
  "breakdown": [
    "ส่วนผสมที่ 1 (เช่น ข้าวสวย 2 ทัพพี) ~ 160 kcal",
    "ส่วนผสมที่ 2 (เช่น เนื้ออกไก่ผัดกะเพรา) ~ 200 kcal"
  ],
  "healthAdvice": "คำแนะนำทางโภชนาการสำหรับมื้อนี้ เช่น มีโปรตีนสูงแต่ควรระวังโซเดียมจากน้ำปลาพริก"
}}
"""


async def analyze_food_meal(image_base64: str, user_menu_text: str, mime_type: str = "image/jpeg") -> dict:
    """
    วิเคราะห์รูปภาพอาหารร่วมกับชื่อเมนูที่ผู้ใช้พิมพ์บอก เพื่อประมาณแคลอรี่และสารอาหาร
    """
    vision_model = "gemini-2.5-flash"
    llm = _get_llm(model_name=vision_model, temperature=0.3)

    content = [
        {
            "type": "text",
            "text": f"นี่คือภาพถ่ายมื้ออาหารของฉัน และเมนูนี้คือ: \"{user_menu_text}\"\nกรุณาวิเคราะห์ภาพร่วมกับชื่อเมนูนี้ เพื่อประมาณการแคลอรี่และสารอาหารหลักให้ฉันด้วยครับ"
        },
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime_type};base64,{image_base64}"
            }
        }
    ]
    
    messages = [
        SystemMessage(content=FOOD_MEAL_SYSTEM_PROMPT),
        HumanMessage(content=content)
    ]

    try:
        result = await asyncio.to_thread(llm.generate, [messages])
    except Exception as exc:
        logger.warning("Food Vision Model failed, trying fallback...")
        fallback = "gemini-2.5-flash"
        llm = _get_llm(model_name=fallback, temperature=0.3)
        result = await asyncio.to_thread(llm.generate, [messages])

    text = result.generations[0][0].text.strip()
    text = text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            result = json.loads(json_match.group())
        else:
            raise ValueError(f"AI did not return valid JSON for food analysis: {text[:300]}")

    return result