import { ChromaClient } from "chromadb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY in .env.local");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

async function getEmbedding(text: string): Promise<number[]> {
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function main() {
  console.log("Initializing ChromaDB Client...");
  // Connect to local ChromaDB server (default port 8000)
  const client = new ChromaClient({ path: "http://localhost:8000" });

  try {
    // Check if server is up
    await client.heartbeat();
    console.log("Connected to ChromaDB server.");
  } catch (err) {
    console.error("Failed to connect to ChromaDB server at http://localhost:8000.");
    console.error("Make sure you are running ChromaDB via Docker: docker run -p 8000:8000 chromadb/chroma");
    process.exit(1);
  }

  // Load knowledge file
  const knowledgePath = path.join(process.cwd(), "knowledge", "thai-rdi.json");
  const dataRaw = fs.readFileSync(knowledgePath, "utf-8");
  const items = JSON.parse(dataRaw);

  console.log(`Loaded ${items.length} items from knowledge base.`);

  // Get or Create Collection
  const collectionName = "nutri_knowledge";
  console.log(`Getting or creating collection: ${collectionName}`);
  
  // Try to delete if exists to start fresh (for demo purposes)
  try {
    await client.deleteCollection({ name: collectionName });
  } catch (e) {
    // Ignore if not found
  }

  const collection = await client.createCollection({
    name: collectionName,
    metadata: { "hnsw:space": "cosine" },
  });

  const ids: string[] = [];
  const embeddings: number[][] = [];
  const documents: string[] = [];
  const metadatas: any[] = [];

  for (const item of items) {
    console.log(`Embedding: ${item.topic}...`);
    // Create a combined text for embedding
    const textToEmbed = `หัวข้อ: ${item.topic}\nข้อมูล: ${item.content}`;
    
    const vector = await getEmbedding(textToEmbed);

    ids.push(item.id);
    embeddings.push(vector);
    documents.push(textToEmbed);
    metadatas.push({ topic: item.topic });
  }

  console.log("Saving to ChromaDB...");
  await collection.add({
    ids,
    embeddings,
    documents,
    metadatas,
  });

  console.log("Successfully ingested data into ChromaDB!");
}

main().catch(console.error);
