import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/admin";
import { getAdminDb } from "@/lib/firebaseAdmin";

export async function GET() {
  const { isAdmin, userEmail, userId } = await ensureAdmin();
  
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection("partner_hotels").orderBy("createdAt", "desc").get();
    const hotels = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ 
      hotels, 
      adminInfo: { userEmail, userId, accessType: userEmail ? 'email' : 'userid' }
    });
  } catch (error) {
    console.error("Error fetching hotels:", error);
    return NextResponse.json({ error: "Failed to fetch hotels" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { isAdmin, userEmail, userId } = await ensureAdmin();
  
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    city,
    state,
    address,
    latitude,
    longitude,
    pricePerNightINR,
    rating,
    amenities = [],
    mapsUrl,
    website,
    contact
  } = body || {};
  if (!name || !city) return NextResponse.json({ error: "Missing name/city" }, { status: 400 });
  const db = getAdminDb();
  const doc = await db.collection("partner_hotels").add({
    name,
    city,
    cityLower: typeof city === "string" ? city.trim().toLowerCase() : null,
    state: state || null,
    address: address || null,
    location: { latitude: latitude ?? null, longitude: longitude ?? null },
    pricePerNightINR: pricePerNightINR ?? null,
    rating: rating ?? null,
    amenities,
    mapsUrl: mapsUrl || null,
    website: website || null,
    contact: contact || null,
    createdAt: Date.now(),
    createdBy: userId,
  });
  return NextResponse.json({ id: doc.id }, { status: 201 });
}


