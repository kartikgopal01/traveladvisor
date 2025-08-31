export interface Coordinates {
  lat: number;
  lng: number;
}

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371; // km
  const dLat = deg2rad(b.lat - a.lat);
  const dLng = deg2rad(b.lng - a.lng);
  const lat1 = deg2rad(a.lat);
  const lat2 = deg2rad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export type CostModel = {
  perKm: number; // INR per km
  baseFare?: number; // INR
};

export function estimateCostInINR(distanceKm: number, model: CostModel): number {
  const base = model.baseFare ?? 0;
  return Math.round(base + distanceKm * model.perKm);
}

export function parseLatLng(input: string): Coordinates | null {
  // Accept formats like "lat,lng"
  const m = input.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}


