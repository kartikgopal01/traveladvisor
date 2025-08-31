import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

// Query by city/state or by bounding box distance (simple approximation)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const state = searchParams.get("state");
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radiusKm = Number(searchParams.get("radiusKm") || 25);

  const db = getAdminDb();

  // Simple strategy: if city provided, filter by city; else return all with coarse distance filter on client side
  let query = db.collection("partner_hotels") as FirebaseFirestore.Query;
  if (city) query = query.where("city", "==", city);
  if (state) query = query.where("state", "==", state);

  const snap = await query.get();
  const hotels = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // If lat/lng provided, apply simple Haversine filter server-side
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
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
    return NextResponse.json({ hotels: filtered });
  }

  return NextResponse.json({ hotels });
}


