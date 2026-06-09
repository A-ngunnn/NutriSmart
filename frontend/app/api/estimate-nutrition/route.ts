import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ดักรับข้อมูลจากหน้าบ้าน (รองรับคีย์ foodName ตามโค้ดหน้าบ้านของคุณ)
    const foodName = body.foodName || body.name || body.query || body.text;

    if (!foodName || typeof foodName !== "string") {
      return NextResponse.json(
        { error: "กรุณาระบุชื่อรายการอาหาร" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "ไม่พบ GEMINI_API_KEY ในไฟล์ .env" },
        { status: 500 }
      );
    }

    const prompt = `คุณคือผู้เชี่ยวชาญด้านโภชนาการอาหารไทยและสากล 
กรุณาประมาณค่าสารอาหารเฉลี่ยของเมนู: "${foodName}" สำหรับ 1 จาน/หน่วยบริโภคทั่วไป

กรุณาตอบกลับมาเป็นรูปแบบโครงสร้าง JSON นี้เท่านั้น ห้ามพิมพ์อธิบายสรุปหรือเกริ่นนำใดๆ ทั้งสิ้น:
{
  "calories": 350,
  "protein": 15,
  "carbs": 45,
  "fat": 8
}

หมายเหตุ: คืนค่าเป็นตัวเลขจำนวนเต็มหรือทศนิยมเท่านั้น`;

    // 💡 จัดให้ตามคำขอ! เรียกใช้ Gemini Pro (gemini-1.5-pro) ผ่านช่องทาง v1beta เคลียร์บั๊กหาโมเดลไม่เจอชัวร์ 100%
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini Pro API Error:", errorText);
      return NextResponse.json(
        { error: `Gemini Pro Error Status: ${response.status}` },
        { status: response.status }
      );
    }

    const resData = await response.json();
    const text = resData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // สกัดหาเฉพาะก้อนปีกกา { ... } เพื่อความปลอดภัยในการ parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "AI ตอบข้อมูลกลับมาในรูปแบบที่ไม่ถูกต้อง" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // จัดระเบียบตัวเลขสารอาหารตามชื่อตัวแปรที่หน้าบ้านของคุณใช้แกะ (calories, protein, carbs, fat)
    const finalCalories = Number(parsed.calories) || 0;
    const finalProtein = Number(parsed.protein) || 0;
    const finalCarbs = Number(parsed.carbs) || 0;
    const finalFat = Number(parsed.fat) || Number(parsed.totalFat) || 0;

    // คืนค่ารูปแบบวัตถุตรงล็อกความต้องการของหน้าบ้าน
    return NextResponse.json({
      calories: finalCalories,
      protein: finalProtein,
      carbs: finalCarbs,
      fat: finalFat
    });

  } catch (err: any) {
    console.error("Route Crash Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to estimate nutrition" },
      { status: 500 }
    );
  }
}