import Groq from "groq-sdk";

let client: Groq | undefined;

export function getGroqClient() {
  if (client) return client;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY env var");
  client = new Groq({ apiKey });
  return client;
}

export function getGroqModel() {
  // Default to a currently supported Groq model; override with GROQ_MODEL
  return process.env.GROQ_MODEL || "llama-3.1-8b-instant";
}


