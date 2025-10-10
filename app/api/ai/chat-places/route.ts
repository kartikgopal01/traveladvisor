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
  
  // Extract city/district names from the message if any are mentioned
  const cityPattern = /\b(?:in|at|near|around|from)\s+([A-Za-z\s]+?)(?:\s|$|,|\.)/gi;
  const mentionedCities = [];
  let match;
  while ((match = cityPattern.exec(message)) !== null) {
    const cityName = match[1].trim();
    if (cityName.length > 2 && 
        !cityName.toLowerCase().includes('best') && 
        !cityName.toLowerCase().includes('temple') &&
        !cityName.toLowerCase().includes('restaurant') &&
        !cityName.toLowerCase().includes('beach') &&
        !cityName.toLowerCase().includes('park')) {
      mentionedCities.push(cityName);
    }
  }
  
  // Also check for direct city/district mentions without prepositions
  const directCityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:district|city|state)\b/gi;
  let directMatch;
  while ((directMatch = directCityPattern.exec(message)) !== null) {
    const directCity = directMatch[1].trim();
    if (!mentionedCities.includes(directCity)) {
      mentionedCities.push(directCity);
    }
  }
  
  // Determine the target city - prioritize mentioned cities over detected location
  const targetCity = mentionedCities.length > 0 ? mentionedCities[0] : null;
  
  const locationText = targetCity ? targetCity : (city ? city : 'detected location');
  
  const prompt = `Find real ${message} that actually exist in ${locationText}, India.

LOCATION REQUIREMENTS:
- Return ONLY actual ${message} that are physically located in ${locationText}
- If user mentions a city/district name, show places from that specific location
- If no location mentioned, use the detected location
- These must be real places that people can visit
- Include the actual name of each ${message}

FORBIDDEN:
- Do NOT return administrative areas or general information
- Do NOT return lists, movies, or unrelated content
- Do NOT return places from other locations

EXAMPLES for temples in ${locationText}:
✅ "Shri Rameshwara Temple"
✅ "Lakshmi Narasimha Temple" 
✅ "Ganesha Temple"
✅ "Durga Temple"
❌ "Shivamogga district"
❌ "Karnataka state"
❌ "List of temples"

Return real ${message} from ${locationText}:
{ "places": [ { "title": "Actual Place Name", "description": "Brief description", "wikipediaTitle": "Place Name" } ] }`;

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
      const query = `${message} ${targetCity ? targetCity + ' India' : 'India'}`.trim();
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


