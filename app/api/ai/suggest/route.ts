import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getGenerativeModel } from "@/lib/gemini";
import { getGroqClient, getGroqModel } from "@/lib/groq";
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
    preferredLocation,
    includeAccommodation = true,
    travelStyle = "balanced",
    interests = [],
    preferredSeason,
    groupSize = 2
  } = await request.json();
  
  if (!budgetINR) return NextResponse.json({ error: "Missing budgetINR" }, { status: 400 });

  const interestsList = Array.isArray(interests) ? interests.join(", ") : interests.join(", ");

  // Calculate budget allocation
  const budgetPerDay = budgetINR / days;
  const budgetPerPerson = budgetPerDay / groupSize;
  
  // Allocate budget for accommodation if requested
  let accommodationBudget = 0;
  let activityBudget = budgetINR;
  
  if (includeAccommodation) {
    // Allocate 40% of budget for accommodation, 60% for activities
    accommodationBudget = Math.floor(budgetINR * 0.4);
    activityBudget = budgetINR - accommodationBudget;
  }
  
  const accommodationBudgetPerDay = accommodationBudget / days;
  const activityBudgetPerDay = activityBudget / days;
  const activityBudgetPerPerson = activityBudgetPerDay / groupSize;
  
  let numberOfPlaces;
  let accommodationLevel;
  
  if (activityBudgetPerPerson >= 5000) {
    numberOfPlaces = 15; // High budget - many places
    accommodationLevel = "luxury";
  } else if (activityBudgetPerPerson >= 3000) {
    numberOfPlaces = 12; // Medium-high budget
    accommodationLevel = "mid-range to luxury";
  } else if (activityBudgetPerPerson >= 2000) {
    numberOfPlaces = 10; // Medium budget
    accommodationLevel = "mid-range";
  } else if (activityBudgetPerPerson >= 1000) {
    numberOfPlaces = 8; // Low-medium budget
    accommodationLevel = "budget to mid-range";
  } else {
    numberOfPlaces = 6; // Low budget - still more places
    accommodationLevel = "budget";
  }

  const prompt = `You are an expert Indian travel planner. Suggest EXACTLY ${numberOfPlaces} diverse destinations ONLY within ${preferredLocation || 'India'} that fit within a total budget of ₹${budgetINR.toLocaleString()} INR for a ${days}-day trip${origin ? ` starting from ${origin}` : ""}.

IMPORTANT: Generate ${numberOfPlaces} unique destinations - do not repeat similar places. Include variety in:
- Different states/regions within the specified area
- Different types of experiences (beaches, mountains, cities, heritage sites, wildlife, etc.)
- Different budget categories (mix of budget, mid-range, luxury options)
- Different seasons and climates
- Different cultural experiences

CRITICAL REQUIREMENT: ALL suggestions MUST be within ${preferredLocation || 'India'}. Do not suggest destinations outside this area.

Budget Analysis:
- Total Budget: ₹${budgetINR.toLocaleString()}
- Days: ${days}
- Group Size: ${groupSize} travelers
- Include Accommodation: ${includeAccommodation ? 'Yes' : 'No'}
${includeAccommodation ? `- Accommodation Budget: ₹${accommodationBudget.toLocaleString()} (40% of total)` : ''}
${includeAccommodation ? `- Activity Budget: ₹${activityBudget.toLocaleString()} (60% of total)` : ''}
- Activity Budget per person per day: ₹${activityBudgetPerPerson.toFixed(0)}
- Accommodation Level: ${accommodationLevel}
- Number of Places: ${numberOfPlaces} (scaled based on activity budget)
- Preferred Location: ${preferredLocation || 'Anywhere in India'}

Travel Style: ${travelStyle}
Interests: ${interestsList || "General sightseeing"}
Preferred Season: ${preferredSeason || "Any"}
${preferredLocation ? `STRICT LOCATION FILTER: Only suggest destinations in ${preferredLocation}` : ""}

IMPORTANT BUDGET GUIDELINES:
- For budget accommodation (₹${activityBudgetPerPerson.toFixed(0)}/person/day): Focus on hostels, guesthouses, budget hotels
- For mid-range accommodation: Focus on 3-star hotels, homestays, boutique properties
- For luxury accommodation: Focus on 4-5 star hotels, resorts, premium properties
- Adjust number of attractions and activities based on activity budget level
- Include free/low-cost activities for budget travelers
- Include premium experiences for luxury travelers
${includeAccommodation ? `- ACCOMMODATION REQUIREMENTS: Must include specific accommodation suggestions within ₹${accommodationBudgetPerDay.toFixed(0)}/day budget` : ''}
${includeAccommodation ? `- ACCOMMODATION ROUTES: Generate Google Maps routes connecting accommodations to tourist places` : ''}

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
        ],
        "accommodationRoutes": [
          {
            "fromAccommodation": string,
            "toAttraction": string,
            "routeUrl": string,
            "distance": string,
            "duration": string
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
- ${preferredLocation ? `LOCATION RESTRICTION: ALL destinations MUST be within ${preferredLocation} only. Do not suggest any destination outside this area.` : 'Include diverse destinations across different regions of India.'}
- Consider the specified travel style and interests.
- Provide realistic costs in Indian Rupees (INR).
- Include both popular and offbeat destinations within the specified location.
- Consider seasonal factors and local festivals.
- Provide practical transportation options with route suggestions.
- Include safety and cultural considerations.
- Add navigation tips and local area information.
- BUDGET-SPECIFIC REQUIREMENTS:
  * For budget travelers (₹${budgetPerPerson.toFixed(0)}/person/day): Include free attractions, street food, public transport, budget accommodations
  * For mid-range travelers: Include mix of paid/free attractions, local restaurants, private transport options, comfortable accommodations
  * For luxury travelers: Include premium attractions, fine dining, private transport, luxury accommodations
  * Adjust activity costs and accommodation types based on budget level
  * Provide budget-friendly alternatives for expensive activities
  * Include cost-saving tips for each budget level
- LOCATION FILTERING REQUIREMENTS:
  * ${preferredLocation ? `STRICT: Only suggest destinations in ${preferredLocation}` : 'Suggest destinations from various Indian states and regions'}
  * ${preferredLocation ? `If ${preferredLocation} is a state, suggest cities/districts within that state only` : ''}
  * ${preferredLocation ? `If ${preferredLocation} is a district/city, suggest places within that district/city only` : ''}
  * ${preferredLocation ? `Do not suggest destinations from other states or regions` : ''}`;

  try {
    let text = "";
    if (process.env.GROQ_API_KEY) {
      const groq = getGroqClient();
      const model = getGroqModel();
      const chat = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "You are a helpful travel planner that outputs only JSON per the user's schema." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      });
      text = chat.choices?.[0]?.message?.content || "";
    } else {
      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: "Missing GROQ_API_KEY or GEMINI_API_KEY" }, { status: 500 });
      }
      const model = getGenerativeModel();
      const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
      text = result.response.text();
    }

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
      preferredLocation,
      includeAccommodation,
      travelStyle,
      interests,
      preferredSeason,
      groupSize,
      budgetAnalysis: {
        budgetPerDay,
        budgetPerPerson,
        accommodationBudget,
        activityBudget,
        accommodationBudgetPerDay,
        activityBudgetPerDay,
        activityBudgetPerPerson,
        numberOfPlaces,
        accommodationLevel
      }
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


