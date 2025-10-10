import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

interface EventData {
  id: string;
  eventDate: string;
  isActive?: boolean;
  createdAt?: number;
  category?: string;
  city?: string;
  [key: string]: any;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const category = searchParams.get("category");
  const limit = parseInt(searchParams.get("limit") || "20");
  const recent = searchParams.get("recent") === "true";
  
  const db = getAdminDb();
  let query = db.collection("events");
  
  // For recent events, just get all events and filter client-side
  if (recent) {
    // Get all events and sort by creation date client-side to avoid index issues
    const snap = await query.limit(100).get(); // Get more events to sort from
    let events: EventData[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        eventDate: new Date(data.eventDate).toISOString(),
      };
    });
    
    // Filter active events only
    events = events.filter(event => event.isActive === true);
    
    // Sort by creation date (most recent first)
    events.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    // Apply additional filters
    if (category) {
      events = events.filter(event => event.category === category);
    }
    
    return NextResponse.json({ events: events.slice(0, limit) });
  }
  
  // For regular (upcoming) events, also use client-side filtering to avoid index issues
  const snap = await query.limit(100).get(); // Get more events to filter from
  let events: EventData[] = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      eventDate: new Date(data.eventDate).toISOString(),
    };
  });
  
  // Filter active events only
  events = events.filter(event => event.isActive === true);
  
  // Filter by city if provided
  if (city) {
    events = events.filter(event => event.city?.toLowerCase() === city.toLowerCase());
  }
  
  // Filter by category if provided
  if (category) {
    events = events.filter(event => event.category === category);
  }
  
  // Only get upcoming events
  const now = Date.now();
  events = events.filter(event => new Date(event.eventDate).getTime() >= now);
  
  // Sort by event date (upcoming events first)
  events.sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  
  return NextResponse.json({ events: events.slice(0, limit) });
}
