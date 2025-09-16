"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapButton } from "@/components/maps/map-button";
import { generateMapsSearchUrl } from "@/lib/maps";

export default function ChatPlaces({ defaultCity }: { defaultCity?: string | null }) {
  const [city, setCity] = useState<string | null>(defaultCity || null);
  const [message, setMessage] = useState("");
  const [places, setPlaces] = useState<Array<{ title: string; description: string; imageUrl?: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  // Keep city in sync with navbar
  useEffect(() => {
    const handler = (e: any) => setCity(e?.detail || null);
    if (typeof window !== 'undefined') {
      // @ts-ignore
      setCity((window as any).__NAV_CITY__ || defaultCity || null);
      window.addEventListener('nav-city', handler as any);
    }
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('nav-city', handler as any);
    };
  }, [defaultCity]);

  async function send() {
    if (!message.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), city: city || undefined, count: 8 }),
      });
      const data = await res.json();
      if (res.ok) {
        setPlaces(data.places || []);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <Input placeholder="Ask e.g., best temples, waterfalls, cafes" value={message} onChange={(e) => setMessage(e.target.value)} />
        <Button onClick={send} disabled={loading}>Ask</Button>
      </div>
      {city && (<div className="text-xs text-muted-foreground">Using location: <span className="font-medium">{city}</span></div>)}
      {loading && <div className="text-sm text-muted-foreground">Fetching places…</div>}
      {places.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {places.map((p, i) => (
            <Card key={i} className="overflow-hidden">
              {p.imageUrl && <img src={p.imageUrl} alt={p.title} className="w-full h-40 object-cover" />}
              <CardContent className="pt-4">
                <div className="font-semibold">{p.title}</div>
                {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{p.description}</p>}
                <div className="mt-3">
                  <MapButton url={generateMapsSearchUrl(`${p.title}${city ? ", " + city : ""}, India`)} title={p.title} size="sm" variant="outline" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


