import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getGenerativeModel } from "@/lib/gemini";
import { getGroqClient, getGroqModel } from "@/lib/groq";
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
    days, 
    travelers, 
    budget,
    travelStyle = "balanced",
    accommodationType = "hotel",
    transportationType = "mix",
    vehicleType,
    vehicleMileage,
    fuelType,
    fuelCostPerLiter,
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

  // Calculate accurate budget based on all factors
  let calculatedBudget = budget;
  let budgetBreakdown = null;
  let vehicleCostInfo = "";
  
  if (!budget) {
    // Auto-calculate budget based on all factors
    const calculatedDays = days || Math.max(3, places.length); // Minimum 3 days or based on destinations
    const calculatedTravelers = travelers || 2; // Default 2 travelers
    
    // Base budget per person per day based on travel style
    let baseBudgetPerPersonPerDay = 0;
    switch (travelStyle) {
      case "budget": baseBudgetPerPersonPerDay = 1500; break;
      case "balanced": baseBudgetPerPersonPerDay = 2500; break;
      case "luxury": baseBudgetPerPersonPerDay = 5000; break;
      case "adventure": baseBudgetPerPersonPerDay = 3000; break;
      default: baseBudgetPerPersonPerDay = 2500;
    }
    
    // Calculate base budget
    const baseBudget = baseBudgetPerPersonPerDay * calculatedDays * calculatedTravelers;
    
    // Calculate accommodation cost
    let accommodationCost = 0;
    if (accommodationType !== "na") {
      let accommodationPerNight = 0;
      switch (accommodationType) {
        case "budget-hotel": accommodationPerNight = 1500; break;
        case "hotel": accommodationPerNight = 3000; break;
        case "boutique": accommodationPerNight = 5000; break;
        case "resort": accommodationPerNight = 8000; break;
        case "homestay": accommodationPerNight = 2000; break;
        default: accommodationPerNight = 3000;
      }
      accommodationCost = accommodationPerNight * calculatedDays;
    }
    
    // Calculate transportation cost
    let transportationCost = 0;
    if (transportationType === "own-vehicle" && vehicleType && vehicleMileage && fuelType && fuelCostPerLiter) {
      // Calculate fuel cost based on vehicle details
      const fuelCost = parseFloat(fuelCostPerLiter);
      const mileage = parseFloat(vehicleMileage);
      const estimatedDistance = calculatedDays * 200; // Average 200km per day
      const fuelNeeded = estimatedDistance / mileage;
      transportationCost = Math.round(fuelNeeded * fuelCost);
      
      vehicleCostInfo = `\nVehicle Details: ${vehicleType}, ${vehicleMileage} km/liter, ${fuelType}\nFuel Cost: ₹${fuelCost}/liter\nEstimated Distance: ${estimatedDistance}km\nTotal Fuel Cost: ₹${transportationCost.toLocaleString()}`;
    } else if (transportationType !== "na") {
      // Calculate transportation cost based on type
      let transportPerPersonPerDay = 0;
      switch (transportationType) {
        case "train": transportPerPersonPerDay = 500; break;
        case "bus": transportPerPersonPerDay = 300; break;
        case "car": transportPerPersonPerDay = 2000; break;
        case "flight": transportPerPersonPerDay = 3000; break;
        case "mix": transportPerPersonPerDay = 1000; break;
        default: transportPerPersonPerDay = 1000;
      }
      transportationCost = transportPerPersonPerDay * calculatedDays * calculatedTravelers;
    }
    
    // Calculate food cost
    let foodCostPerPersonPerDay = 0;
    switch (travelStyle) {
      case "budget": foodCostPerPersonPerDay = 500; break;
      case "balanced": foodCostPerPersonPerDay = 800; break;
      case "luxury": foodCostPerPersonPerDay = 2000; break;
      case "adventure": foodCostPerPersonPerDay = 1000; break;
      default: foodCostPerPersonPerDay = 800;
    }
    const foodCost = foodCostPerPersonPerDay * calculatedDays * calculatedTravelers;
    
    // Calculate attractions cost
    let attractionsCostPerPersonPerDay = 0;
    switch (travelStyle) {
      case "budget": attractionsCostPerPersonPerDay = 300; break;
      case "balanced": attractionsCostPerPersonPerDay = 600; break;
      case "luxury": attractionsCostPerPersonPerDay = 1500; break;
      case "adventure": attractionsCostPerPersonPerDay = 1000; break;
      default: attractionsCostPerPersonPerDay = 600;
    }
    const attractionsCost = attractionsCostPerPersonPerDay * calculatedDays * calculatedTravelers;
    
    // Calculate miscellaneous cost (10% of total)
    const miscellaneousCost = Math.round((accommodationCost + transportationCost + foodCost + attractionsCost) * 0.1);
    
    // Total calculated budget
    calculatedBudget = accommodationCost + transportationCost + foodCost + attractionsCost + miscellaneousCost;
    
    // Create budget breakdown
    budgetBreakdown = {
      accommodation: accommodationCost,
      transportation: transportationCost,
      food: foodCost,
      attractions: attractionsCost,
      miscellaneous: miscellaneousCost,
      total: calculatedBudget
    };
  }

  const prompt = `You are an expert Indian travel planner. Generate a comprehensive trip plan for visiting ${placesList} in India.
  
${days ? `Duration: ${days} days` : "Duration: Auto-calculate based on destinations"}
${travelers ? `Travelers: ${travelers} people` : "Travelers: Auto-calculate"}
${budget ? `Budget: ₹${budget.toLocaleString()} INR` : `Budget: ₹${calculatedBudget.toLocaleString()} INR (auto-calculated)`}
Travel Style: ${travelStyle}
Accommodation: ${accommodationType === "na" ? "Not needed" : accommodationType}
Transportation: ${transportationType === "na" ? "Not needed" : transportationType}${vehicleCostInfo}

CRITICAL USER PREFERENCES ANALYSIS:
${interestsList ? `🎯 INTERESTS & ACTIVITIES: ${interestsList}
- Prioritize activities that match these interests
- Include specific recommendations for each interest category
- Highlight how each activity relates to user interests` : "🎯 INTERESTS: General sightseeing"}

${dietaryList ? `🍽️ DIETARY RESTRICTIONS: ${dietaryList}
- CRITICAL: All restaurant recommendations MUST accommodate these dietary needs
- Include specific dietary-friendly restaurants and food options
- Mention dietary considerations for each meal suggestion
- Provide alternatives for restricted foods` : "🍽️ DIETARY: No restrictions"}

${accessibilityList ? `♿ ACCESSIBILITY REQUIREMENTS: ${accessibilityList}
- CRITICAL: All activities, accommodations, and transportation must be accessible
- Include wheelchair-accessible venues and routes
- Provide accessibility information for each location
- Suggest accessible alternatives when needed
- Include accessibility tips and considerations` : "♿ ACCESSIBILITY: No special requirements"}

${startDate ? `Start Date: ${startDate}` : ""}
${endDate ? `End Date: ${endDate}` : ""}
${specialRequests ? `Special Requests: ${specialRequests}` : ""}

${budgetBreakdown ? `CALCULATED BUDGET BREAKDOWN:
- Accommodation: ₹${budgetBreakdown.accommodation.toLocaleString()}
- Transportation: ₹${budgetBreakdown.transportation.toLocaleString()}
- Food: ₹${budgetBreakdown.food.toLocaleString()}
- Attractions: ₹${budgetBreakdown.attractions.toLocaleString()}
- Miscellaneous: ₹${budgetBreakdown.miscellaneous.toLocaleString()}
- Total: ₹${budgetBreakdown.total.toLocaleString()}` : ""}

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
          "tips": string,
          "interestMatch": [string],
          "accessibilityInfo": string,
          "dietaryConsiderations": string
        }
      ],
      "meals": [
        {
          "type": string,
          "suggestion": string,
          "cost": number,
          "location": string,
          "dietaryCompliance": [string],
          "accessibilityInfo": string
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
      "bookingUrl": string,
      "accessibilityFeatures": [string],
      "dietaryOptions": [string]
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
      "mapsUrl": string,
      "interestMatch": [string],
      "accessibilityInfo": string
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
      "mapsUrl": string,
      "accessibilityInfo": string,
      "dietaryCompliance": [string]
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
  },
  "preferenceAnalysis": {
    "interestsCoverage": {
      "matchedInterests": [string],
      "coveragePercentage": number,
      "highlights": [string]
    },
    "dietaryCompliance": {
      "restrictions": [string],
      "compliancePercentage": number,
      "dietaryFriendlyVenues": number
    },
    "accessibilityCompliance": {
      "requirements": [string],
      "compliancePercentage": number,
      "accessibleVenues": number,
      "accessibilityTips": [string]
    }
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

CRITICAL PREFERENCE ANALYSIS REQUIREMENTS:
- For each activity, specify which user interests it matches in "interestMatch" array
- For each meal/restaurant, specify dietary compliance in "dietaryCompliance" array
- For each venue, provide accessibility information in "accessibilityInfo" field
- Calculate preference analysis percentages based on user selections
- Highlight how each recommendation specifically addresses user preferences
- Provide alternative options when preferences cannot be fully met
- Include specific tips for dietary restrictions and accessibility needs
- Ensure at least 80% compliance with user preferences when possible

GENERAL REQUIREMENTS:
- Include vegetarian and local food options.
- Provide practical transportation options (trains, buses, cabs, etc.).
- Include safety tips and local customs.
- Consider the specified travel style, accommodation preferences, and accessibility needs.
- Ensure the total cost stays within the specified budget.
- Add navigation tips and local transportation suggestions.`;

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
      vehicleType,
      vehicleMileage,
      fuelType,
      fuelCostPerLiter,
      interests,
      dietaryRestrictions,
      accessibility,
      startDate,
      endDate,
      specialRequests,
      calculatedBudget,
      budgetBreakdown
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


