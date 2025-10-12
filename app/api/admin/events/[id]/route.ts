import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/admin";
import { getAdminDb } from "@/lib/firebaseAdmin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin, userEmail, userId } = await ensureAdmin();
  
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  
  const { id } = await params;
  const body = await request.json();
  const db = getAdminDb();
  const docRef = db.collection("events").doc(id);
  
  // Update only the fields provided
  const updateData: any = { 
    updatedAt: Date.now(),
    updatedBy: userEmail || userId
  };
  
  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.location !== undefined) updateData.location = body.location;
  if (body.city !== undefined) updateData.city = body.city;
  if (body.state !== undefined) updateData.state = body.state;
  if (body.eventDate !== undefined) updateData.eventDate = new Date(body.eventDate).getTime();
  if (body.startTime !== undefined) updateData.startTime = body.startTime;
  if (body.endTime !== undefined) updateData.endTime = body.endTime;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.price !== undefined) updateData.price = body.price;
  if (body.maxCapacity !== undefined) updateData.maxCapacity = body.maxCapacity;
  if (body.currentCapacity !== undefined) updateData.currentCapacity = body.currentCapacity;
  if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
  if (body.organizer !== undefined) updateData.organizer = body.organizer;
  if (body.contactEmail !== undefined) updateData.contactEmail = body.contactEmail;
  if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone;
  if (body.mapsUrl !== undefined) updateData.mapsUrl = body.mapsUrl;
  if (body.website !== undefined) updateData.website = body.website;
  if (body.tags !== undefined) updateData.tags = body.tags;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;
  
  await docRef.update(updateData);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { isAdmin, userEmail, userId } = await ensureAdmin();
  
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  
  const { id } = await params;
  const db = getAdminDb();
  await db.collection("events").doc(id).delete();
  return NextResponse.json({ success: true });
}
