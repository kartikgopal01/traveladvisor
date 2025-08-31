"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGeolocation } from "./use-geolocation";
import { haversineKm, estimateCostInINR, type Coordinates } from "@/lib/geo";
import { generateMapsDirectionsUrl } from "@/lib/maps";
import { Navigation, Crosshair, MapPin } from "lucide-react";

interface DestinationPoint {
  name: string;
  location: string; // city/state text
  lat?: number;
  lng?: number;
  mapsQuery?: string; // fallback query if no lat/lng
}

interface DistanceCostPanelProps {
  destinations: DestinationPoint[];
  costPerKmINR?: number;
  baseFareINR?: number;
}

export function DistanceCostPanel({
  destinations,
  costPerKmINR = 15,
  baseFareINR = 0,
}: DistanceCostPanelProps) {
  const { status, location, error, request } = useGeolocation();

  const rows = useMemo(() => {
    if (!location) return [] as Array<{
      name: string;
      location: string;
      distanceKm?: number;
      costINR?: number;
      directionsUrl?: string;
    }>;

    return destinations.map((d) => {
      let distanceKm: number | undefined;
      let directionsUrl: string | undefined;
      if (typeof d.lat === "number" && typeof d.lng === "number") {
        distanceKm = haversineKm(
          { lat: location.lat, lng: location.lng },
          { lat: d.lat, lng: d.lng }
        );
        directionsUrl = generateMapsDirectionsUrl(
          `${location.lat},${location.lng}`,
          `${d.lat},${d.lng}`
        );
      } else {
        directionsUrl = generateMapsDirectionsUrl(
          `${location.lat},${location.lng}`,
          d.mapsQuery || d.location
        );
      }

      const cost = typeof distanceKm === "number"
        ? estimateCostInINR(distanceKm, { perKm: costPerKmINR, baseFare: baseFareINR })
        : undefined;
      return { name: d.name, location: d.location, distanceKm, costINR: cost, directionsUrl };
    });
  }, [location, destinations, costPerKmINR, baseFareINR]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crosshair className="w-5 h-5" />
          Distance & Cost from Current Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {location ? (
          <div className="text-sm text-muted-foreground">
            Your location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </div>
        ) : (
          <Button onClick={request} className="flex items-center gap-2">
            <Crosshair className="w-4 h-4" />
            Use Current Location
          </Button>
        )}

        {status === "denied" && (
          <div className="text-sm text-red-600">
            Permission denied. Enable location access in your browser settings.
          </div>
        )}
        {status === "error" && error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.map((r, i) => (
            <div key={i} className="p-3 border rounded-lg flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.location}</div>
                {typeof r.distanceKm === "number" && (
                  <div className="text-xs mt-1">
                    ~{r.distanceKm.toFixed(1)} km • ₹{r.costINR?.toLocaleString()}
                  </div>
                )}
              </div>
              {r.directionsUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(r.directionsUrl, '_blank', 'noopener,noreferrer')}
                  className="flex items-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  Directions
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


