"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapButton } from "./map-button";
import { generateTripRoute, generateMapsDirectionsUrl } from "@/lib/maps";
import { MapPin, Route, Navigation, ExternalLink } from "lucide-react";

interface TripDestination {
  name: string;
  location: string;
  mapsUrl?: string;
  day?: number;
}

interface TripMapProps {
  destinations: TripDestination[];
  title?: string;
  className?: string;
}

export function TripMap({ destinations, title = "Trip Route", className = "" }: TripMapProps) {
  const [selectedOrigin, setSelectedOrigin] = useState<string>("");
  const [selectedDestination, setSelectedDestination] = useState<string>("");

  const validDestinations = destinations.filter(dest => dest.name && dest.location);

  const tripRoute = generateTripRoute(validDestinations.map(dest => ({
    name: dest.name,
    city: dest.location,
  })));

  const handleDirections = (origin: string, destination: string) => {
    const directionsUrl = generateMapsDirectionsUrl(origin, destination);
    window.open(directionsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleViewAllRoute = () => {
    if (tripRoute.routeUrl) {
      window.open(tripRoute.routeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleViewAllRoute}
            variant="default"
            size="sm"
            className="flex items-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            View Complete Route
          </Button>
        </div>

        {/* Destination List */}
        <div className="space-y-3">
          {validDestinations.map((dest, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold">
                  {dest.day || index + 1}
                </div>
                <div>
                  <div className="font-medium">{dest.name}</div>
                  <div className="text-sm text-muted-foreground">{dest.location}</div>
                </div>
              </div>

              <div className="flex gap-2">
                {dest.mapsUrl && (
                  <MapButton
                    url={dest.mapsUrl}
                    title={dest.name}
                    size="sm"
                    variant="outline"
                  />
                )}

                {/* Direction buttons for previous destination */}
                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDirections(
                      validDestinations[index - 1].location,
                      dest.location
                    )}
                    title={`Get directions from ${validDestinations[index - 1].name} to ${dest.name}`}
                  >
                    <Navigation className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Route Information */}
        {validDestinations.length > 1 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>
                {validDestinations.length} destinations •
                Click "View Complete Route" to see the full itinerary in Google Maps
              </span>
            </div>
          </div>
        )}

        {/* Google Maps Integration Note */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-3 h-3" />
            <span>All map links open in Google Maps for accurate navigation and directions</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickMapProps {
  destinations: TripDestination[];
  className?: string;
}

export function QuickMap({ destinations, className = "" }: QuickMapProps) {
  const validDestinations = destinations.filter(dest => dest.mapsUrl);

  if (validDestinations.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {validDestinations.map((dest, index) => (
        <MapButton
          key={index}
          url={dest.mapsUrl!}
          title={dest.name}
          variant="ghost"
          size="sm"
        />
      ))}
    </div>
  );
}
