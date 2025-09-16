import { NextResponse } from "next/server";
import { getGenerativeModel } from "@/lib/gemini";

async function fetchWikiImage(title: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(title)}`);
    const data = await resp.json();
    const pages = data?.query?.pages || {};
    const page = Object.values(pages)[0] as any;
    const img = page?.original?.source;
    return typeof img === "string" ? img : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { message, city, count = 6 } = body || {};
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  const model = getGenerativeModel();
  const prompt = `You are a helpful travel assistant. Based on the user's request, return up to ${count} relevant places with a one-line description.
${city ? `City: ${city}` : "Use the user's implicit location if provided."}
User request: ${message || "Famous places"}
Return strict JSON:
{ "places": [ { "title": string, "description": string, "wikipediaTitle": string } ] }`;

  let places: any[] = [];
  try {
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = result.response.text();
    const json = JSON.parse(text);
    places = Array.isArray(json?.places) ? json.places.slice(0, count) : [];
  } catch {
    places = [];
  }

  // Fallback to Wikipedia search if AI returns nothing
  if (!places || places.length === 0) {
    try {
      const query = `${message} ${city ? city + ' India' : 'India'}`.trim();
      const resp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${count}`);
      const data = await resp.json();
      places = (data?.query?.search || []).slice(0, count).map((s: any) => ({
        title: s.title,
        description: (s.snippet || "").replace(/<[^>]+>/g, ""),
        wikipediaTitle: s.title,
      }));
    } catch {
      // ignore
    }
  }

  const enriched = await Promise.all(
    places.map(async (p: any) => ({
      title: String(p?.title || "").trim(),
      description: String(p?.description || "").trim(),
      imageUrl: await fetchWikiImage(String(p?.wikipediaTitle || p?.title || "").trim()),
    }))
  );

  return NextResponse.json({ places: enriched });
}


