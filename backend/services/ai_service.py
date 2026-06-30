"""
AI Service – OpenRouter API (Free Tier)
Uses RAG (Retrieval-Augmented Generation) to ground answers in Thai RDI knowledge.
Routes all AI requests through OpenRouter's free models.
"""

import base64
import json
import re
import asyncio
from typing import Optional, Dict, Any
import logging

import httpx
from fastapi import HTTPException

from config import get_settings

try:
    from services.rag_service import get_all_context, get_relevant_context
except ImportError:
    # ไม่ควรเกิดขึ้นจริง — กันไว้เฉพาะกรณี services.rag_service โหลดไม่ขึ้นจริงๆ (เช่น path ผิด)
    logging.getLogger("nutrismart.ai_service").error(
        "services.rag_service import failed — RAG context will be unavailable"
    )
    def get_all_context() -> str:
        return "ไม่มีข้อมูลอ้างอิง"

    def get_relevant_context(query: str, max_items: int = 2) -> str:
        return "ไม่มีข้อมูลอ้างอิง"

settings = get_settings()

logger = logging.getLogger("nutrismart.ai_service")
logging.basicConfig(level=logging.INFO)

# ── AI Configuration ────────────────────────────────────────────────────────
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

# บัญชี OpenRouter ติดลบอยู่ ($-0.14) ไม่มีบัตร/เครดิตผูกไว้เลย — เปลี่ยนทุกโมเดลมาเป็นรุ่น
# ":free" ของ Gemma 4 (รองรับทั้งข้อความและรูปภาพ) กัน request ถูกปฏิเสธทันทีที่ยอดติดลบเกินที่
# OpenRouter ยอมให้ค้าง — ข้อแลกเปลี่ยน: โมเดลฟรีมี rate limit รวมทั้งบัญชีที่ 50 ครั้ง/วัน (หรือ
# 1,000/วัน ถ้าเคยเติมเงินสะสมครบ $10) และ 20 ครั้ง/นาที ไม่ใช่ต่อผู้ใช้คนเดียว
DEFAULT_VISION_MODEL = "google/gemma-4-31b-it:free"  # Route to OpenRouter — รองรับรูปภาพด้วย
DEFAULT_CHAT_MODEL = "google/gemma-4-31b-it:free"    # Route to OpenRouter

MEDGEMMA_MODEL = "google/gemma-4-31b-it:free"

def _get_headers(is_gemini: bool = False):
    if is_gemini:
        if not settings.gemini_api_key or settings.gemini_api_key == "dummy":
            raise HTTPException(status_code=503, detail="ขออภัยค่ะ ระบบ AI (Gemini) ยังไม่ได้ตั้งค่า API Key หรือขัดข้องชั่วคราว")
        return {
            "Authorization": f"Bearer {settings.gemini_api_key}",
            "Content-Type": "application/json",
        }
    if not settings.openrouter_api_key or settings.openrouter_api_key == "dummy":
        raise HTTPException(status_code=503, detail="ขออภัยค่ะ ระบบ AI (OpenRouter) ยังไม่ได้ตั้งค่า API Key หรือขัดข้องชั่วคราว")
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nutrismart.app",
        "X-Title": "NutriSmart AI",
    }


# ── Helper: call OpenRouter ─────────────────────────────────────────────────

async def _call_ai_api(messages: list[dict], temperature: float = 0.3, model: Optional[str] = None) -> str:
    """Send a chat completion request to the appropriate AI provider (Google Gemini or OpenRouter)."""
    target_model = model or DEFAULT_VISION_MODEL
    is_gemini = "gemini" in target_model.lower() and not target_model.startswith("google/")
    
    base_url = GEMINI_API_BASE_URL if is_gemini else OPENROUTER_BASE_URL
    headers = _get_headers(is_gemini=is_gemini)
    
    payload = {
        "model": target_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 2048,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                base_url,
                headers=headers,
                json=payload,
            )
            
            if response.status_code != 200:
                logger.error(f"AI API error {response.status_code}: {response.text[:500]}")
                raise HTTPException(
                    status_code=503,
                    detail="การเชื่อมต่อ AI ล้มเหลว กรุณาลองใหม่อีกครั้ง"
                )
                
            data = response.json()
            try:
                return data["choices"][0]["message"]["content"]
            except (KeyError, IndexError) as e:
                logger.error(f"Unexpected AI response structure: {data}")
                raise HTTPException(status_code=503, detail="ขออภัยค่ะ ข้อมูลที่ตอบกลับมาจาก AI ไม่ถูกต้องชั่วคราว")
                
    except httpx.RequestError as exc:
        logger.error(f"HTTP Request failed when calling AI API: {exc}")
        raise HTTPException(status_code=503, detail="ขออภัยค่ะ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ AI ได้ในขณะนี้")


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
หน้าที่ของคุณคือเป็น Hybrid Scanner ที่สามารถวิเคราะห์ได้ทั้ง "ภาพฉลากโภชนาการ" และ "ภาพจานอาหารทั่วไป"

── ขั้นตอนการทำงาน ──
1. ประเมินว่ารูปภาพที่ได้รับเป็น "ฉลากโภชนาการ (Nutrition Facts)" หรือ "ภาพอาหารทั่วไป (เช่น ข้าวผัด, กะเพรา, เครื่องดื่ม)"
2. **หากเป็นภาพฉลากโภชนาการ:** ให้อ่านข้อมูลจากตาราง (OCR) อย่างละเอียด ห้ามพลาดข้อมูลใดๆ ทั้งสิ้น
3. **หากเป็นภาพอาหารทั่วไป:**
   ให้วิเคราะห์ว่าเป็นเมนูอะไร และ **ประมาณการ** พลังงาน (Calories), โปรตีน, คาร์บ, ไขมัน, น้ำตาล, โซเดียม ใน 1 จาน/เสิร์ฟ อย่างสมเหตุสมผลตามหลักโภชนาการ
4. ประเมินและให้คะแนนสุขภาพ (Health Score) 0-100 อิงตามเกณฑ์ Thai RDI

── เกณฑ์ Thai RDI อ้างอิง ──
{rag_context}

── กฎการให้คะแนน Health Score ──
- คะแนนเริ่มต้น = 100
- หักคะแนนตามระดับความเสี่ยงของแต่ละสารอาหาร:
  • น้ำตาล > 12g/หน่วยบริโภค → หัก 20 คะแนน, > 6g → หัก 10
  • โซเดียม > 600mg/หน่วยบริโภค → หัก 25 คะแนน, > 300mg → หัก 12
  • ไขมัน > 20g/หน่วยบริโภค → หัก 15 คะแนน, > 13g → หัก 8
  • แคลอรี > 700kcal/หน่วยบริโภค → หัก 10 คะแนน (เฉพาะอาหารแปรรูปหรือขนมเท่านั้น ไม่ใช้กับมื้อหลัก)
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

CHAT_SYSTEM_PROMPT = """คุณคือเทรนเนอร์ส่วนตัวสายลุย เป็นกันเองสุด ๆ บุคลิกเหมือนเพื่อนสนิทหรือพี่น้องที่มาชวนกันปั้นหุ่น
ใช้สรรพนามแทนตัวเองว่า 'เทรนเนอร์' หรือ 'เรา' 

── 🎯 กฎสำคัญในการเลือกใช้วาจาตาม เพศ และ อายุของผู้ใช้ ──
{persona_instruction}

หน้าที่ของคุณคือเช็กข้อมูลส่วนตัวของผู้ใช้ (ชื่อ อายุ น้ำหนัก ส่วนสูง เป้าหมาย) จากที่ระบบส่งมาให้ แล้วนำมาวิเคราะห์ ให้คำแนะนำเรื่องอาหาร การนับแคลอรี และการซ้อมแบบตรงไปตรงมา คอยปล่อยเอเนอร์จี้พุ่ง ๆ และให้กำลังใจ ห้ามตอบเป็นทางการเด็ดขาด!

── ข้อมูลอ้างอิงจากฐานความรู้สากล ──
{rag_context}

── ข้อมูลสมาชิก (ผู้ที่คุณกำลังคุยด้วย) ──
{user_context}

── กฎการให้บริการตอบแชต ──
1. ตอบเป็นภาษาไทยด้วยน้ำเสียงตามกฎเกณฑ์ Persona ด้านบน ห้ามใช้คำทางการน่าเบื่อเด็ดขาด
2. นำข้อมูลจากฐานความรู้และข้อมูลร่างกายของผู้ใช้มาวิเคราะห์คำตอบให้สอดคล้องกันอย่างดีที่สุด
3. หากคำถามอยู่นอกเหนือเรื่องสุขภาพและการออกกำลังกาย ให้ตอบกวน ๆ ขำ ๆ เช่น "เรื่องนี้อยู่นอกเหนือกติกาการปั้นหุ่นของพวกเราว่ะ คุยเรื่องของกินหรือท่าสควอชดีกว่า!"
4. ห้ามใช้ Markdown เด็ดขาด ห้ามใช้ ** สำหรับ bold, ห้ามใช้ * หรือ - สำหรับ bullet, ห้ามใช้ # สำหรับหัวข้อ
5. ใช้ Emoji นำหน้าหัวข้อแทนเพื่อให้ดูน่าอ่านและขึ้นบรรทัดใหม่แยกแต่ละประเด็น
6. ความยาวไม่เกิน 4-5 ย่อหน้าสั้น อ่านจบได้ไวบนมือถือ"""

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
    _RDI_FALLBACK = (
        "เกณฑ์แนะนำต่อวันสำหรับคนไทยอายุ 6 ปีขึ้นไป (Thai RDI): "
        "พลังงาน 2000 kcal, คาร์โบไฮเดรต 300g, โปรตีน 50g, ไขมันทั้งหมด 65g, "
        "ไขมันอิ่มตัว 20g, โซเดียม 2000mg, น้ำตาลไม่ควรเกิน 24g"
    )
    try:
        rag_context = get_relevant_context(
            "Thai RDI โภชนาการ แคลอรี โปรตีน ไขมัน น้ำตาล โซเดียม", max_items=3
        )
        if not rag_context or rag_context == "ไม่มีข้อมูลอ้างอิง":
            rag_context = _RDI_FALLBACK
    except Exception:
        rag_context = _RDI_FALLBACK
    system_prompt = ANALYSIS_SYSTEM_PROMPT.format(rag_context=rag_context)

    image_data_url = f"data:{mime_type};base64,{image_base64}"

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        "กรุณาสแกนภาพนี้เพื่อวิเคราะห์ข้อมูลโภชนาการ หากเป็นฉลากโภชนาการให้อ่านข้อมูลจากในภาพให้ครบถ้วน "
                        "แต่ถ้าเป็นภาพอาหารทั่วไป ให้ประมาณการค่าพลังงานและสารอาหารหลักทั้งหมดอย่างใกล้เคียงที่สุด "
                        "จากนั้นประเมินคะแนนสุขภาพตามเกณฑ์ และตอบกลับมาเป็นโครงสร้าง JSON เท่านั้น"
                    ),
                },
                {
                    "type": "image_url",
                    "image_url": {"url": image_data_url},
                },
            ],
        },
    ]

    text = await _call_ai_api(messages, temperature=0.1)
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
    _RDI_FALLBACK = (
        "เกณฑ์แนะนำต่อวันสำหรับคนไทยอายุ 6 ปีขึ้นไป (Thai RDI): "
        "พลังงาน 2000 kcal, คาร์โบไฮเดรต 300g, โปรตีน 50g, ไขมันทั้งหมด 65g, "
        "ไขมันอิ่มตัว 20g, โซเดียม 2000mg, น้ำตาลไม่ควรเกิน 24g"
    )
    try:
        rag_context = get_relevant_context(
            "Thai RDI โภชนาการ แคลอรี โปรตีน ไขมัน น้ำตาล โซเดียม", max_items=3
        )
        if not rag_context or rag_context == "ไม่มีข้อมูลอ้างอิง":
            rag_context = _RDI_FALLBACK
    except Exception:
        rag_context = _RDI_FALLBACK
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

    text = await _call_ai_api(messages, temperature=0.1)
    return _parse_json_response(text)


# ── 3. NutriChat (RAG-enhanced conversation) ─────────────────────────────────

async def chat(user_message: str, chat_history: Optional[list[dict]] = None, user_profile: Optional[Dict[str, Any]] = None) -> str:
    try:
        rag_context = get_relevant_context(user_message, max_items=3)
    except Exception as exc:
        logger.warning(
            "RAG context retrieval failed (non-fatal) — falling back to empty context. Error: %s",
            exc,
            exc_info=True,
        )
        rag_context = "ไม่มีข้อมูลอ้างอิง"

    # 🌟 1. ดึงและวิเคราะห์ข้อมูลจาก Profile เพื่อคำนวณ Persona ลายเส้นคำพูด
    gender = "ไม่ระบุ"
    age = 0
    name = "คุณ"
    
    if user_profile:
        name = user_profile.get('name', 'คุณ')
        gender = str(user_profile.get('gender', 'ไม่ระบุ'))
        try:
            age = int(user_profile.get('age', 0))
        except (ValueError, TypeError):
            age = 0

        user_context = (
            f"- ชื่อผู้ใช้: คุณ{name}\n"
            f"- น้ำหนัก: {user_profile.get('weight', 'ไม่ระบุ')} กก.\n"
            f"- ส่วนสูง: {user_profile.get('height', 'ไม่ระบุ')} ซม.\n"
            f"- อายุ: {age if age > 0 else 'ไม่ระบุ'} ปี\n"
            f"- เพศ: {gender}\n"
            f"- เป้าหมายแคลอรีต่อวัน: {user_profile.get('goal_calories', 'ไม่ระบุ')} kcal"
        )
    else:
        user_context = "ไม่มีข้อมูลสมาชิกแนบมา ให้เรียกผู้ใช้ว่า นาย หรือ แก แทน"

    # 🌟 2. สร้าง dynamic prompt ตัดเกรดคำพูดตาม เพศ และ ช่วงอายุ
    persona_instruction = ""
    
    # แยกสายตามช่วงอายุ
    if age > 0 and age < 30:  # กลุ่มวัยรุ่น / First Jobber
        if "หญิง" in gender:
            persona_instruction = f"ผู้ใช้เป็น 'ผู้หญิงวัยรุ่น' ชื่อคุณ {name} ให้เรียกผู้ใช้ว่า 'แก' หรือ 'เธอ' หรือชื่อของเธอ และลงท้ายด้วย 'คะ/ขา' แบบเป็นกันเองเหมือนเพื่อนสาวสายฟิตชวนลีนหุ่น ใช้คำวัยรุ่นได้เต็มที่"
        elif "ชาย" in gender:
            persona_instruction = f"ผู้ใช้เป็น 'ผู้ชายวัยรุ่น' ชื่อคุณ {name} ให้เรียกผู้ใช้ว่า 'นาย' หรือ 'แก' หรือชื่อของเขา ใช้น้ำเสียงลุยๆ แมนๆ สไตล์เพื่อนสนิท (เช่น เฮ้ย, จัดไป, เอาเรื่องดิ)"
        else:
            persona_instruction = f"ผู้ใช้เป็น 'วัยรุ่น' ชื่อคุณ {name} ให้เรียกผู้ใช้ว่า 'แก' หรือ 'นาย' เป็นกันเองสไตล์เพื่อนสนิทวัยมันส์ ชวนกันลุยปั้นหุ่น"
            
    elif age >= 30 and age < 45:  # กลุ่มวัยทำงาน / วัยสร้างตัว
        if "หญิง" in gender:
            persona_instruction = f"ผู้ใช้เป็น 'ผู้หญิงวัยทำงาน' ชื่อคุณ {name} ให้เรียกผู้ใช้ว่า 'พี่ {name}' หรือชื่อของเธอ คุยสนุกสนาน ให้พลังบวก มีหางเสียง 'ค่ะ' แต่ยังคงความสนิทสนม ไม่เป็นทางการจนอึดอัด"
        elif "ชาย" in gender:
            persona_instruction = f"ผู้ใช้เป็น 'ผู้ชายวัยทำงาน' ชื่อคุณ {name} ให้เรียกผู้ใช้ว่า 'พี่ {name}' หรือชื่อของเขา คุยสไตล์น้องชายสายฟิตมาชวนพี่ชายปั้นหุ่น มีความเคารพแต่สนิทกัน ลุยๆ เอาจริงเอาจัง"
        else:
            persona_instruction = f"ผู้ใช้เป็น 'วัยทำงาน' ชื่อคุณ {name} ให้เรียกผู้ใช้ว่า 'พี่' หรือชื่อของเขา/เธอ คุยสไตล์กันเองแต่ให้เกียรติ พลังงานบวกพุ่งๆ"
            
    else:  # กลุ่มอายุ 45 ขึ้นไป หรือไม่ระบุอายุ
        if "หญิง" in gender:
            persona_instruction = f"ผู้ใช้เป็น 'ผู้ใหญ่ (ผู้หญิง)' ชื่อคุณ {name} ให้เรียกว่า 'คุณ {name}' หรือชื่อของเธอ ใช้น้ำเสียงนอบน้อม สุภาพ อ่อนโยน มีหางเสียง 'ค่ะ' คอยดูแลเอาใจใส่เรื่องสุขภาพอย่างอบอุ่น"
        elif "ชาย" in gender:
            persona_instruction = f"ผู้ใช้เป็น 'ผู้ใหญ่ (ผู้ชาย)' ชื่อคุณ {name} ให้เรียกว่า 'คุณ {name}' หรือชื่อของเขา ใช้น้ำเสียงสุภาพ ให้เกียรติ มีหางเสียง 'ครับ' คอยเป็นที่ปรึกษาด้านสุขภาพที่พึ่งพาได้"
        else:
            persona_instruction = f"ไม่ทราบอายุหรือเพศแน่ชัด ให้เรียกผู้ใช้ว่า 'นาย' หรือ 'คุณ' คุยสนุกสนาน สุภาพ เป็นกันเองตามมาตรฐานกลาง"

    # 🌟 3. ประกอบร่าง System Prompt
    system_prompt = CHAT_SYSTEM_PROMPT.replace("{rag_context}", rag_context)\
                                      .replace("{user_context}", user_context)\
                                      .replace("{persona_instruction}", persona_instruction)

    messages = [{"role": "system", "content": system_prompt}]

    if chat_history:
        for msg in chat_history[-6:]:
            role = "user" if msg.get("role") == "user" else "assistant"
            messages.append({"role": role, "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    # ใช้ MedGemma เป็นหลัก (เก่งด้านโภชนาการ/สุขภาพ) ถ้าเรียกไม่ติด/error ค่อย fallback ไป Gemini
    # โดยอัตโนมัติ — ใช้ทั้งสองโมเดลร่วมกัน ไม่ใช่ตัด Gemini ออกจากระบบไปเลย
    # หมายเหตุ: ตอนนี้ทั้งสองตัวแปรชี้โมเดลฟรีตัวเดียวกัน (ดูคอมเมนต์ด้านบน) เลขสันนิษฐานว่าไม่ต้อง
    # retry ซ้ำโมเดลเดิมถ้าพัง (เปลืองโควตา rate limit ฟรีเปล่าๆ) — ถ้าวันหลังตั้งให้ต่างกันอีกจะ fallback ตามปกติ
    try:
        return await _call_ai_api(messages, temperature=0.6, model=MEDGEMMA_MODEL)
    except HTTPException:
        if DEFAULT_CHAT_MODEL == MEDGEMMA_MODEL:
            raise
        logger.warning("MedGemma chat call failed — falling back to Gemini (%s)", DEFAULT_CHAT_MODEL)
        return await _call_ai_api(messages, temperature=0.6, model=DEFAULT_CHAT_MODEL)


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

    text = await _call_ai_api(messages, temperature=0.3)
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

    text = await _call_ai_api(messages, temperature=0.3)
    return _parse_json_response(text)


async def call_medgemma(prompt: str) -> str:
    """เรียก MedGemma ผ่าน OpenRouter แล้วคืนข้อความตอบกลับ"""
    messages = [{"role": "user", "content": prompt}]
    return await _call_ai_api(messages, temperature=0.5, model=MEDGEMMA_MODEL)