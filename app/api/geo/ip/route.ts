import { NextResponse } from "next/server";

function parseClientIp(req: Request): string | null {
  const h = (name: string) => req.headers.get(name) || "";
  const xff = h("x-forwarded-for");
  if (xff) {
    const ip = xff.split(",")[0].trim();
    if (ip) return ip;
  }
  const xr = h("x-real-ip");
  if (xr) return xr.trim();
  const cf = h("cf-connecting-ip");
  if (cf) return cf.trim();
  return null;
}

export async function GET(request: Request) {
  try {
    const ip = parseClientIp(request);

    // Prefer querying with the client IP when available
    const primaryUrl = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : "https://ipapi.co/json/";
    let res = await fetch(primaryUrl, { cache: "no-store" });
    let data: any = await res.json();

    let lat = Number(data?.latitude);
    let lng = Number(data?.longitude);
    let city = data?.city || null;
    let region = data?.region || null;

    // Fallback to ipwho.is if ipapi has no coordinates
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      const ipParam = ip ? `/${encodeURIComponent(ip)}` : "";
      const alt = await fetch(`https://ipwho.is${ipParam}`, { cache: "no-store" });
      const adata: any = await alt.json();
      lat = Number(adata?.latitude);
      lng = Number(adata?.longitude);
      city = city || adata?.city || null;
      region = region || adata?.region || null;
    }

    // Fallback to ip-api.com if still missing
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      const ipParam = ip ? `/${encodeURIComponent(ip)}` : "";
      const alt2 = await fetch(`http://ip-api.com/json${ipParam}?fields=status,country,regionName,city,lat,lon`, { cache: "no-store" });
      const a2: any = await alt2.json();
      if (a2?.status === "success") {
        lat = Number(a2.lat);
        lng = Number(a2.lon);
        city = city || a2.city || null;
        region = region || a2.regionName || null;
      }
    }

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: "No IP location" }, { status: 404 });
    }
    return NextResponse.json({ lat, lng, city, state: region, ip: ip || null });
  } catch {
    return NextResponse.json({ error: "IP geolocation failed" }, { status: 500 });
  }
}


