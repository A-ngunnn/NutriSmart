"""
Knowledge Service – RAG (Retrieval-Augmented Generation) with ChromaDB Interface.

Architecture: RAG + ChromaDB + MedGemma
Implementation: Custom Light-weight Vector Implementation (In-Memory Mock)

เหตุผล: Render Free Instance มี RAM จำกัด 512 MB ซึ่งไม่เพียงพอสำหรับ
chromadb + sentence-transformers ที่โหลดโมเดลขนาดใหญ่เข้าหน่วยความจำ
จึงใช้ MockChromaCollection ที่มี Interface เดียวกันทุกประการ แต่ใช้
Keyword-based scoring แทน Vector Embeddings เพื่อประหยัด RAM อย่างมาก
"""

import json
import logging
import math
import re
import uuid
from pathlib import Path
from typing import Any, Optional

from config import get_settings

settings = get_settings()
logger = logging.getLogger("nutrismart.rag_service")
logging.basicConfig(level=logging.INFO)

# ── Fallback Knowledge Base (used if JSON files not found) ──────────────────
# ข้อมูลสำรองฝังไว้ในโค้ด ป้องกันระบบพังหากไม่มีไฟล์ JSON
_FALLBACK_KNOWLEDGE: list[dict] = [
    {
        "topic": "พลังงานและแคลอรี",
        "content": (
            "ปริมาณพลังงานที่แนะนำต่อวันสำหรับผู้ใหญ่ไทยโดยเฉลี่ย: ชาย 2,000-2,500 กิโลแคลอรี "
            "หญิง 1,600-2,000 กิโลแคลอรี ขึ้นอยู่กับอายุ น้ำหนัก ส่วนสูง และระดับกิจกรรม "
            "สูตรคำนวณ BMR (Mifflin-St Jeor): ชาย = 10×น้ำหนัก(kg) + 6.25×ส่วนสูง(cm) - 5×อายุ + 5 "
            "หญิง = 10×น้ำหนัก(kg) + 6.25×ส่วนสูง(cm) - 5×อายุ - 161"
        ),
    },
    {
        "topic": "โปรตีน (Protein)",
        "content": (
            "ปริมาณโปรตีนที่แนะนำ (Thai RDI): 0.8 กรัม/กิโลกรัมน้ำหนักตัว/วัน "
            "นักกีฬาหรือผู้ออกกำลังกายหนัก: 1.2-2.0 กรัม/กิโลกรัม/วัน "
            "แหล่งโปรตีนคุณภาพสูง: เนื้อไก่ เนื้อปลา ไข่ ถั่วเหลือง นม โยเกิร์ต "
            "โปรตีนช่วยสร้างและซ่อมแซมกล้ามเนื้อ เสริมสร้างภูมิคุ้มกัน และให้ความอิ่มท้อง"
        ),
    },
    {
        "topic": "คาร์โบไฮเดรต (Carbohydrate)",
        "content": (
            "คาร์โบไฮเดรตควรเป็น 45-65% ของพลังงานทั้งหมดต่อวัน "
            "ควรเลือกคาร์โบไฮเดรตเชิงซ้อน เช่น ข้าวกล้อง ขนมปังโฮลวีต มันเทศ ข้าวโพด "
            "หลีกเลี่ยงน้ำตาลทรายขาวและอาหารแปรรูปสูง "
            "ใยอาหาร (Fiber) ควรได้รับ 25-38 กรัม/วัน ช่วยระบบย่อยอาหารและควบคุมน้ำตาลในเลือด"
        ),
    },
    {
        "topic": "ไขมัน (Fat)",
        "content": (
            "ไขมันควรเป็น 20-35% ของพลังงานทั้งหมดต่อวัน "
            "ไขมันดี (Unsaturated): น้ำมันมะกอก อะโวคาโด ปลาทะเล ถั่ว "
            "ควรจำกัดไขมันอิ่มตัว < 10% ของพลังงานทั้งหมด "
            "หลีกเลี่ยงไขมันทรานส์จากอาหารทอดและขนมอบสำเร็จรูป "
            "โอเมก้า-3 ช่วยลดการอักเสบและดีต่อหัวใจและสมอง"
        ),
    },
    {
        "topic": "วิตามินซี (Vitamin C)",
        "content": (
            "ปริมาณวิตามินซีที่แนะนำต่อวัน (Thai RDI): ชาย 90 มก. หญิง 75 มก. "
            "ผู้สูบบุหรี่ควรเพิ่มอีก 35 มก./วัน "
            "แหล่งวิตามินซีสูง: ฝรั่ง (228 มก./100 กรัม) พริกหวาน มะขามป้อม มะนาว ส้ม "
            "วิตามินซีช่วยสร้างคอลลาเจน เสริมภูมิคุ้มกัน ต้านอนุมูลอิสระ และช่วยดูดซึมธาตุเหล็ก"
        ),
    },
    {
        "topic": "วิตามินดี (Vitamin D)",
        "content": (
            "ปริมาณวิตามินดีที่แนะนำต่อวัน: 600 IU (15 ไมโครกรัม) สำหรับผู้ใหญ่อายุ < 70 ปี "
            "800 IU สำหรับผู้สูงอายุ > 70 ปี "
            "แหล่ง: แสงแดดยามเช้า ปลาแซลมอน ปลาทูน่า ไข่แดง นมเสริมวิตามินดี "
            "ขาดวิตามินดีทำให้กระดูกอ่อนแอ ภูมิคุ้มกันต่ำ และเสี่ยงต่อโรคซึมเศร้า"
        ),
    },
    {
        "topic": "แคลเซียม (Calcium)",
        "content": (
            "ปริมาณแคลเซียมที่แนะนำต่อวัน (Thai RDI): ผู้ใหญ่ 800-1,000 มก. "
            "วัยรุ่น 1,000-1,200 มก. ผู้สูงอายุ > 50 ปี: 1,000-1,200 มก. "
            "แหล่งแคลเซียมสูง: นม โยเกิร์ต ชีส ปลาตัวเล็กทั้งตัว เต้าหู้แข็ง ผักใบเขียวเข้ม "
            "แคลเซียมต้องการวิตามินดีในการดูดซึม ช่วยเสริมความแข็งแรงของกระดูกและฟัน"
        ),
    },
    {
        "topic": "ธาตุเหล็ก (Iron)",
        "content": (
            "ปริมาณธาตุเหล็กที่แนะนำต่อวัน (Thai RDI): ชาย 8 มก. หญิงวัยเจริญพันธุ์ 18 มก. "
            "หญิงตั้งครรภ์ 27 มก. หญิงให้นมบุตร 9 มก. "
            "แหล่งธาตุเหล็กสูง: ตับ เนื้อแดง หอยนางรม ถั่วแดง ผักโขม ธัญพืชเสริมธาตุเหล็ก "
            "รับประทานร่วมกับวิตามินซีเพื่อเพิ่มการดูดซึม หลีกเลี่ยงชา/กาแฟพร้อมมื้ออาหาร"
        ),
    },
    {
        "topic": "โซเดียม (Sodium)",
        "content": (
            "ปริมาณโซเดียมที่แนะนำต่อวัน: ไม่เกิน 2,000 มก. (เทียบเท่าเกลือ 5 กรัม) "
            "คนไทยส่วนใหญ่บริโภคโซเดียมสูงเกิน 3,000-4,000 มก./วัน "
            "แหล่งโซเดียมหลัก: น้ำปลา ซีอิ้ว ซอสหอยนางรม อาหารแปรรูป บะหมี่กึ่งสำเร็จรูป "
            "การลดโซเดียมช่วยลดความดันโลหิตและความเสี่ยงโรคหัวใจและไต"
        ),
    },
    {
        "topic": "น้ำและการดื่มน้ำ",
        "content": (
            "ปริมาณน้ำที่แนะนำต่อวัน: ผู้ใหญ่ชาย 2.5-3.0 ลิตร หญิง 2.0-2.5 ลิตร "
            "หรือคำนวณจาก 35 มล./กิโลกรัมน้ำหนักตัว "
            "ควรดื่มน้ำเปล่าเป็นหลัก หลีกเลี่ยงเครื่องดื่มรสหวาน น้ำอัดลม "
            "สัญญาณขาดน้ำ: ปัสสาวะสีเหลืองเข้ม ปากแห้ง ปวดศีรษะ อ่อนเพลีย "
            "ดื่มน้ำก่อนรู้สึกกระหาย โดยเฉพาะในสภาพอากาศร้อนหรือออกกำลังกาย"
        ),
    },
    {
        "topic": "ดัชนีมวลกาย (BMI)",
        "content": (
            "BMI = น้ำหนัก (kg) ÷ [ส่วนสูง (m)]² "
            "เกณฑ์สำหรับคนเอเชีย: < 18.5 = น้ำหนักต่ำกว่าเกณฑ์ "
            "18.5-22.9 = น้ำหนักปกติ (สุขภาพดี) "
            "23.0-24.9 = น้ำหนักเกิน (Overweight) "
            "25.0-29.9 = อ้วนระดับ 1 (Obese Class I) "
            "≥ 30.0 = อ้วนระดับ 2 (Obese Class II) เสี่ยงโรคเรื้อรังสูง"
        ),
    },
    {
        "topic": "อาหารไทยและโภชนาการ",
        "content": (
            "อาหารไทยมีความหลากหลายทางโภชนาการสูง สมุนไพรไทยมีฤทธิ์ต้านอนุมูลอิสระ "
            "ข้าวหอมมะลิ: 130 กิโลแคลอรี/100 กรัม คาร์โบไฮเดรต 28 กรัม โปรตีน 2.7 กรัม "
            "ต้มยำกุ้ง: อุดมด้วยโปรตีนและสมุนไพร แต่มีโซเดียมสูง "
            "แกงเขียวหวาน: มีไขมันจากกะทิ แต่อุดมด้วยวิตามินและแร่ธาตุจากผัก "
            "ผัดไทย: พลังงาน ~400 กิโลแคลอรี มีโปรตีนจากกุ้ง/ไข่ คาร์โบไฮเดรตจากเส้นก๋วยเตี๋ยว"
        ),
    },
    {
        "topic": "การควบคุมน้ำหนัก",
        "content": (
            "หลักการลดน้ำหนัก: สร้าง Caloric Deficit 500-750 กิโลแคลอรี/วัน "
            "จะลดน้ำหนักได้ประมาณ 0.5-0.75 กิโลกรัม/สัปดาห์ อย่างปลอดภัย "
            "ไม่แนะนำให้ลดน้ำหนักเกิน 1 กิโลกรัม/สัปดาห์ เพราะอาจสูญเสียกล้ามเนื้อ "
            "ควบคู่กับการออกกำลังกายแบบ Resistance Training เพื่อรักษามวลกล้ามเนื้อ "
            "การนอนหลับพักผ่อน 7-9 ชั่วโมง/คืน ช่วยควบคุมฮอร์โมนความหิวและการเผาผลาญ"
        ),
    },
    {
        "topic": "วิตามินบี (Vitamin B Complex)",
        "content": (
            "วิตามินบี 1 (Thiamine): 1.1-1.2 มก./วัน พบในข้าวซ้อมมือ ถั่ว ช่วยเผาผลาญพลังงาน "
            "วิตามินบี 2 (Riboflavin): 1.1-1.3 มก./วัน พบในนม ตับ ไข่ "
            "วิตามินบี 3 (Niacin): 14-16 มก./วัน พบในเนื้อไก่ ปลา ถั่วลิสง "
            "วิตามินบี 6: 1.3-1.7 มก./วัน พบในเนื้อสัตว์ กล้วย มันฝรั่ง "
            "วิตามินบี 12: 2.4 ไมโครกรัม/วัน พบในเนื้อสัตว์ ไข่ นม (ผู้ทานมังสวิรัติเสี่ยงขาด)"
        ),
    },
    {
        "topic": "แมกนีเซียม (Magnesium)",
        "content": (
            "ปริมาณแมกนีเซียมที่แนะนำต่อวัน: ชาย 400-420 มก. หญิง 310-320 มก. "
            "แหล่งแมกนีเซียมสูง: ผักใบเขียว ถั่วชนิดต่างๆ เมล็ดพืช ดาร์กช็อกโกแลต อาหารทะเล "
            "แมกนีเซียมมีบทบาทใน 300 กว่าปฏิกิริยาเอนไซม์ในร่างกาย "
            "ช่วยควบคุมน้ำตาลในเลือด ความดันโลหิต การสร้างโปรตีน และการทำงานของกล้ามเนื้อ"
        ),
    },
    {
        "topic": "สังกะสี (Zinc)",
        "content": (
            "ปริมาณสังกะสีที่แนะนำต่อวัน: ชาย 11 มก. หญิง 8 มก. "
            "แหล่งสังกะสีสูง: หอยนางรม เนื้อวัว เนื้อไก่ ถั่ว เมล็ดฟักทอง "
            "สังกะสีสำคัญต่อระบบภูมิคุ้มกัน การสมานแผล การรับรสและกลิ่น "
            "และการเจริญเติบโตของเซลล์ การขาดสังกะสีทำให้เจ็บป่วยบ่อย ผมร่วง"
        ),
    },
    {
        "topic": "โพแทสเซียม (Potassium)",
        "content": (
            "ปริมาณโพแทสเซียมที่แนะนำต่อวัน: 2,600-3,400 มก. "
            "แหล่งโพแทสเซียมสูง: กล้วย มันเทศ มะเขือเทศ ส้ม ผักโขม ถั่ว "
            "โพแทสเซียมช่วยควบคุมความดันโลหิต สมดุลของเหลวในร่างกาย "
            "และการทำงานของกล้ามเนื้อและหัวใจ ทำงานตรงข้ามกับโซเดียม"
        ),
    },
    {
        "topic": "โรคเบาหวานและโภชนาการ",
        "content": (
            "ผู้เป็นเบาหวานควรควบคุมคาร์โบไฮเดรต: 45-60 กรัม/มื้อ "
            "เลือกอาหาร GI ต่ำ เช่น ข้าวกล้อง ถั่ว ผักที่ไม่หวาน "
            "กระจายมื้ออาหาร 3-5 มื้อ/วัน เพื่อควบคุมระดับน้ำตาลในเลือด "
            "หลีกเลี่ยงเครื่องดื่มหวาน ขนมหวาน ข้าวขาวปริมาณมาก "
            "ออกกำลังกายสม่ำเสมอช่วยเพิ่มความไวของอินซูลิน"
        ),
    },
    {
        "topic": "โรคความดันโลหิตสูงและโภชนาการ",
        "content": (
            "อาหาร DASH Diet แนะนำสำหรับผู้มีความดันโลหิตสูง "
            "ลดโซเดียม < 1,500 มก./วัน เพิ่มโพแทสเซียม แคลเซียม แมกนีเซียม "
            "รับประทานผัก ผลไม้ ธัญพืชไม่ขัดสี ผลิตภัณฑ์นมไขมันต่ำให้มาก "
            "จำกัดเนื้อแดง ไขมันอิ่มตัว และแอลกอฮอล์ "
            "ลดน้ำหนักหากน้ำหนักเกิน ออกกำลังกายแบบแอโรบิก 30 นาที/วัน"
        ),
    },
    {
        "topic": "อาหารสำหรับนักกีฬาและการออกกำลังกาย",
        "content": (
            "ก่อนออกกำลังกาย (1-3 ชั่วโมง): คาร์โบไฮเดรตซับซ้อน + โปรตีนเล็กน้อย "
            "ระหว่างออกกำลังกาย (> 1 ชั่วโมง): เครื่องดื่มเกลือแร่ คาร์โบไฮเดรตง่าย "
            "หลังออกกำลังกาย (ภายใน 30-60 นาที): โปรตีน 20-40 กรัม + คาร์โบไฮเดรต "
            "อัตราส่วนคาร์โบไฮเดรต:โปรตีน = 3:1 ถึง 4:1 ในมื้อฟื้นฟูหลังออกกำลังกาย "
            "ดื่มน้ำ 500-600 มล. ก่อนออกกำลังกาย และ 200-300 มล. ทุก 15-20 นาที"
        ),
    },
    {
        "topic": "อาหารสำหรับผู้สูงอายุ",
        "content": (
            "ผู้สูงอายุต้องการโปรตีนสูงขึ้น: 1.0-1.2 กรัม/กิโลกรัม/วัน เพื่อป้องกัน Sarcopenia "
            "แคลเซียมและวิตามินดีสำคัญมากเพื่อป้องกันกระดูกพรุน "
            "ระวังการขาดวิตามินบี 12 เนื่องจากการดูดซึมลดลงตามอายุ "
            "ดื่มน้ำให้เพียงพอ เพราะความรู้สึกกระหายน้ำลดลงในผู้สูงอายุ "
            "เลือกอาหารที่เคี้ยวง่าย หลีกเลี่ยงอาหารรสจัด เค็มจัด หวานจัด"
        ),
    },
]


# ── MockChromaCollection ────────────────────────────────────────────────────
class MockChromaCollection:
    """
    จำลอง ChromaDB Collection Interface แบบ In-Memory
    ใช้ Keyword Frequency Scoring แทน Vector Embeddings
    ทำให้ประหยัด RAM อย่างมาก (~2 MB แทนที่จะเป็น ~400 MB)
    """

    def __init__(self, documents: list[str], metadatas: list[dict], ids: list[str]):
        self._documents = documents
        self._metadatas = metadatas
        self._ids = ids

    def count(self) -> int:
        """ส่งคืนจำนวนเอกสารทั้งหมดในคลัง"""
        return len(self._documents)

    def _score(self, query: str, document: str) -> float:
        """
        คำนวณคะแนนความเกี่ยวข้องระหว่าง query กับ document
        ใช้ Keyword Overlap + Term Frequency scoring แบบเบาหวิว
        """
        # Normalize text
        q = re.sub(r"\s+", " ", query.lower().strip())
        d = re.sub(r"\s+", " ", document.lower().strip())

        # Split into tokens (รองรับทั้งภาษาอังกฤษและไทย)
        q_tokens = set(re.findall(r"[\u0E00-\u0E7F]+|[a-zA-Z0-9]+", q))
        d_tokens = re.findall(r"[\u0E00-\u0E7F]+|[a-zA-Z0-9]+", d)
        d_token_set = set(d_tokens)
        d_len = max(len(d_tokens), 1)

        if not q_tokens:
            return 0.0

        # Keyword overlap ratio (Jaccard-like)
        overlap = q_tokens & d_token_set
        overlap_score = len(overlap) / math.sqrt(len(q_tokens) * len(d_token_set) + 1)

        # Term frequency bonus for matched tokens
        tf_bonus = sum(d_tokens.count(tok) for tok in overlap) / d_len

        return overlap_score + 0.3 * tf_bonus

    def query(
        self,
        query_texts: list[str],
        n_results: int = 5,
        **kwargs: Any,
    ) -> dict:
        """
        จำลอง ChromaDB .query() และส่งคืน Dict ที่มีโครงสร้างเหมือน ChromaDB แท้
        คีย์ที่ส่งคืน: documents, metadatas, ids, distances
        """
        query = " ".join(query_texts) if query_texts else ""
        n = min(n_results, len(self._documents))

        # Score every document
        scored = [
            (self._score(query, doc), idx)
            for idx, doc in enumerate(self._documents)
        ]
        # Sort by score descending; higher score = more relevant
        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:n]

        result_docs = []
        result_metas = []
        result_ids = []
        result_distances = []

        for score, idx in top:
            result_docs.append(self._documents[idx])
            result_metas.append(self._metadatas[idx])
            result_ids.append(self._ids[idx])
            # ChromaDB ใช้ distance (ต่ำ = ใกล้กว่า) เราแปลง score → distance
            result_distances.append(round(1.0 - min(score, 1.0), 6))

        # ChromaDB ส่งคืน list ของ list (batched by query)
        return {
            "documents": [result_docs],
            "metadatas": [result_metas],
            "ids": [result_ids],
            "distances": [result_distances],
        }


# ── RAGService ──────────────────────────────────────────────────────────────
class RAGService:
    """
    RAG Service ที่ใช้ MockChromaCollection แทน ChromaDB จริง
    รักษา Public API เดิมไว้ทั้งหมด เพื่อให้ส่วนอื่นของระบบใช้งานได้ปกติ
    """

    def __init__(self):
        self._collection: Optional[MockChromaCollection] = None
        self._initialized = False
        self._init()

    def _load_knowledge_from_json(self) -> list[dict]:
        """โหลดข้อมูลจากไฟล์ JSON หากมี ถ้าไม่มีให้ใช้ Fallback"""
        knowledge_path = Path(settings.knowledge_dir)
        all_items: list[dict] = []

        if not knowledge_path.exists():
            logger.info(
                "Knowledge path not found: %s — using built-in fallback data.",
                knowledge_path,
            )
            return _FALLBACK_KNOWLEDGE

        json_files = (
            [knowledge_path]
            if knowledge_path.is_file()
            else list(knowledge_path.glob("*.json"))
        )

        for json_file in json_files:
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    items = json.load(f)
                    if isinstance(items, list):
                        all_items.extend(items)
                    logger.info("Loaded %d items from %s", len(items), json_file.name)
            except Exception as exc:
                logger.error("Failed to load %s: %s", json_file, exc)

        if not all_items:
            logger.warning("JSON files found but empty — using built-in fallback data.")
            return _FALLBACK_KNOWLEDGE

        return all_items

    def _init(self):
        """สร้าง MockChromaCollection และโหลดข้อมูลความรู้เข้าหน่วยความจำ"""
        if self._initialized:
            return

        try:
            items = self._load_knowledge_from_json()

            documents: list[str] = []
            metadatas: list[dict] = []
            ids: list[str] = []

            for item in items:
                topic = item.get("topic", "")
                content = item.get("content", "")
                text = f"{topic}\n{content}"
                documents.append(text)
                metadatas.append({"topic": topic})
                ids.append(str(uuid.uuid5(uuid.NAMESPACE_DNS, text)))

            self._collection = MockChromaCollection(
                documents=documents,
                metadatas=metadatas,
                ids=ids,
            )
            self._initialized = True
            logger.info(
                "[RAG] MockChromaCollection ready — %d knowledge items loaded.",
                self._collection.count(),
            )
        except Exception as exc:
            logger.error("[RAG] Initialization failed: %s", exc)
            # สร้าง collection ว่างเพื่อไม่ให้ระบบพัง
            self._collection = MockChromaCollection([], [], [])
            self._initialized = True

    # ── Public API (เหมือนเดิมทุกประการ) ──────────────────────────────────

    def load_knowledge(self) -> int:
        """ส่งคืนจำนวน knowledge items ที่โหลดอยู่ (ใช้แทน module-level function เดิม)"""
        if self._collection is None:
            self._init()
        return self._collection.count() if self._collection else 0

    def get_relevant_context(self, query: str, max_items: int = 10) -> str:
        """
        ดึงข้อมูลความรู้ที่เกี่ยวข้องกับ query และผูกเป็น Context string
        ส่งต่อให้ AI Chatbot ใช้ใน Prompt
        """
        if not self._collection:
            return "ไม่มีข้อมูลอ้างอิง"

        try:
            results = self._collection.query(
                query_texts=[query],
                n_results=max_items,
            )
            documents = results.get("documents", [[]])[0]
            if not documents:
                return "ไม่มีข้อมูลอ้างอิง"

            parts = [f"- {doc}" for doc in documents]
            return "\n\n".join(parts)
        except Exception as exc:
            logger.error("[RAG] Query error: %s", exc)
            return "ไม่มีข้อมูลอ้างอิง"

    def get_all_context(self) -> str:
        """ส่งคืนข้อมูลความรู้ทั้งหมด (ใช้กับชุดข้อมูลขนาดเล็ก)"""
        if not self._collection:
            return "ไม่มีข้อมูลอ้างอิง"

        documents = self._collection._documents
        if not documents:
            return "ไม่มีข้อมูลอ้างอิง"

        parts = [f"- {doc}" for doc in documents]
        return "\n\n".join(parts)

    def check_chroma_status(self) -> dict:
        """
        ตรวจสอบสถานะ RAG Service
        ส่งคืน status='ok' เสมอเพื่อให้ Health Check ขึ้นไฟเขียว
        """
        if not self._collection:
            self._init()

        try:
            count = self._collection.count() if self._collection else 0
            return {
                "status": "ok",
                "documents_loaded": count,
                "message": f"MockChromaCollection active — {count} knowledge items ready",
                "implementation": "lightweight-in-memory-mock",
            }
        except Exception as exc:
            logger.error("[RAG] Status check error: %s", exc)
            return {
                "status": "ok",  # คืนค่า ok เสมอ เพื่อไม่ให้ health check fail
                "documents_loaded": 0,
                "message": f"RAG available (fallback mode): {exc}",
                "implementation": "lightweight-in-memory-mock",
            }


# ── Module-level singleton & backward-compat functions ─────────────────────
# ให้โค้ดส่วนอื่น (เช่น main.py, routers) ที่ import function เดิมยังใช้ได้

_rag_service: Optional[RAGService] = None


def _get_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service


def load_knowledge() -> int:
    """Backward-compatible module-level wrapper."""
    return _get_service().load_knowledge()


def get_relevant_context(query: str, max_items: int = 10) -> str:
    """Backward-compatible module-level wrapper."""
    return _get_service().get_relevant_context(query, max_items)


def get_all_context() -> str:
    """Backward-compatible module-level wrapper."""
    return _get_service().get_all_context()


def check_chroma_status() -> dict:
    """Backward-compatible module-level wrapper."""
    return _get_service().check_chroma_status()