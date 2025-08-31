import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getGenerativeModel } from "@/lib/gemini";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { generateMapsSearchUrl, generateLocationQuery, generateTripRoute } from "@/lib/maps";

export const runtime = "nodejs";
export const maxDuration = 60;

function sanitizeJsonCandidate(candidate: string) {
  // Strip code fences and labels
  let txt = candidate
    .replace(/^```[a-zA-Z]*\s*/g, "")
    .replace(/```\s*$/g, "");

  // Normalize quotes (smart quotes → straight)
  txt = txt.replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"').replace(/[\u2018\u2019\u201B]/g, "'");

  // Remove trailing commas before } or ]
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

  // First, remove fences from the whole text
  const stripped = text.replace(/^```[a-zA-Z]*\s*/g, "").replace(/```\s*$/g, "");
  const direct = tryParse(sanitizeJsonCandidate(stripped));
  if (direct) return direct;

  // Fallback: find first { and last }
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
    places, 
    days = 3, 
    travelers = 2, 
    budget = 50000,
    travelStyle = "balanced",
    accommodationType = "hotel",
    transportationType = "mix",
    interests = [],
    dietaryRestrictions = [],
    accessibility = [],
    startDate,
    endDate,
    specialRequests
  } = await request.json();
  
  if (!places || places.length === 0) {
    return NextResponse.json({ error: "Missing places" }, { status: 400 });
  }

  const placesList = Array.isArray(places) ? places.join(", ") : places;
  const interestsList = Array.isArray(interests) ? interests.join(", ") : interests.join(", ");
  const dietaryList = Array.isArray(dietaryRestrictions) ? dietaryRestrictions.join(", ") : dietaryRestrictions.join(", ");
  const accessibilityList = Array.isArray(accessibility) ? accessibility.join(", ") : accessibility.join(", ");

  const prompt = `You are an expert Indian travel planner. Generate a comprehensive ${days}-day trip plan for ${travelers} travelers visiting ${placesList} in India.
  
Budget: ₹${budget.toLocaleString()} INR
Travel Style: ${travelStyle}
Accommodation: ${accommodationType}
Transportation: ${transportationType}
Interests: ${interestsList || "General sightseeing"}
Dietary Restrictions: ${dietaryList || "None"}
Accessibility Needs: ${accessibilityList || "None"}
${startDate ? `Start Date: ${startDate}` : ""}
${endDate ? `End Date: ${endDate}` : ""}
${specialRequests ? `Special Requests: ${specialRequests}` : ""}

Return JSON with this exact schema:
{
  "destinations": [string],
  "days": number,
  "currency": "INR",
  "totalBudget": number,
  "roadmap": [
    {
      "day": number,
      "date": string,
      "summary": string,
      "location": string,
      "activities": [
        {
          "time": string,
          "title": string,
          "description": string,
          "duration": string,
          "cost": number,
          "mapsUrl": string,
          "tips": string
        }
      ],
      "meals": [
        {
          "type": string,
          "suggestion": string,
          "cost": number,
          "location": string
        }
      ],
      "transportation": {
        "mode": string,
        "details": string,
        "cost": number,
        "duration": string
      }
    }
  ],
  "accommodations": [
    {
      "name": string,
      "type": string,
      "location": string,
      "pricePerNight": number,
      "rating": number,
      "amenities": [string],
      "mapsUrl": string,
      "bookingUrl": string
    }
  ],
  "attractions": [
    {
      "name": string,
      "location": string,
      "description": string,
      "entryFee": number,
      "bestTime": string,
      "duration": string,
      "tips": string,
      "mapsUrl": string
    }
  ],
  "restaurants": [
    {
      "name": string,
      "cuisine": string,
      "location": string,
      "priceRange": string,
      "specialties": [string],
      "dietaryOptions": [string],
      "mapsUrl": string
    }
  ],
  "transportation": {
    "summary": string,
    "options": [
      {
        "mode": string,
        "description": string,
        "cost": number,
        "duration": string,
        "tips": string
      }
    ]
  },
  "budgetBreakdown": {
    "accommodation": number,
    "transportation": number,
    "food": number,
    "attractions": number,
    "miscellaneous": number,
    "total": number
  },
  "packingList": [string],
  "localTips": [string],
  "emergencyContacts": {
    "police": string,
    "hospital": string,
    "touristHelpline": string
  }
}

Rules:
- Always provide valid JSON only, no markdown, no commentary.
- Use Indian Rupees (INR) for all costs.
- Generate detailed Google Maps URLs for each location, activity, and accommodation.
- For places: Use format https://www.google.com/maps/search/?api=1&query=<place name>, <city>, <state>, India
- For activities: Include specific location details for accurate mapping
- For accommodations: Include full address when available for precise location
- For restaurants: Include neighborhood/area for better location accuracy
- Provide multiple map options when relevant (directions, street view, etc.)
- Include estimated walking/driving times between locations
- Consider local customs, festivals, and weather.
- Include vegetarian and local food options.
- Provide practical transportation options (trains, buses, cabs, etc.).
- Include safety tips and local customs.
- Consider the specified travel style, accommodation preferences, and accessibility needs.
- Ensure the total cost stays within the specified budget.
- Add navigation tips and local transportation suggestions.`;

  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }
    const model = getGenerativeModel();
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = result.response.text();

    const parsed = extractJson(text);
    if (!parsed?.roadmap || !parsed?.accommodations || !parsed?.attractions) {
      console.error("AI invalid JSON (plan)", text);
      return NextResponse.json({ error: "AI returned invalid JSON", raw: text }, { status: 502 });
    }

    const db = getAdminDb();
    const input: any = { 
      places, 
      days, 
      travelers, 
      budget,
      travelStyle,
      accommodationType,
      transportationType,
      interests,
      dietaryRestrictions,
      accessibility,
      startDate,
      endDate,
      specialRequests
    };
    
    const doc = await db.collection("trips").add({
      userId,
      type: "plan",
      input,
      result: parsed,
      createdAt: Date.now(),
    });

    return NextResponse.json({ id: doc.id, plan: parsed });
  } catch (err: any) {
    console.error("Plan generation failed", err);
    return NextResponse.json({ error: "Generation failed", details: String(err?.message || err) }, { status: 500 });
  }
}


