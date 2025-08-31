import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getGenerativeModel } from "@/lib/gemini";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { generateMapsSearchUrl, generateLocationQuery } from "@/lib/maps";

export const runtime = "nodejs";
export const maxDuration = 60;

function sanitizeJsonCandidate(candidate: string) {
  let txt = candidate
    .replace(/^```[a-zA-Z]*\s*/g, "")
    .replace(/```\s*$/g, "");
  txt = txt.replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"').replace(/[\u2018\u2019\u201B]/g, "'");
  txt = txt.replace(/,(\s*[}\]])/g, "$1");
  return txt;
}

function extractJson(text: string) {
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  const stripped = text.replace(/^```[a-zA-Z]*\s*/g, "").replace(/```\s*$/g, "");
  const direct = tryParse(sanitizeJsonCandidate(stripped));
  if (direct) return direct;
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = stripped.slice(start, end + 1);
    const repaired = sanitizeJsonCandidate(candidate);
    return tryParse(repaired);
  }
  return null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { 
    budgetINR, 
    days = 3, 
    origin,
    travelStyle = "balanced",
    interests = [],
    preferredSeason,
    groupSize = 2
  } = await request.json();
  
  if (!budgetINR) return NextResponse.json({ error: "Missing budgetINR" }, { status: 400 });

  const interestsList = Array.isArray(interests) ? interests.join(", ") : interests.join(", ");

  const prompt = `You are an expert Indian travel planner. Suggest 5 diverse destinations in India that fit within a total budget of ₹${budgetINR.toLocaleString()} INR for a ${days}-day trip${origin ? ` starting from ${origin}` : ""}.

Travel Style: ${travelStyle}
Interests: ${interestsList || "General sightseeing"}
Preferred Season: ${preferredSeason || "Any"}
Group Size: ${groupSize} travelers

Return JSON with this exact schema:
{
  "suggestions": [
    {
      "destination": string,
      "state": string,
      "region": string,
      "bestTimeToVisit": string,
      "estimatedCost": number,
      "budgetCategory": "budget" | "mid-range" | "luxury",
      "highlights": [string],
      "breakdown": {
        "flights": number,
        "accommodation": number,
        "food": number,
        "localTransport": number,
        "attractions": number,
        "miscellaneous": number
      },
      "samplePlan": {
        "roadmap": [
          {
            "day": number,
            "summary": string,
            "activities": [
              {
                "time": string,
                "title": string,
                "description": string,
                "mapsUrl": string
              }
            ]
          }
        ],
        "accommodations": [
          {
            "name": string,
            "type": string,
            "pricePerNight": number,
            "location": string,
            "mapsUrl": string
          }
        ],
        "attractions": [
          {
            "name": string,
            "description": string,
            "entryFee": number,
            "mapsUrl": string
          }
        ],
        "restaurants": [
          {
            "name": string,
            "cuisine": string,
            "priceRange": string,
            "mapsUrl": string
          }
        ]
      },
      "transportation": {
        "toDestination": {
          "mode": string,
          "duration": string,
          "cost": number,
          "tips": string
        },
        "withinDestination": {
          "options": [
            {
              "mode": string,
              "description": string,
              "cost": number
            }
          ]
        }
      },
      "localTips": [string],
      "safetyNotes": [string],
      "culturalNotes": [string]
    }
  ]
}

Rules:
- Only valid JSON output, no markdown.
- Generate detailed Google Maps URLs for all locations and activities.
- Use format: https://www.google.com/maps/search/?api=1&query=<place name>, <city>, <state>, India
- Include specific location details for accurate mapping
- For accommodations: Include area/neighborhood for precise location
- For restaurants: Include locality for better location accuracy
- For activities: Include venue names and addresses when available
- Provide transportation routes and directions between locations
- Include estimated travel times for local transportation
- Ensure estimatedCost <= ${budgetINR} for each suggestion.
- Include diverse destinations across different regions of India.
- Consider the specified travel style and interests.
- Provide realistic costs in Indian Rupees (INR).
- Include both popular and offbeat destinations.
- Consider seasonal factors and local festivals.
- Provide practical transportation options with route suggestions.
- Include safety and cultural considerations.
- Add navigation tips and local area information.`;

  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }
    const model = getGenerativeModel();
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = result.response.text();

    const parsed = extractJson(text);
    if (!parsed?.suggestions) {
      console.error("AI invalid JSON (suggest)", text);
      return NextResponse.json({ error: "AI returned invalid JSON", raw: text }, { status: 502 });
    }

    const db = getAdminDb();
    const input: any = { 
      budgetINR, 
      days,
      origin,
      travelStyle,
      interests,
      preferredSeason,
      groupSize
    };
    
    const doc = await db.collection("trips").add({
      userId,
      type: "suggest",
      input,
      result: parsed,
      createdAt: Date.now(),
    });

    return NextResponse.json({ id: doc.id, suggestions: parsed });
  } catch (err: any) {
    console.error("Suggest generation failed", err);
    return NextResponse.json({ error: "Generation failed", details: String(err?.message || err) }, { status: 500 });
  }
}


