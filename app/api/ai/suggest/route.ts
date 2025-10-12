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

function extractPartialSuggestions(text: string): any[] {
  const suggestions: any[] = [];
  
  try {
    // Try to extract suggestions from truncated JSON
    const suggestionsMatch = text.match(/"suggestions"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
    if (suggestionsMatch) {
      const suggestionsText = suggestionsMatch[1];
      
      // Try to extract individual suggestion objects
      const suggestionMatches = suggestionsText.match(/\{[^{}]*"destination"[^{}]*\}/g);
      if (suggestionMatches) {
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
              // Find the last complete field
              const lastCompleteField = cleaned.lastIndexOf('",');
              if (lastCompleteField !== -1) {
                cleaned = cleaned.substring(0, lastCompleteField + 1) + '}';
              } else {
                cleaned += '}';
              }
            }
            
            const parsed = JSON.parse(cleaned);
            if (parsed.destination) {
              // Fill in missing fields with defaults
              const suggestion = {
                destination: parsed.destination,
                state: parsed.state || "Unknown",
                region: parsed.region || "Unknown",
                bestTimeToVisit: parsed.bestTimeToVisit || "Year-round",
                estimatedCost: parsed.estimatedCost || 20000,
                budgetCategory: parsed.budgetCategory || "mid-range",
                highlights: parsed.highlights || ["Local attractions"],
                interestMatch: parsed.interestMatch || ["General sightseeing"],
                preferenceScore: parsed.preferenceScore || 70,
                breakdown: parsed.breakdown || {
                  flights: 0,
                  accommodation: 8000,
                  food: 4000,
                  localTransport: 1000,
                  attractions: 6000,
                  miscellaneous: 1000
                },
                transportation: parsed.transportation || {
                  toDestination: {
                    mode: "Bus",
                    duration: "4 hours",
                    cost: 800,
                    tips: "Book in advance"
                  }
                },
                localTips: parsed.localTips || ["Plan your visit in advance"],
                safetyNotes: parsed.safetyNotes || ["Follow local guidelines"],
                culturalNotes: parsed.culturalNotes || ["Respect local customs"]
              };
              suggestions.push(suggestion);
            }
          } catch (e) {
            // Skip this suggestion if it can't be parsed
            continue;
          }
        }
      }
    }
  } catch (e) {
    console.error("Partial extraction failed:", e);
  }
  
  return suggestions;
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

async function retryWithMinimalSchema(requestData: any, maxPlaces: number) {
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
  } = requestData;
  
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
      "interestMatch": [string],
      "preferenceScore": number,
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
          { role: "system", content: "You are a travel planner. Output ONLY valid JSON. No markdown, no explanations. Keep responses concise." },
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
  
  // Adjust number of places based on budget with reasonable limits
  // Minimum 5 places, maximum 15 places as requested
  const minPlaces = 5;
  const maxPlaces = 15;
  
  if (numberOfPlaces < minPlaces) {
    numberOfPlaces = minPlaces;
    console.log(`Increased number of places to minimum ${minPlaces}`);
  } else if (numberOfPlaces > maxPlaces) {
    numberOfPlaces = maxPlaces;
    console.log(`Reduced number of places to maximum ${maxPlaces}`);
  }

  const prompt = `Suggest ${numberOfPlaces} diverse destinations in ${preferredLocation || 'India'} for ₹${budgetINR.toLocaleString()} budget, ${days} days, ${groupSize} travelers.

Requirements:
- Travel Style: ${travelStyle}
- Interests: ${interestsList || "General sightseeing"}
- Season: ${preferredSeason || "Any"}
- ${preferredLocation ? `Location: ${preferredLocation} only` : "Diverse Indian destinations"}
- Include variety: different states, experiences, budget levels
- Each destination must fit within ₹${budgetINR} total budget

Return JSON:
{
  "suggestions": [
    {
      "destination": "string",
      "state": "string", 
      "region": "string",
      "bestTimeToVisit": "string",
      "estimatedCost": number,
      "budgetCategory": "budget|mid-range|luxury",
      "highlights": ["string"],
      "interestMatch": ["string"],
      "preferenceScore": number,
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
          "mode": "string",
          "duration": "string",
          "cost": number,
          "tips": "string"
        }
      },
      "localTips": ["string"]
    }
  ]
}

Rules: Valid JSON only. Cost <= ₹${budgetINR}. Realistic costs. Keep responses concise.`;

  const finalPrompt = prompt;

  try {
    let text = "";
    if (process.env.GROQ_API_KEY) {
      const groq = getGroqClient();
      const model = getGroqModel();
      const chat = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "You are a travel planner. Output ONLY valid JSON. No markdown, no explanations. Keep responses concise." },
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
    
    // Check for truncated response - more comprehensive detection
    const isTruncated = text.includes("bud...") || text.includes("budg...") || 
                       text.endsWith("...") || text.endsWith("bud") || 
                       text.endsWith("budg") || !text.trim().endsWith("}") ||
                       text.includes("Visit the") && !text.includes("]") ||
                       text.includes("localTips") && !text.includes("]") ||
                       text.includes("culturalNotes") && !text.includes("]") ||
                       text.includes("safetyNotes") && !text.includes("]");
    
    if (isTruncated) {
      console.warn("Detected potentially truncated AI response");
      console.warn("Response ends with:", text.slice(-200));
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
            extractedCount: fallbackSuggestions.length,
            isTruncated: true
          });
        }
        
        // Try to extract partial suggestions from truncated JSON
        const partialSuggestions = extractPartialSuggestions(text);
        if (partialSuggestions.length > 0) {
          console.log(`Returning ${partialSuggestions.length} partial suggestions from truncated response`);
          return NextResponse.json({ 
            suggestions: partialSuggestions,
            warning: "Response was truncated, returning partial suggestions",
            extractedCount: partialSuggestions.length,
            isTruncated: true
          });
        }
        
        // If no suggestions could be extracted, try with minimal schema
        console.log("Attempting retry with minimal schema and fewer places");
        return await retryWithMinimalSchema({ budgetINR, days, preferredLocation, includeAccommodation, travelStyle, interests, preferredSeason, groupSize }, 3); // Try with 3 places as fallback
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


