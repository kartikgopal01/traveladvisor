import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

const ADMIN_IDS = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

function ensureAdmin(userId?: string | null) {
  return !!userId && (ADMIN_IDS.length === 0 || ADMIN_IDS.includes(userId));
}

export async function GET() {
  const { userId } = await auth();
  if (!ensureAdmin(userId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getAdminDb();
  const snap = await db.collection("partner_hotels").orderBy("createdAt", "desc").get();
  const hotels = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ hotels });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!ensureAdmin(userId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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


