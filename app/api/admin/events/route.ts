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
    const snap = await db.collection("events").orderBy("eventDate", "desc").get();
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ 
      events, 
      adminInfo: { userEmail, userId, accessType: userEmail ? 'email' : 'userid' }
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { isAdmin, userEmail, userId } = await ensureAdmin();
  
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

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
