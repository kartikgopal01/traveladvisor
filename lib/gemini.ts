import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | undefined;

export function getGeminiClient() {
  if (genAI) return genAI;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY env var");
  }
  genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

export function getGenerativeModel(modelName?: string) {
  const client = getGeminiClient();
  // Default to a widely supported v1beta-compatible text model
  const resolved = modelName || process.env.GEMINI_MODEL || "gemini-pro";
  return client.getGenerativeModel({ model: resolved });
}


