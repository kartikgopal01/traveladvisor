import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!lat || !lng) return NextResponse.json({ error: "lat and lng required" }, { status: 400 });

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=10&addressdetails=1`;
    const res = await fetch(url, { headers: { "User-Agent": "traveladvisor/1.0 (+https://example.com)" } });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const data: any = await res.json();
    const addr = data?.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || null;
    const state = addr.state || null;
    const displayName = data?.display_name || null;
    return NextResponse.json({ city, state, displayName });
  } catch (e) {
    return NextResponse.json({ error: "reverse geocode failed" }, { status: 500 });
  }
}


