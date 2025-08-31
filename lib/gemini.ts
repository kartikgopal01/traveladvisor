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

export function getGenerativeModel(modelName = "gemini-1.5-flash") {
  const client = getGeminiClient();
  return client.getGenerativeModel({ model: modelName });
}


