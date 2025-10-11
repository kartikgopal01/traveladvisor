# Happy Journey - AI-Powered Travel Advisor

A comprehensive travel planning application built with Next.js, Clerk authentication, Firebase (Firestore + Storage), and advanced AI models for intelligent trip planning and suggestions.

## 🚀 Features

- **AI Trip Planning**: Generate detailed itineraries by destination (`/api/ai/plan`)
- **Budget-Based Suggestions**: Get destination recommendations within budget (`/api/ai/suggest`)
- **Interactive Place Discovery**: Chat-based place finding (`/api/ai/chat-places`)
- **Local Places API**: Comprehensive database of Indian destinations (`/api/ai/local-places`)
- **Trip History**: Persistent storage in Firestore accessible at `/trips`
- **Google Maps Integration**: Detailed maps links and navigation in all itineraries
- **Real-time Geolocation**: IP-based location detection and reverse geocoding
- **Admin Panel**: Manage events and hotels (`/admin`)

## 🧠 AI Models & Algorithms

### Primary AI Models
- **Google Gemini Pro** (`gemini-pro`): Primary language model for trip planning and content generation
- **Groq LLaMA 3.1** (`llama-3.1-8b-instant`): High-performance alternative for faster responses
- **Model Fallback System**: Automatic switching between Gemini and Groq based on API availability

### Core Algorithms

#### 1. Trip Planning Algorithm (`/api/ai/plan`)

**Complete Algorithm Implementation:**

```typescript
// Step 1: Input Processing & Validation
const { places, days, travelers, budget, travelStyle, accommodationType, 
        transportationType, vehicleType, vehicleMileage, fuelType, 
        fuelCostPerLiter, interests, dietaryRestrictions, accessibility } = request;

// Step 2: Dynamic Budget Calculation Algorithm
if (!budget) {
  // Auto-calculate budget based on travel style
  let baseBudgetPerPersonPerDay = 0;
switch (travelStyle) {
  case "budget": baseBudgetPerPersonPerDay = 1500; break;
  case "balanced": baseBudgetPerPersonPerDay = 2500; break;
  case "luxury": baseBudgetPerPersonPerDay = 5000; break;
  case "adventure": baseBudgetPerPersonPerDay = 3000; break;
}
  
  const baseBudget = baseBudgetPerPersonPerDay * days * travelers;
  
  // Accommodation Cost Calculation
  let accommodationCost = 0;
  if (accommodationType !== "na") {
    let accommodationPerNight = 0;
    switch (accommodationType) {
      case "budget-hotel": accommodationPerNight = 1500; break;
      case "hotel": accommodationPerNight = 3000; break;
      case "boutique": accommodationPerNight = 5000; break;
      case "resort": accommodationPerNight = 8000; break;
      case "homestay": accommodationPerNight = 2000; break;
    }
    accommodationCost = accommodationPerNight * days;
  }
  
  // Transportation Cost Algorithm
  let transportationCost = 0;
  if (transportationType === "own-vehicle" && vehicleType && vehicleMileage && fuelType && fuelCostPerLiter) {
    const fuelCost = parseFloat(fuelCostPerLiter);
    const mileage = parseFloat(vehicleMileage);
    const estimatedDistance = days * 200; // 200km per day average
    const fuelNeeded = estimatedDistance / mileage;
    transportationCost = Math.round(fuelNeeded * fuelCost);
  } else if (transportationType !== "na") {
    let transportPerPersonPerDay = 0;
    switch (transportationType) {
      case "train": transportPerPersonPerDay = 500; break;
      case "bus": transportPerPersonPerDay = 300; break;
      case "car": transportPerPersonPerDay = 2000; break;
      case "flight": transportPerPersonPerDay = 3000; break;
      case "mix": transportPerPersonPerDay = 1000; break;
    }
    transportationCost = transportPerPersonPerDay * days * travelers;
  }
  
  // Food Cost Algorithm
  let foodCostPerPersonPerDay = 0;
  switch (travelStyle) {
    case "budget": foodCostPerPersonPerDay = 500; break;
    case "balanced": foodCostPerPersonPerDay = 800; break;
    case "luxury": foodCostPerPersonPerDay = 2000; break;
    case "adventure": foodCostPerPersonPerDay = 1000; break;
  }
  const foodCost = foodCostPerPersonPerDay * days * travelers;
  
  // Attractions Cost Algorithm
  let attractionsCostPerPersonPerDay = 0;
  switch (travelStyle) {
    case "budget": attractionsCostPerPersonPerDay = 300; break;
    case "balanced": attractionsCostPerPersonPerDay = 600; break;
    case "luxury": attractionsCostPerPersonPerDay = 1500; break;
    case "adventure": attractionsCostPerPersonPerDay = 1000; break;
  }
  const attractionsCost = attractionsCostPerPersonPerDay * days * travelers;
  
  // Miscellaneous Cost (10% of total)
  const miscellaneousCost = Math.round((accommodationCost + transportationCost + foodCost + attractionsCost) * 0.1);
  
  // Total Budget Calculation
  calculatedBudget = accommodationCost + transportationCost + foodCost + attractionsCost + miscellaneousCost;
}

// Step 3: AI Model Selection Algorithm
let text = "";
if (process.env.GROQ_API_KEY) {
  // Use Groq for faster responses
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
  // Fallback to Gemini
  const model = getGenerativeModel();
  const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
  text = result.response.text();
}

// Step 4: JSON Parsing & Sanitization Algorithm
function extractJson(text: string) {
  const tryParse = (s: string) => {
    try { return JSON.parse(s); } catch { return null; }
  };
  
  const sanitizeJsonCandidate = (candidate: string) => {
    return candidate
      .replace(/^```[a-zA-Z]*\s*/g, "")  // Remove code fences
      .replace(/```\s*$/g, "")
      .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')  // Normalize quotes
      .replace(/[\u2018\u2019\u201B]/g, "'")
      .replace(/,(\s*[}\]])/g, "$1");  // Remove trailing commas
  };
  
  // Try direct parsing first
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

// Step 5: Data Persistence Algorithm
const db = getAdminDb();
const doc = await db.collection("trips").add({
  userId,
  type: "plan",
  input: { places, days, travelers, budget, travelStyle, accommodationType, transportationType, vehicleType, vehicleMileage, fuelType, fuelCostPerLiter, interests, dietaryRestrictions, accessibility, startDate, endDate, specialRequests, calculatedBudget, budgetBreakdown },
  result: parsed,
  createdAt: Date.now(),
});
```

#### 2. Budget-Based Destination Suggestion Algorithm (`/api/ai/suggest`)

**Complete Algorithm Implementation:**

```typescript
// Step 1: Budget Analysis Algorithm
const budgetPerDay = budgetINR / days;
const budgetPerPerson = budgetPerDay / groupSize;

// Step 2: Smart Budget Distribution Algorithm
let accommodationBudget = 0;
let activityBudget = budgetINR;

if (includeAccommodation) {
  // 40/60 Budget Allocation Algorithm
  accommodationBudget = Math.floor(budgetINR * 0.4);  // 40% accommodation
  activityBudget = budgetINR - accommodationBudget;   // 60% activities
}

const accommodationBudgetPerDay = accommodationBudget / days;
const activityBudgetPerDay = activityBudget / days;
const activityBudgetPerPerson = activityBudgetPerDay / groupSize;

// Step 3: Dynamic Destination Selection Algorithm
let numberOfPlaces;
let accommodationLevel;

// Tiered Selection Based on Activity Budget Per Person
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

// Step 4: Location Filtering Algorithm
const locationFilter = preferredLocation ? 
  `STRICT LOCATION FILTER: Only suggest destinations in ${preferredLocation}` : 
  'Suggest destinations from various Indian states and regions';

// Step 5: AI Prompt Engineering Algorithm
const prompt = `You are an expert Indian travel planner. Suggest EXACTLY ${numberOfPlaces} diverse destinations ONLY within ${preferredLocation || 'India'} that fit within a total budget of ₹${budgetINR.toLocaleString()} INR for a ${days}-day trip${origin ? ` starting from ${origin}` : ""}.

IMPORTANT: Generate ${numberOfPlaces} unique destinations - do not repeat similar places. Include variety in:
- Different states/regions within the specified area
- Different types of experiences (beaches, mountains, cities, heritage sites, wildlife, etc.)
- Different budget categories (mix of budget, mid-range, luxury options)
- Different seasons and climates
- Different cultural experiences

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

${locationFilter}`;

// Step 6: AI Model Selection & Response Processing
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
  const model = getGenerativeModel();
  const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
  text = result.response.text();
}

// Step 7: Response Validation & Storage
const parsed = extractJson(text);
if (!parsed?.suggestions) {
  console.error("AI invalid JSON (suggest)", text);
  return NextResponse.json({ error: "AI returned invalid JSON", raw: text }, { status: 502 });
}

const db = getAdminDb();
const doc = await db.collection("trips").add({
  userId,
  type: "suggest",
  input: { budgetINR, days, origin, preferredLocation, includeAccommodation, travelStyle, interests, preferredSeason, groupSize, budgetAnalysis: { budgetPerDay, budgetPerPerson, accommodationBudget, activityBudget, accommodationBudgetPerDay, activityBudgetPerDay, activityBudgetPerPerson, numberOfPlaces, accommodationLevel } },
  result: parsed,
  createdAt: Date.now(),
});
```

#### 3. Geolocation & Distance Calculation Algorithm

**Complete Implementation:**

```typescript
// Haversine Formula Implementation
function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = deg2rad(b.lat - a.lat);
  const dLng = deg2rad(b.lng - a.lng);
  const lat1 = deg2rad(a.lat);
  const lat2 = deg2rad(b.lat);
  
  // Haversine formula calculation
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  
  return R * c; // Distance in kilometers
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Cost Estimation Algorithm
export type CostModel = {
  perKm: number; // INR per km
  baseFare?: number; // INR
};

function estimateCostInINR(distanceKm: number, model: CostModel): number {
  const base = model.baseFare ?? 0;
  return Math.round(base + distanceKm * model.perKm);
}

// Coordinate Parsing Algorithm
function parseLatLng(input: string): Coordinates | null {
  // Accept formats like "lat,lng"
  const m = input.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}
```

#### 4. IP Geolocation Algorithm (`/api/geo/ip`)

**Complete Implementation:**

```typescript
// Client IP Extraction Algorithm
function parseClientIp(req: Request): string | null {
  const h = (name: string) => req.headers.get(name) || "";
  
  // Check multiple proxy headers in order of preference
  const xff = h("x-forwarded-for");
  if (xff) {
    const ip = xff.split(",")[0].trim();
    if (ip) return ip;
  }
  
  const xr = h("x-real-ip");
  if (xr) return xr.trim();
  
  const cf = h("cf-connecting-ip");
  if (cf) return cf.trim();
  
  return null;
}

// Multi-Provider IP Geolocation Algorithm
export async function GET(request: Request) {
  try {
    const ip = parseClientIp(request);
    
    // Primary Provider: ipapi.co
    const primaryUrl = ip ? 
      `https://ipapi.co/${encodeURIComponent(ip)}/json/` : 
      "https://ipapi.co/json/";
    
    let res = await fetch(primaryUrl, { cache: "no-store" });
    let data: any = await res.json();
    
    let lat = Number(data?.latitude);
    let lng = Number(data?.longitude);
    let city = data?.city || null;
    let region = data?.region || null;
    
    // Fallback Provider 1: ipwho.is
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      const ipParam = ip ? `/${encodeURIComponent(ip)}` : "";
      const alt = await fetch(`https://ipwho.is${ipParam}`, { cache: "no-store" });
      const adata: any = await alt.json();
      lat = Number(adata?.latitude);
      lng = Number(adata?.longitude);
      city = city || adata?.city || null;
      region = region || adata?.region || null;
    }
    
    // Fallback Provider 2: ip-api.com
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      const ipParam = ip ? `/${encodeURIComponent(ip)}` : "";
      const alt2 = await fetch(`http://ip-api.com/json${ipParam}?fields=status,country,regionName,city,lat,lon`, { cache: "no-store" });
      const a2: any = await alt2.json();
      if (a2?.status === "success") {
        lat = Number(a2.lat);
        lng = Number(a2.lon);
        city = city || a2.city || null;
        region = region || a2.regionName || null;
      }
    }
    
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: "No IP location" }, { status: 404 });
    }
    
    return NextResponse.json({ lat, lng, city, state: region, ip: ip || null });
  } catch {
    return NextResponse.json({ error: "IP geolocation failed" }, { status: 500 });
  }
}
```

#### 5. Reverse Geocoding Algorithm (`/api/geo/reverse`)

**Complete Implementation:**

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  
  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }
  
  try {
    // OpenStreetMap Nominatim API Integration
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=10&addressdetails=1`;
    
    const res = await fetch(url, { 
      headers: { 
        "User-Agent": "traveladvisor/1.0 (+https://example.com)" 
      } 
    });
    
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    
    const data: any = await res.json();
    const addr = data?.address || {};
    
    // Address Component Extraction Algorithm
    const city = addr.city || addr.town || addr.village || addr.county || null;
    const state = addr.state || null;
    const displayName = data?.display_name || null;
    
    return NextResponse.json({ city, state, displayName });
  } catch (e) {
    return NextResponse.json({ error: "reverse geocode failed" }, { status: 500 });
  }
}
```

#### 6. Natural Language Processing for Place Discovery (`/api/ai/chat-places`)

**Complete Implementation:**

```typescript
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { message, city, count = 6 } = body || {};
  
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
  
  const model = getGenerativeModel();
  
  // Step 1: City/District Extraction Algorithm
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
  
  // Direct City/District Pattern Matching
  const directCityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:district|city|state)\b/gi;
  let directMatch;
  while ((directMatch = directCityPattern.exec(message)) !== null) {
    const directCity = directMatch[1].trim();
    if (!mentionedCities.includes(directCity)) {
      mentionedCities.push(directCity);
    }
  }
  
  // Step 2: Target Location Determination Algorithm
  const targetCity = mentionedCities.length > 0 ? mentionedCities[0] : null;
  const locationText = targetCity ? targetCity : (city ? city : 'detected location');
  
  // Step 3: AI Prompt Engineering for Place Discovery
  const prompt = `Find real ${message} that are physically located in ${locationText}.

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

Return real ${message} from ${locationText}:`;

  // Step 4: AI Response Processing
  let places: any[] = [];
  try {
    const result = await model.generateContent({ 
      contents: [{ role: "user", parts: [{ text: prompt }] }] 
    });
    const text = result.response.text();
    const json = JSON.parse(text);
    places = Array.isArray(json?.places) ? json.places.slice(0, count) : [];
  } catch {
    places = [];
  }
  
  // Step 5: Wikipedia Fallback Algorithm
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
  
  // Step 6: Image Enrichment Algorithm
  const enriched = await Promise.all(
    places.map(async (place) => {
      const image = await fetchWikiImage(place.title);
      return { ...place, image };
    })
  );
  
  return NextResponse.json({ places: enriched });
}

// Wikipedia Image Fetching Algorithm
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
```

#### 7. Google Maps URL Generation Algorithm

**Complete Implementation:**

```typescript
// Maps Search URL Generation
export function generateMapsSearchUrl(query: string): string {
  const encodedQuery = encodeURIComponent(query);
  return `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
}

// Maps Directions URL Generation
export function generateMapsDirectionsUrl(
  origin: string,
  destination: string,
  travelMode: 'driving' | 'walking' | 'transit' | 'bicycling' = 'driving'
): string {
  const encodedOrigin = encodeURIComponent(origin);
  const encodedDestination = encodeURIComponent(destination);
  return `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}&travelmode=${travelMode}`;
}

// Multi-Stop Route Generation Algorithm
export function generateMapsMultiStopRoute(
  waypoints: string[],
  origin?: string,
  destination?: string
): string {
  if (waypoints.length === 0) return '';
  
  const encodedWaypoints = waypoints.map(wp => encodeURIComponent(wp)).join('|');
  
  if (origin && destination) {
    const encodedOrigin = encodeURIComponent(origin);
    const encodedDestination = encodeURIComponent(destination);
    return `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}&waypoints=${encodedWaypoints}`;
  } else if (origin) {
    const encodedOrigin = encodeURIComponent(origin);
    return `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&waypoints=${encodedWaypoints}`;
  } else {
    return `https://www.google.com/maps/search/?api=1&query=${encodedWaypoints.split('|')[0]}`;
  }
}

// Street View URL Generation
export function generateStreetViewUrl(lat: number, lng: number, heading?: number): string {
  const baseUrl = `https://www.google.com/maps/@?api=1&map_action=pano&pano=`;
  const coords = `${lat},${lng}`;
  const headingParam = heading ? `&heading=${heading}` : '';
  return `${baseUrl}${coords}${headingParam}`;
}

// Location Query Optimization Algorithm
export function generateLocationQuery(location: MapLocation): string {
  const { name, address, city, state } = location;
  
  // Try different combinations for better search results
  if (address && city) {
    return `${name}, ${address}, ${city}`;
  } else if (city && state) {
    return `${name}, ${city}, ${state}, India`;
  } else if (city) {
    return `${name}, ${city}, India`;
  } else if (name) {
    return `${name}, India`;
  }
  
  return 'India';
}

// Trip Route Generation Algorithm
export function generateTripRoute(destinations: MapLocation[]): {
  routeUrl: string;
  waypoints: string[];
  individualUrls: string[];
} {
  const waypoints = destinations.map(dest => generateLocationQuery(dest));
  const routeUrl = generateMapsMultiStopRoute(waypoints);
  const individualUrls = destinations.map(dest =>
    generateMapsSearchUrl(generateLocationQuery(dest))
  );
  
  return {
    routeUrl,
    waypoints,
    individualUrls,
  };
}
```

#### 8. Local Places Database Algorithm (`/api/ai/local-places`)

**Complete Implementation:**

```typescript
// In-Memory Caching Algorithm
const cache = new Map<string, { expiry: number; value: any }>();

// City Extraction from Text Algorithm
function toCityFromText(text: string): string | null {
  const m = text.match(/City:\s*([^\n]+)/i) || text.match(/Nearest City:\s*([^\n]+)/i);
  return m ? m[1].trim() : null;
}

// Multi-Source Image Fetching Algorithm
async function fetchExactPlaceImage(title: string, city?: string): Promise<string | null> {
  // Special case handling for specific places
  if (title.toLowerCase().includes('tyavarekoppa') || 
      title.toLowerCase().includes('lion tiger safari') ||
      (title.toLowerCase().includes('lion') && title.toLowerCase().includes('safari') && city?.toLowerCase().includes('shivamogga'))) {
    return 'https://www.karnataka.com/wp-content/uploads/2015/07/tyavarekoppa-lion-and-tiger-reserve-shimoga-wiki.jpg';
  }
  
  // Wikipedia API - Primary Source
  try {
    const resp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(title)}`);
    const data = await resp.json();
    const pages = data?.query?.pages || {};
    const page = Object.values(pages)[0] as any;
    const img = page?.original?.source;
    if (typeof img === "string") {
      return img;
    }
  } catch {
    // Continue to other sources
  }
  
  // Wikipedia Search Fallback
  try {
    const searchQuery = city ? `${title} ${city} India` : `${title} India`;
    const searchResp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(searchQuery)}&srlimit=3`);
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const results = searchData.query?.search || [];
      
      for (const result of results) {
        if (result?.title) {
          const imgResp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(result.title)}`);
          if (imgResp.ok) {
            const imgData = await imgResp.json();
            const pages = imgData.query?.pages || {};
            const page = Object.values(pages)[0] as any;
            const img = page?.original?.source;
            if (typeof img === "string") {
              return img;
            }
          }
        }
      }
    }
  } catch {
    // Continue to other sources
  }
  
  // Additional image sources (Pixabay, Unsplash, Flickr, etc.)
  // ... (similar pattern for other APIs)
  
  return null;
}

// District-Specific Places Database Algorithm
function getDistrictSpecificPlaces(cityName: string | null): any[] {
  if (!cityName) return [];
  
  const cityLower = cityName.toLowerCase();
  
  // Major districts with predefined attractions
  const districtData: { [key: string]: any[] } = {
    'shivamogga': [
      { title: "Lion Tiger Safari And Zoo", description: "Famous wildlife safari and zoo in Shivamogga district, India", wikipediaTitle: "Tyavarekoppa Lion Safari" },
      { title: "Jog Falls", description: "Famous waterfall in Shivamogga district, India", wikipediaTitle: "Jog Falls" },
      { title: "Sakrebylu Elephant Camp", description: "Elephant camp in Shivamogga district, India", wikipediaTitle: "Sakrebyle Elephant Camp" },
      { title: "Kodachadri", description: "Mountain peak in Shivamogga district, India", wikipediaTitle: "Kodachadri" },
      { title: "Agumbe", description: "Sunset point in Shivamogga district, India", wikipediaTitle: "Agumbe" },
      { title: "Bhadra Wildlife Sanctuary", description: "Famous wildlife sanctuary in Shivamogga district, India", wikipediaTitle: "Bhadra Wildlife Sanctuary" },
      // ... more places
    ],
    // ... more districts
  };
  
  return districtData[cityLower] || [];
}
```

## 🛠️ Setup

### 1) Install Dependencies
```bash
npm i
```

### 2) Environment Variables (.env.local)
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...

# Firebase Admin SDK
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# AI Models Configuration
GEMINI_API_KEY=...
# Optional: override model
# GEMINI_MODEL=gemini-pro

# Groq Configuration (optional - will be used if set)
GROQ_API_KEY=...
# Optional: override model
# GROQ_MODEL=llama-3.1-8b-instant
```

### 3) Run Development Server
```bash
npm run dev
```

## 📊 Technical Architecture

### API Endpoints
- `/api/ai/plan` - AI-powered trip planning with detailed itineraries
- `/api/ai/suggest` - Budget-based destination recommendations
- `/api/ai/chat-places` - Interactive place discovery with NLP
- `/api/ai/local-places` - Comprehensive Indian destinations database
- `/api/geo/ip` - IP-based geolocation with multi-provider fallback
- `/api/geo/reverse` - Reverse geocoding using OpenStreetMap
- `/api/hotels/near` - Hotel recommendations near destinations
- `/api/events` - Event management and discovery

### Data Flow
1. **User Input** → Authentication (Clerk)
2. **Location Detection** → IP Geolocation → Reverse Geocoding
3. **AI Processing** → Gemini/Groq → Structured JSON Response
4. **Data Storage** → Firebase Firestore → Trip History
5. **Maps Integration** → Google Maps URLs → Navigation Links

### Performance Optimizations
- **Model Fallback**: Automatic switching between AI providers
- **Caching**: IP geolocation results cached for performance
- **Error Handling**: Comprehensive fallback mechanisms
- **JSON Sanitization**: Robust parsing of AI responses
- **Budget Optimization**: Smart allocation algorithms

## 🔧 Key Technologies

- **Frontend**: Next.js 14, React, TypeScript
- **Authentication**: Clerk
- **Database**: Firebase Firestore
- **AI Models**: Google Gemini Pro, Groq LLaMA 3.1
- **Maps**: Google Maps API
- **Geolocation**: IP-based detection with OpenStreetMap
- **Styling**: Tailwind CSS
- **Deployment**: Vercel-ready configuration
