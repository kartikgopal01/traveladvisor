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
  
  // Replace smart quotes with regular quotes
  txt = txt.replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"').replace(/[\u2018\u2019\u201B]/g, "'");
  
  // Remove trailing commas before closing brackets/braces
  txt = txt.replace(/,(\s*[}\]])/g, "$1");
  
  // Fix common JSON issues
  txt = txt.replace(/\n/g, " "); // Replace newlines with spaces
  txt = txt.replace(/\s+/g, " "); // Normalize whitespace
  
  // Fix unescaped quotes in strings
  txt = txt.replace(/"([^"]*)"([^"]*)"([^"]*)"/g, (match, p1, p2, p3) => {
    return `"${p1}\\"${p2}\\"${p3}"`;
  });
  
  // Remove any non-JSON content before the first { and after the last }
  const firstBrace = txt.indexOf('{');
  const lastBrace = txt.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    txt = txt.substring(firstBrace, lastBrace + 1);
  }
  
  return txt.trim();
}

function extractJson(text: string) {
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch (error) {
      console.log("JSON parse error:", error);
      return null;
    }
  };

  // First, try to clean and parse the entire text
  const cleaned = sanitizeJsonCandidate(text);
  let parsed = tryParse(cleaned);
  if (parsed) return parsed;

  // Try to find JSON within the text
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const jsonCandidate = text.substring(jsonStart, jsonEnd + 1);
    const sanitized = sanitizeJsonCandidate(jsonCandidate);
    parsed = tryParse(sanitized);
    if (parsed) return parsed;
  }

  // Try multiple extraction strategies
  const strategies = [
    // Strategy 1: Look for complete JSON object
    () => {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? tryParse(sanitizeJsonCandidate(match[0])) : null;
    },
    
    // Strategy 2: Look for suggestions array specifically
    () => {
      const match = text.match(/"suggestions"\s*:\s*\[[\s\S]*\]/);
      if (match) {
        const wrapped = `{${match[0]}}`;
        return tryParse(sanitizeJsonCandidate(wrapped));
      }
      return null;
    },
    
    // Strategy 3: Try to fix common JSON issues manually
    () => {
      let fixed = text
        .replace(/^```[a-zA-Z]*\s*/g, "")
        .replace(/```\s*$/g, "")
        .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
        .replace(/[\u2018\u2019\u201B]/g, "'")
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ");
      
      // Try to extract just the JSON part
      const start = fixed.indexOf('{');
      const end = fixed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
        fixed = fixed.substring(start, end + 1);
      }
      
      return tryParse(fixed);
    },
    
    // Strategy 4: More aggressive JSON repair
    () => {
      let fixed = text;
      
      // Remove any text before the first { and after the last }
      const firstBrace = fixed.indexOf('{');
      const lastBrace = fixed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        fixed = fixed.substring(firstBrace, lastBrace + 1);
      }
      
      // Fix common JSON issues
      fixed = fixed
        .replace(/^```[a-zA-Z]*\s*/g, "")
        .replace(/```\s*$/g, "")
        .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
        .replace(/[\u2018\u2019\u201B]/g, "'")
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/\n/g, " ")
        .replace(/\r/g, " ")
        .replace(/\t/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      
      // Try to fix unescaped quotes in strings
      fixed = fixed.replace(/"([^"]*)"([^"]*)"([^"]*)"/g, (match, p1, p2, p3) => {
        return `"${p1}\\"${p2}\\"${p3}"`;
      });
      
      // Try to fix incomplete JSON by adding missing closing brackets
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;
      
      if (openBraces > closeBraces) {
        fixed += '}'.repeat(openBraces - closeBraces);
      }
      if (openBrackets > closeBrackets) {
        fixed += ']'.repeat(openBrackets - closeBrackets);
      }
      
      return tryParse(fixed);
    },
    
    // Strategy 5: Extract and reconstruct JSON from suggestions array
    () => {
      const suggestionsMatch = text.match(/"suggestions"\s*:\s*\[([\s\S]*?)\]/);
      if (suggestionsMatch) {
        try {
          const suggestionsArray = JSON.parse(`[${suggestionsMatch[1]}]`);
          return { suggestions: suggestionsArray };
        } catch (e) {
          // Try to fix the array content
          let arrayContent = suggestionsMatch[1];
          arrayContent = arrayContent
            .replace(/,(\s*[}\]])/g, "$1")
            .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
            .replace(/[\u2018\u2019\u201B]/g, "'");
          
          try {
            const suggestionsArray = JSON.parse(`[${arrayContent}]`);
            return { suggestions: suggestionsArray };
          } catch (e2) {
            return null;
          }
        }
      }
      return null;
    },
    
    // Strategy 6: Handle truncated responses with aggressive extraction
    () => {
      // Check if response appears to be truncated
      if (text.includes("bud...") || text.includes("budg...") || 
          text.endsWith("...") || text.endsWith("bud") || text.endsWith("budg") ||
          text.length > 25000 || !text.trim().endsWith("}")) {
        
        console.log("Attempting to repair truncated JSON response");
        
        // Try multiple patterns to find suggestion objects
        const patterns = [
          /\{[^{}]*"destination"[^{}]*\}/g,
          /\{[^}]*"destination"[^}]*\}/g,
          /\{[^}]*"destination"[^}]*\}/g
        ];
        
        for (const pattern of patterns) {
          const matches = text.match(pattern);
          if (matches && matches.length > 0) {
            const suggestions = [];
            for (const match of matches) {
              try {
                let cleaned = match
                  .replace(/,(\s*[}\]])/g, "$1")
                  .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
                  .replace(/[\u2018\u2019\u201B]/g, "'")
                  .replace(/\n/g, " ")
                  .replace(/\r/g, " ")
                  .replace(/\t/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
                
                // Ensure the object is properly closed
                if (!cleaned.endsWith('}')) {
                  cleaned += '}';
                }
                
                const parsed = JSON.parse(cleaned);
                if (parsed.destination) {
                  suggestions.push(parsed);
                }
              } catch (e) {
                console.log("Skipping malformed suggestion:", match.substring(0, 100));
                continue;
              }
            }
            
            if (suggestions.length > 0) {
              console.log(`Successfully extracted ${suggestions.length} suggestions from truncated response`);
              return { suggestions };
            }
          }
        }
      }
      return null;
    },
    
    // Strategy 7: Handle incomplete JSON arrays due to truncation
    () => {
      // Look for incomplete suggestions array that was cut off
      const suggestionsMatch = text.match(/"suggestions"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
      if (suggestionsMatch) {
        let arrayContent = suggestionsMatch[1];
        
        // Try to extract individual complete objects from the array
        const objectPattern = /\{[^{}]*"destination"[^{}]*\}/g;
        const matches = arrayContent.match(objectPattern);
        
        if (matches && matches.length > 0) {
          const suggestions = [];
          for (const match of matches) {
            try {
              let cleaned = match
                .replace(/,(\s*[}\]])/g, "$1")
                .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
                .replace(/[\u2018\u2019\u201B]/g, "'")
                .replace(/\n/g, " ")
                .replace(/\r/g, " ")
                .replace(/\t/g, " ")
                .replace(/\s+/g, " ")
                .trim();
              
              if (!cleaned.endsWith('}')) {
                cleaned += '}';
              }
              
              const parsed = JSON.parse(cleaned);
              if (parsed.destination) {
                suggestions.push(parsed);
              }
            } catch (e) {
              continue;
            }
          }
          
          if (suggestions.length > 0) {
            console.log(`Successfully extracted ${suggestions.length} suggestions from incomplete array`);
            return { suggestions };
          }
        }
      }
      return null;
    }
  ];

  for (const strategy of strategies) {
    const result = strategy();
    if (result) return result;
  }

  // Final fallback: Try to extract individual suggestion objects
  try {
    // Try multiple patterns to find suggestion objects
    const patterns = [
      /\{[^{}]*"destination"[^{}]*\}/g,  // Simple pattern
      /\{[^{}]*"destination"[^{}]*\}/g,  // More permissive
      /\{[^}]*"destination"[^}]*\}/g,    // Even more permissive
      /\{[^}]*"destination"[^}]*\}/g     // Most permissive for truncated responses
    ];
    
    for (const pattern of patterns) {
      const suggestionMatches = text.match(pattern);
      if (suggestionMatches && suggestionMatches.length > 0) {
        const suggestions = [];
        for (const match of suggestionMatches) {
          try {
            let cleaned = match
              .replace(/,(\s*[}\]])/g, "$1")
              .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
              .replace(/[\u2018\u2019\u201B]/g, "'")
              .replace(/\n/g, " ")
              .replace(/\r/g, " ")
              .replace(/\t/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            
            // Try to complete incomplete JSON objects
            if (!cleaned.endsWith('}')) {
              cleaned += '}';
            }
            
            const parsed = JSON.parse(cleaned);
            if (parsed.destination) {
              suggestions.push(parsed);
            }
          } catch (e) {
            // Skip this suggestion if it can't be parsed
            continue;
          }
        }
        
        if (suggestions.length > 0) {
          console.log(`Successfully extracted ${suggestions.length} suggestions using fallback method`);
          return { suggestions };
        }
      }
    }
  } catch (e) {
    console.error("Fallback extraction failed:", e);
  }

  console.error("Failed to extract valid JSON from:", text.substring(0, 500) + "...");
  return null;
}

function extractFallbackSuggestions(text: string): any[] {
  const suggestions: any[] = [];
  
  // Try to extract individual suggestion objects using multiple patterns
  const patterns = [
    /\{[^{}]*"destination"[^{}]*\}/g,
    /\{[^}]*"destination"[^}]*\}/g,
    /\{[^}]*"destination"[^}]*\}/g
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        try {
          let cleaned = match
            .replace(/,(\s*[}\]])/g, "$1")
            .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
            .replace(/[\u2018\u2019\u201B]/g, "'")
            .replace(/\n/g, " ")
            .replace(/\r/g, " ")
            .replace(/\t/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          
          if (!cleaned.endsWith('}')) {
            cleaned += '}';
          }
          
          const parsed = JSON.parse(cleaned);
          if (parsed.destination && !suggestions.find(s => s.destination === parsed.destination)) {
            suggestions.push(parsed);
          }
        } catch (e) {
          continue;
        }
      }
      
      if (suggestions.length > 0) {
        break; // Stop if we found suggestions with this pattern
      }
    }
  }
  
  return suggestions;
}

async function retryWithMinimalSchema(request: Request, maxPlaces: number) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { 
    budgetINR, 
    days = 3, 
    preferredLocation,
    includeAccommodation = true,
    travelStyle = "balanced",
    interests = [],
    preferredSeason,
    groupSize = 2
  } = await request.json();
  
  if (!budgetINR) return NextResponse.json({ error: "Missing budgetINR" }, { status: 400 });

  const interestsList = Array.isArray(interests) ? interests.join(", ") : interests.join(", ");

  const prompt = `You are an expert Indian travel planner. Suggest EXACTLY ${maxPlaces} destinations ONLY within ${preferredLocation || 'India'} that fit within a total budget of ₹${budgetINR.toLocaleString()} INR for a ${days}-day trip.

Return JSON with this MINIMAL FRONTEND-COMPATIBLE schema:
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
      "transportation": {
        "toDestination": {
          "mode": string,
          "duration": string,
          "cost": number,
          "tips": string
        },
        "availableOptions": [
          {
            "mode": string,
            "duration": string,
            "cost": number,
            "description": string,
            "tips": string
          }
        ]
      },
      "localTips": [string]
    }
  ]
}

CRITICAL: Output ONLY valid JSON. No markdown, no explanations. Keep responses very concise.

TRANSPORTATION COST REQUIREMENTS:
- ALWAYS provide realistic transportation costs - never use ₹0
- For flights: ₹3,000-15,000 depending on distance and budget level
- For trains: ₹500-3,000 depending on class and distance
- For buses: ₹200-1,500 depending on distance and type
- For taxis/cabs: ₹500-2,000 per day depending on usage
- For self-drive: ₹1,000-3,000 per day including fuel and rental
- STARTING LOCATION TRAVEL: If origin is provided, include realistic travel costs from ${origin} to destination
- EXCLUDE UNAVAILABLE COSTS: If transportation mode is not available or not applicable, exclude it from breakdown
- BUDGET ALLOCATION: Ensure total estimatedCost includes travel from starting location if specified
- MULTIPLE TRANSPORTATION OPTIONS: Provide 3-4 different transportation options in availableOptions array
- TRANSPORTATION VARIETY: Include flights, trains, buses, taxis, self-drive options where applicable
- COST COMPARISON: Show different price ranges for different comfort levels and speeds
- SPECIFIC ROUTE REQUIREMENTS: For each transportation option, provide EXACT duration and cost from ${origin || 'starting location'} to the specific destination (${preferredLocation || 'destination state/district'})
- ROUTE-SPECIFIC DETAILS: Each option must show "Duration: X hours" and "Cost: ₹X" for the specific route from origin to destination
- EXACT FORMAT REQUIREMENTS: 
  - duration field must be in format "X hours" or "X hours Y minutes" (e.g., "2 hours", "8 hours 30 minutes")
  - cost field must be a number (e.g., 4500, 1200, 800)
  - NEVER use ₹0 for cost - always provide realistic costs
  - Include route-specific information in description field
- CRITICAL COST REQUIREMENTS:
  - Flights: Minimum ₹3,000, Maximum ₹15,000 (NEVER use 0)
  - Trains: Minimum ₹400, Maximum ₹3,000 (NEVER use 0)
  - Buses: Minimum ₹200, Maximum ₹1,500 (NEVER use 0)
  - Taxis: Minimum ₹500, Maximum ₹2,000 (NEVER use 0)
  - Self-Drive: Minimum ₹1,000, Maximum ₹3,000 (NEVER use 0)
  - If cost is 0, use minimum cost for that transportation mode`;

  try {
    let text = "";
    if (process.env.GROQ_API_KEY) {
      const groq = getGroqClient();
      const model = getGroqModel();
      const chat = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "You are a helpful travel planner that outputs ONLY valid JSON. Never use markdown formatting, code blocks, or any text outside the JSON structure. Always validate your JSON before responding." },
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
      console.error("Minimal schema retry also failed");
      return NextResponse.json({ 
        error: "AI returned invalid JSON even with minimal schema", 
        raw: text.substring(0, 1000)
      }, { status: 502 });
    }

    return NextResponse.json({ 
      suggestions: parsed.suggestions,
      warning: "Used minimal schema due to previous truncation",
      schemaUsed: "minimal"
    });
  } catch (err: any) {
    console.error("Minimal schema retry failed", err);
    return NextResponse.json({ error: "Retry failed", details: String(err?.message || err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { 
    budgetINR, 
    days = 3, 
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
    // Allocate 40% of remaining budget for accommodation, 60% for activities
    accommodationBudget = Math.floor(activityBudget * 0.4);
    activityBudget = activityBudget - accommodationBudget;
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
  
  // Reduce number of places to prevent response truncation
  // AI models often have token limits that can cause truncation
  // Based on the detailed JSON schema, each place generates ~3000-4000 characters
  // Very conservative limit to stay well under 30K character limit
  const maxPlaces = 4; // Extremely conservative limit to prevent truncation
  if (numberOfPlaces > maxPlaces) {
    numberOfPlaces = maxPlaces;
    console.log(`Reduced number of places from original to ${maxPlaces} to prevent truncation`);
  }

  const prompt = `You are an expert Indian travel planner. Suggest EXACTLY ${numberOfPlaces} diverse destinations ONLY within ${preferredLocation || 'India'} that fit within a total budget of ₹${budgetINR.toLocaleString()} INR for a ${days}-day trip.

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
${includeAccommodation ? `- Accommodation Budget: ₹${accommodationBudget.toLocaleString()} (40% of total budget)` : ''}
${includeAccommodation ? `- Activity Budget: ₹${activityBudget.toLocaleString()} (60% of total budget)` : ''}
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

Return JSON with this FRONTEND-COMPATIBLE schema (to prevent truncation):
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
      "transportation": {
        "toDestination": {
          "mode": string,
          "duration": string,
          "cost": number,
          "tips": string
        },
        "availableOptions": [
            {
              "mode": string,
            "duration": string,
            "cost": number,
              "description": string,
            "tips": string
          }
        ]
      },
      "localTips": [string]
    }
  ]
}

CRITICAL JSON FORMATTING RULES:
- Output ONLY valid JSON - no markdown, no code blocks, no explanations
- Start with { and end with }
- Use double quotes for all strings
- No trailing commas
- No comments or extra text outside the JSON
- Ensure all strings are properly escaped
- Validate JSON structure before responding

Rules:
- Only valid JSON output, no markdown.
- Keep responses concise to prevent truncation.
- Ensure estimatedCost <= ${budgetINR} for each suggestion.
- ${preferredLocation ? `LOCATION RESTRICTION: ALL destinations MUST be within ${preferredLocation} only.` : 'Include diverse destinations across different regions of India.'}
- Provide realistic costs in Indian Rupees (INR).
- Consider the specified travel style and interests.
- ROAD TRANSPORTATION COST REQUIREMENTS (NO FLIGHTS):
  * ALWAYS provide realistic road transportation costs - never use ₹0
  * For trains: ₹500-3,000 depending on class and distance  
  * For buses: ₹200-1,500 depending on distance and type
  * For taxis/cabs: ₹500-2,000 per day depending on usage
  * For self-drive: ₹1,000-3,000 per day including fuel and rental
  * For local transport: ₹200-800 per day for city travel
  * Consider distance: Longer distances = higher costs
  * Consider budget level: Luxury travelers pay more for comfort
  * EXCLUDE UNAVAILABLE COSTS: If transportation mode is not available or not applicable, exclude it from breakdown
  * MULTIPLE ROAD TRANSPORTATION OPTIONS: Provide 3-4 different road transportation options in availableOptions array
  * ROAD TRANSPORTATION VARIETY: Include trains, buses, taxis, self-drive options where applicable (NO FLIGHTS)
  * COST COMPARISON: Show different price ranges for different comfort levels and speeds
  * SPECIFIC ROUTE REQUIREMENTS: For each transportation option, provide EXACT duration and cost to the specific destination (${preferredLocation || 'destination state/district'})
  * ROUTE-SPECIFIC DETAILS: Each option must show "Duration: X hours" and "Cost: ₹X" for the specific route to destination
  * EXACT FORMAT REQUIREMENTS: 
    - duration field must be in format "X hours" or "X hours Y minutes" (e.g., "2 hours", "8 hours 30 minutes")
    - cost field must be a number (e.g., 4500, 1200, 800)
    - NEVER use ₹0 for cost - always provide realistic costs
    - Include route-specific information in description field
  * CRITICAL COST REQUIREMENTS:
    - Trains: Minimum ₹400, Maximum ₹3,000 (NEVER use 0)
    - Buses: Minimum ₹200, Maximum ₹1,500 (NEVER use 0)
    - Taxis: Minimum ₹500, Maximum ₹2,000 (NEVER use 0)
    - Self-Drive: Minimum ₹1,000, Maximum ₹3,000 (NEVER use 0)
    - If cost is 0, use minimum cost for that transportation mode
- BUDGET-SPECIFIC REQUIREMENTS:
  * For budget travelers: Focus on free attractions, street food, public transport (₹200-800/day)
  * For mid-range travelers: Mix of paid/free attractions, local restaurants, private transport (₹800-2,000/day)
  * For luxury travelers: Premium attractions, fine dining, private transport (₹2,000-5,000/day)
- LOCATION FILTERING REQUIREMENTS:
  * ${preferredLocation ? `STRICT: Only suggest destinations in ${preferredLocation}` : 'Suggest destinations from various Indian states and regions'}`;

  // Get live road transportation costs only (no flights)
  let liveTransportationCosts = null;
  try {
    const transportResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/transportation-costs?origin=${encodeURIComponent('Mumbai')}&destination=${encodeURIComponent(preferredLocation || 'Delhi')}&mode=road`);
    if (transportResponse.ok) {
      liveTransportationCosts = await transportResponse.json();
      console.log('Live road transportation costs fetched:', liveTransportationCosts);
    }
  } catch (error) {
    console.error('Error fetching live transportation costs:', error);
  }

  // Add live transportation cost data to prompt if available
  let liveCostData = '';
  if (liveTransportationCosts?.data) {
    liveCostData = `

LIVE ROAD TRANSPORTATION COST DATA (Updated: ${liveTransportationCosts.timestamp}):
${liveTransportationCosts.data.trains ? `🚂 TRAINS: Sleeper ₹${liveTransportationCosts.data.trains.sleeper}, AC3 ₹${liveTransportationCosts.data.trains.ac3}, AC2 ₹${liveTransportationCosts.data.trains.ac2}` : ''}
${liveTransportationCosts.data.buses ? `🚌 BUSES: Ordinary ₹${liveTransportationCosts.data.buses.ordinary}, Semi-Luxury ₹${liveTransportationCosts.data.buses.semiLuxury}, Luxury ₹${liveTransportationCosts.data.buses.luxury}` : ''}
${liveTransportationCosts.data.taxis ? `🚕 TAXIS: ₹${liveTransportationCosts.data.taxis.perKm}/km, ₹${liveTransportationCosts.data.taxis.perDay}/day` : ''}
${liveTransportationCosts.data.selfDrive ? `🚗 SELF-DRIVE: ₹${liveTransportationCosts.data.selfDrive.fuelPerKm}/km fuel, ₹${liveTransportationCosts.data.selfDrive.rentalPerDay}/day rental` : ''}

IMPORTANT: Use these LIVE ROAD TRANSPORTATION COSTS in your calculations. These are current market rates.
FORMAT REQUIREMENTS:
- duration: "X hours" or "X hours Y minutes" (e.g., "2 hours", "8 hours 30 minutes")
- cost: number only (e.g., 4500, 1200, 800) - NEVER use 0
- description: include route details (e.g., "Train journey from Mumbai to Goa")
CRITICAL: NEVER use 0 for any transportation cost. Use minimum costs:
- Trains: Minimum ₹400 (NEVER 0)  
- Buses: Minimum ₹200 (NEVER 0)
- Taxis: Minimum ₹500 (NEVER 0)
- Self-Drive: Minimum ₹1,000 (NEVER 0)`;
  }

  const finalPrompt = prompt + liveCostData;

  try {
    let text = "";
    if (process.env.GROQ_API_KEY) {
      const groq = getGroqClient();
      const model = getGroqModel();
      const chat = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "You are a helpful travel planner that outputs ONLY valid JSON. Never use markdown formatting, code blocks, or any text outside the JSON structure. Always validate your JSON before responding." },
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

    // Log the full AI response for debugging
    console.log("=== FULL AI RESPONSE ===");
    console.log(text);
    console.log("=== END AI RESPONSE ===");
    console.log("Response length:", text.length);
    console.log("Response ends with:", text.slice(-100));
    
    // Check for truncated response
    const isTruncated = text.includes("bud...") || text.includes("budg...") || 
                       text.endsWith("...") || text.endsWith("bud") || 
                       text.endsWith("budg") || !text.trim().endsWith("}");
    
    if (isTruncated) {
      console.warn("Detected potentially truncated AI response");
    }

    const parsed = extractJson(text);
    if (!parsed?.suggestions) {
      console.error("AI invalid JSON (suggest)");
      console.error("Raw AI response length:", text.length);
      console.error("Raw AI response preview:", text.substring(0, 2000));
      console.error("Parsed result:", parsed);
      
      // Try to provide more helpful error information
      let errorMessage = "AI returned invalid JSON";
      if (text.includes("suggestions")) {
        errorMessage += " - JSON structure found but parsing failed";
      } else if (text.includes("```")) {
        errorMessage += " - Response contains markdown formatting";
      } else if (!text.includes("{")) {
        errorMessage += " - No JSON object found in response";
      }
      
      // If response appears truncated, suggest retry with shorter prompt
      if (isTruncated) {
        errorMessage += " - Response appears to be truncated. Try reducing the number of places requested.";
        
        // If we have some suggestions extracted, return them instead of error
        const fallbackSuggestions = extractFallbackSuggestions(text);
        if (fallbackSuggestions.length > 0) {
          console.log(`Returning ${fallbackSuggestions.length} suggestions extracted from truncated response`);
          return NextResponse.json({ 
            suggestions: fallbackSuggestions,
            warning: "Response was truncated, but some suggestions were successfully extracted",
            extractedCount: fallbackSuggestions.length
          });
        }
        
        // If no suggestions could be extracted, try with minimal schema
        console.log("Attempting retry with minimal schema and fewer places");
        return await retryWithMinimalSchema(request, 2); // Try with only 2 places
      }
      
      return NextResponse.json({ 
        error: errorMessage, 
        raw: text.substring(0, 2000), // Increased limit for better debugging
        parsed: parsed,
        responseLength: text.length,
        isTruncated: isTruncated
      }, { status: 502 });
    }

    const db = getAdminDb();
    const input: any = { 
      budgetINR, 
      days,
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


