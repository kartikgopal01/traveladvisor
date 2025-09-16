import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

// Query by city/state or by bounding box distance (simple approximation)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const state = searchParams.get("state");
  const latStr = searchParams.get("lat");
  const lngStr = searchParams.get("lng");
  const lat = Number(latStr);
  const lng = Number(lngStr);
  const radiusKm = Number(searchParams.get("radiusKm") || 25);
  const debug = searchParams.get("debug") === "1";

  const hasValidLatLng =
    latStr !== null && lngStr !== null && latStr !== "" && lngStr !== "" && !Number.isNaN(lat) && !Number.isNaN(lng);

  const db = getAdminDb();

  // Simple strategy: if city provided, filter by city; else return all with coarse distance filter on client side
  let query = db.collection("partner_hotels") as FirebaseFirestore.Query;
  // Prefer normalized cityLower if available
  if (city) {
    const cityLower = city.trim().toLowerCase();
    // Firestore doesn't support OR here; first try cityLower, then fallback to exact city match
    query = query.where("cityLower", "==", cityLower);
  }
  if (state) query = query.where("state", "==", state);

  const snap = await query.get();
  let hotels = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // Fallback if no results and a city was provided: try exact city match
  if (hotels.length === 0 && city) {
    const fallbackSnap = await db
      .collection("partner_hotels")
      .where("city", "==", city)
      .get();
    hotels = fallbackSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  // Handle aliasing like Bengaluru/Bangalore via in-memory filter when lat/lng not supplied
  if (city && hotels.length === 0) {
    const allSnap = await db.collection("partner_hotels").get();
    const allHotels = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const aliases: Record<string, string[]> = {
      bengaluru: ["bengaluru", "bangalore", "bengalore"],
      bangalore: ["bengaluru", "bangalore", "bengalore"],
    };
    const cityLower = city.trim().toLowerCase();
    const aliasList = aliases[cityLower] || [cityLower];
    hotels = allHotels.filter((h: any) => aliasList.includes(String(h.city ?? "").toLowerCase()) || aliasList.includes(String(h.cityLower ?? "").toLowerCase()));
  }

  // If lat/lng provided, apply simple Haversine filter server-side
  if (hasValidLatLng) {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dist = (a: any) => {
      const hLat = a?.location?.latitude;
      const hLng = a?.location?.longitude;
      if (typeof hLat !== "number" || typeof hLng !== "number") return Infinity;
      const dLat = toRad(hLat - lat);
      const dLng = toRad(hLng - lng);
      const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat)) * Math.cos(toRad(hLat)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    };
    const filtered = hotels
      .map((h) => ({ ...h, _distanceKm: dist(h) }))
      .filter((h) => h._distanceKm <= radiusKm)
      .sort((a, b) => a._distanceKm - b._distanceKm);
    return NextResponse.json(
      debug
        ? {
            hotels: filtered,
            meta: {
              mode: "distance",
              count: filtered.length,
              reason: "valid lat/lng provided",
            },
          }
        : { hotels: filtered }
    );
  }

  if (debug) {
    const meta = {
      mode: city ? "city" : "all",
      count: hotels.length,
      sample: hotels.slice(0, 10).map((h: any) => ({ id: h.id, city: h.city, cityLower: h.cityLower })),
    };
    return NextResponse.json({ hotels, meta });
  }

  return NextResponse.json({ hotels });
}


