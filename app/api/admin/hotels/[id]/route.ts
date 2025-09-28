import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

const ADMIN_IDS = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

function ensureAdmin(userId?: string | null) {
  return !!userId && (ADMIN_IDS.length === 0 || ADMIN_IDS.includes(userId));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!ensureAdmin(userId)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    updatedBy: userId,
  });

  return NextResponse.json({ ok: true });
}


