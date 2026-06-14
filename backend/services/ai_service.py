"""
AI Service – OpenRouter API (Free Tier)
Uses RAG (Retrieval-Augmented Generation) to ground answers in Thai RDI knowledge.
Routes all AI requests through OpenRouter's free models.
"""

import base64
import json
import re
import asyncio
from typing import Optional
import logging

import httpx

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

import httpx
from fastapi import HTTPException

# ── OpenRouter Configuration ────────────────────────────────────────────────
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "google/gemini-2.5-flash:free"

def _get_headers():
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nutrismart.app",
        "X-Title": "NutriSmart AI",
    }


# ── Helper: call OpenRouter ─────────────────────────────────────────────────

async def _call_openrouter(messages: list[dict], temperature: float = 0.3) -> str:
    """Send a chat completion request to OpenRouter and return the text response."""
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": messages,
        "temperature": temperature,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                OPENROUTER_BASE_URL,
                headers=_get_headers(),
                json=payload,
            )
            
            if response.status_code != 200:
                error_detail = response.text[:500]
                logger.error(f"OpenRouter API error {response.status_code}: {error_detail}")
                raise HTTPException(
                    status_code=502, 
                    detail=f"OpenRouter API Error: ได้รับ Status Code {response.status_code} จากระบบ AI"
                )
                
            data = response.json()
            # Extract reply text from OpenAI-compatible response
            try:
                return data["choices"][0]["message"]["content"]
            except (KeyError, IndexError) as e:
                logger.error(f"Unexpected OpenRouter response structure: {data}")
                raise HTTPException(status_code=502, detail="OpenRouter API Error: โครงสร้างข้อมูลที่ตอบกลับมาไม่ถูกต้อง")
                
    except httpx.RequestError as exc:
        logger.error(f"HTTP Request failed when calling OpenRouter: {exc}")
        raise HTTPException(status_code=502, detail="OpenRouter API Error: ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ AI ได้")


def _parse_json_response(text: str) -> dict:
    """Parse a JSON response from the AI, stripping markdown fences if present."""
    text = text.strip().replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        logger.error(f"AI did not return valid JSON: {text[:300]}")
        raise HTTPException(status_code=502, detail="AI response was not a valid JSON")


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
Respond strictly in JSON format. Do not include markdown formatting like ```json or any conversational text.
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
}}"""

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
6. ใช้ Emoji ตกแต่งหัวข้อเพื่อให้อ่านและทำความเข้าใจได้ง่ายขึ้น"""

FOOD_MEAL_SYSTEM_PROMPT = """คุณคือ NutriSmart AI — ผู้เชี่ยวชาญด้านการประเมินแคลอรี่และโภชนาการอาหารไทย
หน้าที่ของคุณคือวิเคราะห์ภาพถ่ายเมนูอาหาร ร่วมกับข้อความอธิบายที่ผู้ใช้พิมพ์บอก เพื่อประมาณการพลังงาน (Calories) และสารอาหารหลักอย่างใกล้เคียงความจริงที่สุด

คุณต้อง:
1. วิเคราะห์จาก "ภาพถ่ายอาหาร" เพื่อดูขนาดจาน ปริมาณ และสัดส่วน
2. อ่าน "ข้อความเมนูที่ผู้ใช้พิมพ์บอก" เพื่อระบุวัตถุดิบและวิธีการปรุง (เช่น ผัดข้าวน้อย, ไม่ใส่น้ำมัน, เพิ่มไข่ดาว)
3. ประมาณการพลังงาน (Calories) เป็นกิโลแคลอรี และสารอาหาร โปรตีน, คาร์บ, ไขมัน เป็นกรัม

── คำตอบต้องเป็น JSON เท่านั้น ──
Respond strictly in JSON format. Do not include markdown formatting like ```json or any conversational text.
ตอบกลับเป็นโครงสร้าง JSON ตามรูปแบบนี้เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON:
{{
  "mealName": "ชื่อเมนูอาหารที่ระบุหรือตรวจพบ",
  "estimatedCalories": 0,
  "protein": 0,
  "carbs": 0,
  "totalFat": 0,
  "confidence": "high|medium|low",
  "breakdown": [
    "ส่วนผสมที่ 1 (เช่น ข้ามสวย 2 ทัพพี) ~ 160 kcal",
    "ส่วนผสมที่ 2 (เช่น เนื้ออกไก่ผัดกะเพรา) ~ 200 kcal"
  ],
  "healthAdvice": "คำแนะนำทางโภชนาการสำหรับมื้อนี้ เช่น มีโปรตีนสูงแต่ควรระวังโซเดียมจากน้ำปลาพริก"
}}"""


# ── 1. Label Analysis (image → structured nutrition JSON) ────────────────────

async def analyze_label_image(image_base64: str, mime_type: str = "image/jpeg") -> dict:
    rag_context = (
        "เกณฑ์แนะนำต่อวันสำหรับคนไทยอายุ 6 ปีขึ้นไป (Thai RDI): "
        "พลังงาน 2000 kcal, คาร์โบไฮเดรต 300g, โปรตีน 50g, ไขมันทั้งหมด 65g, "
        "ไขมันอิ่มตัว 20g, โซเดียม 2000mg, น้ำตาลไม่ควรเกิน 24g"
    )
    system_prompt = ANALYSIS_SYSTEM_PROMPT.format(rag_context=rag_context)

    # สร้าง data URL สำหรับ OpenRouter Vision API (OpenAI-compatible format)
    image_data_url = f"data:{mime_type};base64,{image_base64}"

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "กรุณาสแกนและอ่านข้อมูลฉลากโภชนาการทั้งหมดจากภาพนี้อย่างละเอียดยิบครบทุกสารอาหาร "
                        "สรุปข้อมูลสารอาหารทั้งหมดพร้อมคำนวณคะแนนสุขภาพตามเกณฑ์อ้างอิงให้ถูกต้อง ตอบเป็นโครงสร้าง JSON เท่านั้น"
                    ),
                },
                {
                    "type": "image_url",
                    "image_url": {"url": image_data_url},
                },
            ],
        },
    ]

    text = await _call_openrouter(messages, temperature=0.1)
    return _parse_json_response(text)


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

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    text = await _call_openrouter(messages, temperature=0.1)
    return _parse_json_response(text)


# ── 3. NutriChat (RAG-enhanced conversation) ─────────────────────────────────

async def chat(user_message: str, chat_history: Optional[list[dict]] = None) -> str:
    try:
        rag_context = get_relevant_context(user_message, max_items=3)
    except Exception:
        rag_context = "ไม่มีข้อมูลอ้างอิง"

    system_prompt = CHAT_SYSTEM_PROMPT.replace("{rag_context}", rag_context)

    messages = [{"role": "system", "content": system_prompt}]

    if chat_history:
        for msg in chat_history[-6:]:
            role = "user" if msg.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    return await _call_openrouter(messages, temperature=0.4)


# ── 4. Meal Analysis (Food Image + User Text → Estimated Calories JSON) ──────

async def analyze_food_meal(image_base64: str, user_menu_text: str, mime_type: str = "image/jpeg") -> dict:
    image_data_url = f"data:{mime_type};base64,{image_base64}"

    messages = [
        {"role": "system", "content": FOOD_MEAL_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        f"นี่คือภาพถ่ายมื้ออาหารของฉัน และเมนูนี้คือ: \"{user_menu_text}\"\n"
                        f"กรุณาวิเคราะห์ภาพร่วมกับชื่อเมนูนี้ เพื่อประมาณการแคลอรี่และสารอาหารหลักให้ฉันในรูปแบบ JSON ตามกฎด้วยครับ"
                    ),
                },
                {
                    "type": "image_url",
                    "image_url": {"url": image_data_url},
                },
            ],
        },
    ]

    text = await _call_openrouter(messages, temperature=0.3)
    return _parse_json_response(text)


# ── 5. Estimate Food Nutrition (Text only) ───────────────────────────────────

ESTIMATE_SYSTEM_PROMPT = """คุณคือ NutriSmart AI — ผู้เชี่ยวชาญด้านการประเมินแคลอรี่และโภชนาการอาหารไทย
หน้าที่ของคุณคือประมาณการพลังงาน (Calories) และสารอาหารหลัก (โปรตีน, คาร์บ, ไขมัน) ของอาหารตามชื่อที่ผู้ใช้พิมพ์มา

── คำตอบต้องเป็น JSON เท่านั้น ──
Respond strictly in JSON format. Do not include markdown formatting like ```json or any conversational text.
ตอบกลับเป็นโครงสร้าง JSON ตามรูปแบบนี้เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON:
{
  "foodName": "ชื่ออาหาร",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0
}"""

async def estimate_food_nutrition(food_name: str) -> dict:
    messages = [
        {"role": "system", "content": ESTIMATE_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"กรุณาประมาณค่าโภชนาการสำหรับอาหาร 1 จาน/หน่วยบริโภค: \"{food_name}\"\nตอบเป็น JSON โครงสร้างตามที่กำหนดเท่านั้น",
        },
    ]

    text = await _call_openrouter(messages, temperature=0.3)
    return _parse_json_response(text)