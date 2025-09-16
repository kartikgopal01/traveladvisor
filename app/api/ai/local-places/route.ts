import { NextResponse } from "next/server";
import { getGenerativeModel } from "@/lib/gemini";
import { generateMapsSearchUrl } from "@/lib/maps";

// Simple in-memory cache for 5 minutes
const cache = new Map<string, { expiry: number; value: any }>();

function toCityFromText(text: string): string | null {
  const m = text.match(/City:\s*([^\n]+)/i) || text.match(/Nearest City:\s*([^\n]+)/i);
  return m ? m[1].trim() : null;
}

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const city = searchParams.get("city");
  const count = Number(searchParams.get("count") || 6);

  const cacheKey = city ? `city:${city.toLowerCase()}:${count}` : (lat && lng ? `ll:${lat},${lng}:${count}` : "");
  if (cacheKey) {
    const c = cache.get(cacheKey);
    if (c && c.expiry > Date.now()) {
      return NextResponse.json(c.value);
    }
  }

  const model = getGenerativeModel();

  const locationText = city ? `City: ${city}` : (lat && lng ? `Coordinates: ${lat},${lng}` : "");
  if (!locationText) {
    return NextResponse.json({ error: "Provide city or lat/lng" }, { status: 400 });
  }

  const prompt = `You are a local travel expert. List ${count} famous places in this location. ${locationText}
Return strict JSON with this schema:
{
  "city": string,
  "places": [
    { "title": string, "description": string, "wikipediaTitle": string }
  ]
}
Use accurate local names for wikipediaTitle suitable for Wikipedia search.`;

  let json: any = null;
  try {
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = result.response.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = { city: toCityFromText(text) || city || null, places: [] };
    }
  } catch (e) {
    // Fallback: Try reverse geocoding if only lat/lng provided, then Wikipedia search
    let fallbackCity = city || "";
    if (!fallbackCity && lat && lng) {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=10&addressdetails=1`, { headers: { "User-Agent": "traveladvisor/1.0" } });
        const g: any = await r.json();
        const addr = g?.address || {};
        fallbackCity = addr.city || addr.town || addr.village || addr.county || addr.state || "";
      } catch {}
    }
    // If still no city, return soft 200 with empty list to avoid client error state
    if (!fallbackCity) {
      return NextResponse.json({ city: null, places: [] });
    }
    try {
      const search = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(fallbackCity + " tourist attractions India")}&format=json&srlimit=${count}`);
      const sdata = await search.json();
      const places = (sdata?.query?.search || []).slice(0, count).map((s: any) => ({ title: s.title, description: s.snippet?.replace(/<[^>]+>/g, "") || "", wikipediaTitle: s.title }));
      json = { city: fallbackCity, places };
    } catch {
      return NextResponse.json({ error: "Failed to fetch places" }, { status: 500 });
    }
  }

  const places = Array.isArray(json?.places) ? json.places.slice(0, count) : [];
  const cityName = json?.city || city || null;
  const enriched = await Promise.all(
    places.map(async (p: any) => {
      const title = String(p?.title || "").trim();
      const wikiTitle = String(p?.wikipediaTitle || title).trim();
      const image = await fetchWikiImage(wikiTitle);
      const mapsQuery = [title, cityName, "India"].filter(Boolean).join(", ");
      return {
        title,
        description: String(p?.description || "").trim(),
        imageUrl: image,
        wikiTitle,
        mapsUrl: generateMapsSearchUrl(mapsQuery),
      };
    })
  );

  const payload = { city: cityName, places: enriched };
  if (cacheKey) cache.set(cacheKey, { expiry: Date.now() + 5 * 60 * 1000, value: payload });
  return NextResponse.json(payload);
}


