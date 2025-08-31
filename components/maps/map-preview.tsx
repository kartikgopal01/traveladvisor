"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapButton } from "./map-button";
import { MapPin, ExternalLink, Maximize2, X } from "lucide-react";

interface MapPreviewProps {
  query: string;
  title?: string;
  width?: number;
  height?: number;
  zoom?: number;
  className?: string;
  showControls?: boolean;
}

export function MapPreview({
  query,
  title = "Location Map",
  width = 400,
  height = 300,
  zoom = 15,
  className = "",
  showControls = true,
}: MapPreviewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Generate static map URL (requires Google Maps Static API key)
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(query)}&zoom=${zoom}&size=${width}x${height}&key=YOUR_STATIC_API_KEY`;

  // Generate Google Maps URL
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <Card className={`${className} ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <CardContent className="p-0">
        <div className="relative">
          {/* Map Preview Area */}
          <div
            className="bg-muted/30 flex items-center justify-center border-b"
            style={{
              width: isFullscreen ? '100%' : width,
              height: isFullscreen ? '100%' : height,
              minHeight: isFullscreen ? '400px' : height,
            }}
          >
            {/* Placeholder for static map - replace with actual static map when API key is available */}
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
              <MapPin className="w-12 h-12 text-muted-foreground" />
              <div className="space-y-2">
                <h4 className="font-medium text-lg">{title}</h4>
                <p className="text-sm text-muted-foreground">
                  Interactive map preview for {query}
                </p>
              </div>
              <div className="flex gap-2">
                <MapButton
                  url={mapsUrl}
                  title="Open in Google Maps"
                  variant="default"
                />
                <Button
                  variant="outline"
                  onClick={handleFullscreen}
                  className="flex items-center gap-2"
                >
                  <Maximize2 className="w-4 h-4" />
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </Button>
              </div>
            </div>
          </div>

          {/* Map Controls */}
          {showControls && (
            <div className="absolute top-2 right-2 flex gap-1">
              {!isFullscreen && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleFullscreen}
                  className="bg-white/90 hover:bg-white shadow-md"
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              )}
              {isFullscreen && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleFullscreen}
                  className="bg-white/90 hover:bg-white shadow-md"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}

          {/* Map Attribution */}
          <div className="absolute bottom-2 right-2">
            <div className="bg-white/90 px-2 py-1 rounded text-xs text-muted-foreground shadow-md">
              <ExternalLink className="w-3 h-3 inline mr-1" />
              Google Maps
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface LocationPreviewProps {
  name: string;
  location: string;
  mapsUrl?: string;
  className?: string;
}

export function LocationPreview({ name, location, mapsUrl, className = "" }: LocationPreviewProps) {
  const query = `${name}, ${location}`;

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h4 className="font-medium">{name}</h4>
            <p className="text-sm text-muted-foreground">{location}</p>
          </div>
          <div className="flex gap-2">
            {mapsUrl ? (
              <MapButton
                url={mapsUrl}
                title={name}
                size="sm"
              />
            ) : (
              <MapButton
                url={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
                title={name}
                size="sm"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MapGridProps {
  locations: Array<{
    name: string;
    location: string;
    mapsUrl?: string;
  }>;
  className?: string;
}

export function MapGrid({ locations, className = "" }: MapGridProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {locations.map((location, index) => (
        <LocationPreview
          key={index}
          name={location.name}
          location={location.location}
          mapsUrl={location.mapsUrl}
        />
      ))}
    </div>
  );
}
