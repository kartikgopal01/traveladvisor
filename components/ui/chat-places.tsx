"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapButton } from "@/components/maps/map-button";
import { generateMapsSearchUrl } from "@/lib/maps";
import { MapPin } from "lucide-react";

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
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="text-sm text-muted-foreground mb-2">
            {city ? `Here are the ${message} in ${city}:` : `Here are the ${message} in your area:`}
          </div>
          <div className="space-y-1">
            {places.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">•</span>
                  <span className="text-sm font-medium">{p.title}</span>
                </div>
                <MapButton 
                  url={generateMapsSearchUrl(`${p.title}${city ? ", " + city : ""}, India`)} 
                  title={`Directions to ${p.title}`} 
                  size="sm" 
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


