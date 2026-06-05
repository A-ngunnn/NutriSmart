import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";
import { RagAgent } from "@/lib/ai/rag-agent";

// ─── Config ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `คุณคือ "น้อง Nutri" 🌿 ผู้ช่วยด้านโภชนาการส่วนบุคคลที่ขับเคลื่อนด้วย AI 
(อ้างอิงข้อมูลจากหลักการแพทย์, Med Gemma, และ Thai RDI)

เป้าหมายของคุณคือการให้คำปรึกษา แนะนำอาหาร และให้ข้อมูลโภชนาการที่ถูกต้อง ปลอดภัย และอ้างอิงตามเกณฑ์ Thai RDI (Thai Recommended Daily Intakes)

กฎและวิธีการตอบ:
1. ตอบเป็นภาษาไทยเสมอ ใช้ภาษาที่เป็นมิตร เป็นกันเอง (ใช้คำว่า "หนู" แทนตัวเอง และ "คุณ" หรือ "พี่" แทนผู้ใช้)
2. เมื่อผู้ใช้ถามถึงปริมาณสารอาหาร หรือ แคลอรี่ของอาหาร ให้แสดงข้อมูลในรูปแบบนี้เสมอเพื่อให้ระบบตรวจจับได้ง่าย:
   - แคลอรี่: XXX kcal
   - โปรตีน: XX g
   - คาร์บ: XX g
   - ไขมัน: XX g
3. อ้างอิงตาม Context ข้อมูล (Thai RDI หรือความรู้ต่างๆ) ที่แนบไปให้เสมอ หากข้อมูลใน Context ขัดแย้งกับความรู้ทั่วไป ให้เชื่อ Context ก่อน
4. หากผู้ใช้ถามเรื่องที่เกี่ยวข้องกับโรคประจำตัว หรืออาการป่วยที่ซับซ้อน ให้คำแนะนำเบื้องต้นอย่างระมัดระวัง และเตือนเสมอว่า "ข้อมูลนี้ไม่ใช่คำวินิจฉัยทางการแพทย์ โปรดปรึกษาแพทย์หรือนักกำหนดอาหารเพิ่มเติม"
5. จัดหน้าข้อความให้เป็นระเบียบ ใช้ Bullet points (•) ช่วยให้อ่านง่าย`;

// ─── Route ────────────────────────────────────────────────────────────────────

export const runtime = "nodejs"; // เปลี่ยนเป็น nodejs runtime เนื่องจาก ChromaClient ใช้ไลบรารีที่อาจไม่รองรับ Edge

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing GEMINI_API_KEY environment variable" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  // ── 1. Prepare Chat History ──
  let chatHistory = messages.map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const currentMessage = chatHistory.pop();
  let userPrompt = currentMessage?.parts[0].text || "";

  // Gemini history must start with a 'user' turn
  while (chatHistory.length > 0 && chatHistory[0].role === "model") {
    chatHistory.shift();
  }

  // ── 2. RAG Agent: Inject context into prompt ──
  const ragAgent = new RagAgent(apiKey);
  const promptWithContext = await ragAgent.buildPromptWithContext(userPrompt);

  // ── 3. Generate response with Gemini ──
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro",
        systemInstruction: SYSTEM_PROMPT,
      });

      const chat = model.startChat({
        history: chatHistory,
      });

      const result = await chat.sendMessageStream(promptWithContext);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          const sseChunk = `data: ${JSON.stringify({ delta: { text } })}\n\n`;
          await writer.write(encoder.encode(sseChunk));
        }
      }
      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
