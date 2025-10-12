"use client";

import useSWR from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { MapButton } from "@/components/maps/map-button";
import { Star } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Function to render star rating
function renderStarRating(rating: number) {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  
  for (let i = 0; i < fullStars; i++) {
    stars.push(<Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />);
  }
  
  if (hasHalfStar) {
    stars.push(<Star key="half" className="w-3 h-3 fill-yellow-400/50 text-yellow-400" />);
  }
  
  const emptyStars = 5 - Math.ceil(rating);
  for (let i = 0; i < emptyStars; i++) {
    stars.push(<Star key={`empty-${i}`} className="w-3 h-3 text-gray-300" />);
  }
  
  return (
    <div className="flex items-center gap-1">
      <div className="flex">{stars}</div>
      <span className="text-xs text-muted-foreground ml-1">{rating}/5</span>
    </div>
  );
}

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
          <CardContent className="pt-6 space-y-2">
            <div className="font-medium">{h.name}</div>
            <div className="text-xs text-muted-foreground">{h.city}{h.state ? `, ${h.state}` : ''}</div>
            {h.rating && (
              <div className="flex items-center">
                {renderStarRating(h.rating)}
              </div>
            )}
            {h.pricePerNightINR && <div className="text-sm font-medium">₹{h.pricePerNightINR.toLocaleString?.()}/night</div>}
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


