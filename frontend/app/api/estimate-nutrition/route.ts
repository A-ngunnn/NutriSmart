import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { foodName } = await req.json();

  if (!foodName || typeof foodName !== "string") {
    return NextResponse.json(
      { error: "foodName is required" },
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

    const prompt = `คุณคือผู้เชี่ยวชาญด้านโภชนาการอาหารไทยและสากล
ผู้ใช้ต้องการทราบค่าโภชนาการโดยประมาณของอาหาร: "${foodName}"

กรุณาประมาณค่าโภชนาการต่อ 1 จาน/หน่วยบริโภคปกติ (serving) แล้วตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอกจาก JSON
รูปแบบ:
{
  "calories": <number>,
  "protein": <number>,
  "carbs": <number>,
  "fat": <number>
}

ตัวเลขต้องเป็นจำนวนเต็มหรือทศนิยม 1 ตำแหน่ง หน่วยคือ kcal สำหรับ calories และ กรัม สำหรับที่เหลือ
ถ้าไม่รู้จักอาหารนี้ ให้ตอบ: {"error": "unknown"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI response was not valid JSON" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.error === "unknown") {
      return NextResponse.json(
        { error: "ไม่รู้จักอาหารนี้ กรุณากรอกค่าโภชนาการเอง" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      calories: Number(parsed.calories) || 0,
      protein: Number(parsed.protein) || 0,
      carbs: Number(parsed.carbs) || 0,
      fat: Number(parsed.fat) || 0,
    });
  } catch (err) {
    console.error("Estimate nutrition error:", err);
    return NextResponse.json(
      { error: "Failed to estimate nutrition" },
      { status: 500 }
    );
  }
}
