import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChromaClient } from "chromadb";

export class RagAgent {
  private genAI: GoogleGenerativeAI;
  private chromaClient: ChromaClient;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.chromaClient = new ChromaClient({ path: "http://localhost:8000" });
  }

  /**
   * ดึงข้อมูล Context จาก Chroma DB ที่เกี่ยวข้องกับคำถาม
   */
  async retrieveContext(prompt: string): Promise<string> {
    try {
      const collection = await this.chromaClient.getCollection({ name: "nutri_knowledge" });
      
      // แปลงคำถามให้เป็น Vector (Embedding)
      const embedModel = this.genAI.getGenerativeModel({ model: "text-embedding-004" });
      const queryEmbedResult = await embedModel.embedContent(prompt);
      const queryVector = queryEmbedResult.embedding.values;

      // ค้นหาข้อมูลที่ตรงกันที่สุด 3 อันดับแรก
      const results = await collection.query({
        queryEmbeddings: [queryVector],
        nResults: 3,
      });

      if (results.documents[0] && results.documents[0].length > 0) {
        return results.documents[0].join("\n\n");
      }
    } catch (err) {
      console.error("ChromaDB Error (RAG Skipped):", err);
    }
    return "";
  }

  /**
   * รวมคำถามของผู้ใช้เข้ากับความรู้ที่ดึงมาจากฐานข้อมูล
   */
  async buildPromptWithContext(userPrompt: string): Promise<string> {
    const context = await this.retrieveContext(userPrompt);
    
    // โครงสร้าง Prompt Template ตามคำแนะนำของกรรมการ
    return `[Context - ข้อมูลอ้างอิงที่ดึงมาจาก ChromaDB]
${context ? context : "ไม่มีข้อมูลอ้างอิงเฉพาะเจาะจง ให้ใช้ความรู้พื้นฐานตามหลัก Thai RDI"}

[User Input - ข้อมูลจากหน้าบ้านที่ผู้ใช้กรอก]
${userPrompt}

[Instruction - คำสั่งควบคุม AI]
คุณคือ MedGemma AI ผู้เชี่ยวชาญด้านโภชนาการและการแพทย์ จงวิเคราะห์ข้อมูลที่ผู้ใช้กรอก โดยเปรียบเทียบกับบริบทกฎหมายและเกณฑ์สุขภาพ Thai RDI ที่ให้ไว้ด้านบนอย่างเข้มงวด ห้ามคิดเกณฑ์ขึ้นมาเอง สรุปผลกระทบต่อสุขภาพ และให้คำแนะนำที่เข้าใจง่าย`;
  }
}
