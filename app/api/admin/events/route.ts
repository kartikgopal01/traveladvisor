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
  const snap = await db.collection("events").orderBy("eventDate", "desc").get();
  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!ensureAdmin(userId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const {
    title,
    description,
    location,
    city,
    state,
    eventDate,
    startTime,
    endTime,
    category,
    price,
    maxCapacity,
    currentCapacity,
    imageUrl,
    organizer,
    contactEmail,
    contactPhone,
    mapsUrl,
    website,
    tags = [],
    isActive = true
  } = body || {};
  
  if (!title || !description || !location || !eventDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  
  const db = getAdminDb();
  const doc = await db.collection("events").add({
    title,
    description,
    location,
    city: city || null,
    state: state || null,
    eventDate: new Date(eventDate).getTime(),
    startTime: startTime || null,
    endTime: endTime || null,
    category: category || "General",
    price: price ?? null,
    maxCapacity: maxCapacity ?? null,
    currentCapacity: currentCapacity ?? 0,
    imageUrl: imageUrl || null,
    organizer: organizer || null,
    contactEmail: contactEmail || null,
    contactPhone: contactPhone || null,
    mapsUrl: mapsUrl || null,
    website: website || null,
    tags,
    isActive,
    createdAt: Date.now(),
    createdBy: userId,
  });
  return NextResponse.json({ id: doc.id }, { status: 201 });
}
