import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/admin";
import { getAdminDb } from "@/lib/firebaseAdmin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin, userEmail, userId } = await ensureAdmin();
  
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const { city } = body || {};
  if (!city || typeof city !== "string" || city.trim().length === 0) {
    return NextResponse.json({ error: "city is required" }, { status: 400 });
  }

  const db = getAdminDb();
  await db.collection("partner_hotels").doc(id).update({
    city: city.trim(),
    cityLower: city.trim().toLowerCase(),
    updatedAt: Date.now(),
    updatedBy: userEmail || userId,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { isAdmin, userEmail, userId } = await ensureAdmin();
  
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = getAdminDb();
  await db.collection("partner_hotels").doc(id).delete();
  
  return NextResponse.json({ success: true });
}


