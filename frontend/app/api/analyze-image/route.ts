import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { image } = await req.json();

  if (!image || typeof image !== "string") {
    return NextResponse.json(
      { error: "image (base64 data URL) is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Extract base64 data from data URL
    const base64Match = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json(
        { error: "Invalid image format. Expected base64 data URL." },
        { status: 400 }
      );
    }

    const mimeType = `image/${base64Match[1]}` as "image/jpeg" | "image/png" | "image/webp";
    const base64Data = base64Match[2];

    const prompt = `คุณคือระบบ OCR สำหรับอ่านฉลากโภชนาการ (Nutrition Facts Label) จากภาพ
กรุณาอ่านข้อมูลจากฉลากโภชนาการในภาพนี้ แล้วตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกจาก JSON

รูปแบบ:
{
  "productName": "<ชื่อผลิตภัณฑ์ ถ้าอ่านได้>",
  "calories": <number>,
  "protein": <number>,
  "carbs": <number>,
  "totalFat": <number>,
  "sugar": <number>,
  "sodium": <number>
}

หมายเหตุ:
- calories หน่วยเป็น kcal
- protein, carbs, totalFat, sugar หน่วยเป็นกรัม (g)
- sodium หน่วยเป็นมิลลิกรัม (mg)
- ถ้าอ่านค่าไม่ได้หรือไม่มีข้อมูล ให้ใส่ 0
- ถ้าภาพไม่ใช่ฉลากโภชนาการ ให้ตอบ: {"error": "not_nutrition_label"}
- ข้อมูลควรเป็นต่อ 1 หน่วยบริโภค (per serving)`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ]);

    const text = result.response.text().trim();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI ไม่สามารถอ่านข้อมูลจากภาพนี้ได้" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.error === "not_nutrition_label") {
      return NextResponse.json(
        { error: "ภาพนี้ไม่ใช่ฉลากโภชนาการ กรุณาถ่ายรูปฉลากโภชนาการ" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      productName: parsed.productName || "",
      calories: Number(parsed.calories) || 0,
      protein: Number(parsed.protein) || 0,
      carbs: Number(parsed.carbs) || 0,
      totalFat: Number(parsed.totalFat) || 0,
      sugar: Number(parsed.sugar) || 0,
      sodium: Number(parsed.sodium) || 0,
    });
  } catch (err) {
    console.error("Analyze image error:", err);
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    );
  }
}
