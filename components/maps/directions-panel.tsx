"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapButton } from "./map-button";
import { generateMapsDirectionsUrl } from "@/lib/maps";
import { Navigation, ArrowRight, Clock, Route } from "lucide-react";

interface Destination {
  name: string;
  location: string;
  mapsUrl?: string;
  day?: number;
}

interface DirectionsPanelProps {
  destinations: Destination[];
  title?: string;
  className?: string;
}

export function DirectionsPanel({
  destinations,
  title = "Trip Directions",
  className = ""
}: DirectionsPanelProps) {
  const [originIndex, setOriginIndex] = useState<number>(0);
  const [destinationIndex, setDestinationIndex] = useState<number>(1);

  const validDestinations = destinations.filter(dest => dest.name && dest.location);

  const handleGetDirections = () => {
    if (originIndex >= 0 && destinationIndex >= 0 && originIndex !== destinationIndex) {
      const origin = validDestinations[originIndex];
      const destination = validDestinations[destinationIndex];

      if (origin && destination) {
        const originQuery = `${origin.name}, ${origin.location}`;
        const destQuery = `${destination.name}, ${destination.location}`;

        const directionsUrl = generateMapsDirectionsUrl(originQuery, destQuery);
        window.open(directionsUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleConsecutiveDirections = (startIndex: number) => {
    if (startIndex < validDestinations.length - 1) {
      const origin = validDestinations[startIndex];
      const destination = validDestinations[startIndex + 1];

      const originQuery = `${origin.name}, ${origin.location}`;
      const destQuery = `${destination.name}, ${destination.location}`;

      const directionsUrl = generateMapsDirectionsUrl(originQuery, destQuery);
      window.open(directionsUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (validDestinations.length < 2) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Navigation className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Add at least 2 destinations to get directions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Custom Direction Selector */}
        <div className="space-y-4">
          <h4 className="font-medium">Get Directions Between Any Two Points</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <Select value={originIndex.toString()} onValueChange={(value) => setOriginIndex(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validDestinations.map((dest, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {dest.day ? `Day ${dest.day}: ` : ''}{dest.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <ArrowRight className="w-5 h-5 text-muted-foreground mx-2" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <Select value={destinationIndex.toString()} onValueChange={(value) => setDestinationIndex(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validDestinations.map((dest, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {dest.day ? `Day ${dest.day}: ` : ''}{dest.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGetDirections} className="w-full" disabled={originIndex === destinationIndex}>
            <Navigation className="w-4 h-4 mr-2" />
            Get Directions
          </Button>
        </div>

        {/* Consecutive Directions */}
        <div className="space-y-4">
          <h4 className="font-medium">Quick Directions Between Consecutive Stops</h4>
          <div className="space-y-2">
            {validDestinations.slice(0, -1).map((dest, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold">
                    {dest.day || index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{dest.name}</div>
                    <div className="text-sm text-muted-foreground">{dest.location}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-600 rounded-full text-sm font-semibold">
                    {(validDestinations[index + 1]?.day || index + 2)}
                  </div>
                  <div>
                    <div className="font-medium">{validDestinations[index + 1]?.name}</div>
                    <div className="text-sm text-muted-foreground">{validDestinations[index + 1]?.location}</div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleConsecutiveDirections(index)}
                  className="flex items-center gap-2"
                >
                  <Route className="w-4 h-4" />
                  Directions
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Travel Tips */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h5 className="font-medium mb-1">Travel Tips</h5>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Check traffic conditions before starting your journey</li>
                <li>• Use offline maps for areas with poor internet connectivity</li>
                <li>• Consider local transportation options for shorter distances</li>
                <li>• Save important locations as favorites for easy access</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickDirectionsProps {
  destinations: Destination[];
  className?: string;
}

export function QuickDirections({ destinations, className = "" }: QuickDirectionsProps) {
  const validDestinations = destinations.filter(dest => dest.name && dest.location);

  if (validDestinations.length < 2) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {validDestinations.slice(0, -1).map((dest, index) => (
        <Button
          key={index}
          variant="ghost"
          size="sm"
          onClick={() => {
            const originQuery = `${dest.name}, ${dest.location}`;
            const destQuery = `${validDestinations[index + 1]?.name}, ${validDestinations[index + 1]?.location}`;

            const directionsUrl = generateMapsDirectionsUrl(originQuery, destQuery);
            window.open(directionsUrl, '_blank', 'noopener,noreferrer');
          }}
          className="flex items-center gap-2"
        >
          <Route className="w-4 h-4" />
          {dest.name} → {validDestinations[index + 1]?.name}
        </Button>
      ))}
    </div>
  );
}
