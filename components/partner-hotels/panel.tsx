"use client";

import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { MapButton } from "@/components/maps/map-button";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  destinations: string[]; // city names
}

export function PartnerHotelsPanel({ destinations }: Props) {
  // For now, query first destination's city; can be enhanced to merge across all
  const primaryCity = destinations[0];
  const { data, isLoading } = useSWR(primaryCity ? `/api/hotels/near?city=${encodeURIComponent(primaryCity)}` : null, fetcher);
  const hotels = data?.hotels || [];

  if (!primaryCity) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {isLoading && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading partner hotels…</CardContent>
        </Card>
      )}
      {!isLoading && hotels.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">No partner hotels found for {primaryCity}.</CardContent>
        </Card>
      )}
      {hotels.map((h: any) => (
        <Card key={h.id}>
          <CardContent className="pt-6 space-y-1">
            <div className="font-medium">{h.name}</div>
            <div className="text-xs text-muted-foreground">{h.city}{h.state ? `, ${h.state}` : ''}</div>
            {h.pricePerNightINR && <div className="text-sm">₹{h.pricePerNightINR.toLocaleString?.()}</div>}
            {h.mapsUrl && (
              <div className="pt-2">
                <MapButton url={h.mapsUrl} title={h.name} size="sm" variant="outline" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


