"""
AI Service – Google Gemini API Directly (Native Google Generative AI SDK)
Uses RAG (Retrieval-Augmented Generation) to ground answers in Thai RDI knowledge.
100% Free Plan.
"""

import base64
import json
import re
import asyncio
from typing import Optional
import logging

# เปลี่ยนมาใช้ Official SDK ของ Google แทน LangChain เพื่อความเสถียรสูงสุดบน Production
import google.generativeai as genai

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

# ตั้งค่า API Key ให้กับโมเดล Google Gemini โดยตรง
if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)
else:
    logger.error("Missing Gemini API key. Set GEMINI_API_KEY in environment.")


def _get_model(model_name: Optional[str] = None):
    if not model_name:
        model_name = "gemini-2.5-flash"
    return genai.GenerativeModel(model_name)


# ── System Prompts ──────────────────────────────────────────────────────────

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


# ── 1. Label Analysis (image → structured nutrition JSON) ────────────────────

async def analyze_label_image(image_base64: str, mime_type: str = "image/jpeg") -> dict:
    rag_context = (
        "เกณฑ์แนะนำต่อวันสำหรับคนไทยอายุ 6 ปีขึ้นไป (Thai RDI): "
        "พลังงาน 2000 kcal, คาร์โบไฮเดรต 300g, โปรตีน 50g, ไขมันทั้งหมด 65g, "
        "ไขมันอิ่มตัว 20g, โซเดียม 2000mg, น้ำตาลไม่ควรเกิน 24g"
    )
    system_prompt = ANALYSIS_SYSTEM_PROMPT.format(rag_context=rag_context)
    model = _get_model("gemini-2.5-flash")

    # แปลง Base64 เป็น Bytes สำหรับส่งให้ Google SDK ตรง ๆ
    image_bytes = base64.b64decode(image_base64)
    image_part = {"mime_type": mime_type, "data": image_bytes}

    prompt = (
        f"{system_prompt}\n\n"
        "กรุณาสแกนและอ่านข้อมูลฉลากโภชนาการทั้งหมดจากภาพนี้อย่างละเอียดยิบครบทุกสารอาหาร "
        "สรุปข้อมูลสารอาหารทั้งหมดพร้อมคำนวณคะแนนสุขภาพตามเกณฑ์อ้างอิงให้ถูกต้อง ตอบเป็นโครงสร้าง JSON เท่านั้น"
    )

    # เรียกใช้ผ่าน asyncio เพื่อไม่ให้บล็อกการทำงานหลัก
    response = await asyncio.to_thread(
        model.generate_content,
        contents=[prompt, image_part],
        generation_config={"temperature": 0.1}
    )

    text = response.text.strip()
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
    rag_context = (
        "เกณฑ์แนะนำต่อวันสำหรับคนไทยอายุ 6 ปีขึ้นไป (Thai RDI): "
        "พลังงาน 2000 kcal, คาร์โบไฮเดรต 300g, โปรตีน 50g, ไขมันทั้งหมด 65g, "
        "ไขมันอิ่มตัว 20g, โซเดียม 2000mg, น้ำตาลไม่ควรเกิน 24g"
    )
    system_prompt = ANALYSIS_SYSTEM_PROMPT.format(rag_context=rag_context)
    model = _get_model("gemini-2.5-flash")

    user_prompt = (
        f"{system_prompt}\n\n"
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

    response = await asyncio.to_thread(
        model.generate_content,
        contents=user_prompt,
        generation_config={"temperature": 0.1}
    )

    text = response.text.strip()
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

async def chat(user_message: str, chat_history: Optional[list[dict]] = None) -> str:
    try:
        rag_context = get_relevant_context(user_message, max_items=3)
    except Exception:
        rag_context = "ไม่มีข้อมูลอ้างอิง"
        
    system_prompt = CHAT_SYSTEM_PROMPT.replace("{rag_context}", rag_context)
    model = _get_model("gemini-2.5-flash")

    # แปลงประวัติการแชทให้เข้ากับโครงสร้างแบบประวัติเนื้อหาของ Google SDK
    contents = [{"role": "user", "parts": [system_prompt]}]

    if chat_history:
        for msg in chat_history[-6:]:
            role = "user" if msg.get("role") == "user" else "model"
            contents.append({"role": role, "parts": [msg["content"]]})

    contents.append({"role": "user", "parts": [user_message]})

    response = await asyncio.to_thread(
        model.generate_content,
        contents=contents,
        generation_config={"temperature": 0.4}
    )

    return response.text


# ── 4. Meal Analysis (Food Image + User Text → Estimated Calories JSON) ──────

async def analyze_food_meal(image_base64: str, user_menu_text: str, mime_type: str = "image/jpeg") -> dict:
    model = _get_model("gemini-2.5-flash")

    image_bytes = base64.b64decode(image_base64)
    image_part = {"mime_type": mime_type, "data": image_bytes}

    prompt = (
        f"{FOOD_MEAL_SYSTEM_PROMPT}\n\n"
        f"นี่คือภาพถ่ายมื้ออาหารของฉัน และเมนูนี้คือ: \"{user_menu_text}\"\n"
        f"กรุณาวิเคราะห์ภาพร่วมกับชื่อเมนูนี้ เพื่อประมาณการแคลอรี่และสารอาหารหลักให้ฉันในรูปแบบ JSON ตามกฎด้วยครับ"
    )

    response = await asyncio.to_thread(
        model.generate_content,
        contents=[prompt, image_part],
        generation_config={"temperature": 0.3}
    )

    text = response.text.strip()
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