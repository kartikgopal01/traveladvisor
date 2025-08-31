"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapButton } from "./map-button";
import { generateMapsSearchUrl, generateTripRoute } from "@/lib/maps";
import { MapPin, Navigation, ExternalLink, Globe, Route, Info } from "lucide-react";

interface MapsIntegrationSummaryProps {
  destinations?: string[];
  className?: string;
}

export function MapsIntegrationSummary({
  destinations = [],
  className = ""
}: MapsIntegrationSummaryProps) {
  const features = [
    {
      icon: <MapPin className="w-5 h-5" />,
      title: "Precise Location Mapping",
      description: "Every destination, activity, and accommodation has accurate Google Maps integration with proper location details."
    },
    {
      icon: <Navigation className="w-5 h-5" />,
      title: "Step-by-Step Directions",
      description: "Get turn-by-turn navigation between any two points in your trip itinerary."
    },
    {
      icon: <Route className="w-5 h-5" />,
      title: "Complete Route Planning",
      description: "View your entire trip route with all destinations plotted on Google Maps."
    },
    {
      icon: <Globe className="w-5 h-5" />,
      title: "Offline Access Ready",
      description: "Save maps offline in Google Maps app for areas with poor internet connectivity."
    },
    {
      icon: <ExternalLink className="w-5 h-5" />,
      title: "One-Click Integration",
      description: "All map links open directly in Google Maps with proper coordinates and search terms."
    },
    {
      icon: <Info className="w-5 h-5" />,
      title: "Local Area Information",
      description: "Get detailed information about transportation options, nearby facilities, and local tips."
    }
  ];

  const handleExploreIndia = () => {
    const indiaMapUrl = generateMapsSearchUrl("India");
    window.open(indiaMapUrl, '_blank', 'noopener,noreferrer');
  };

  const handleViewTripRoute = () => {
    if (destinations.length > 0) {
      const tripRoute = generateTripRoute(destinations.map(dest => ({
        name: dest,
        city: dest,
      })));
      window.open(tripRoute.routeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-6 h-6" />
          Google Maps Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleExploreIndia} variant="outline" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Explore India
          </Button>
          {destinations.length > 1 && (
            <Button onClick={handleViewTripRoute} variant="outline" className="flex items-center gap-2">
              <Route className="w-4 h-4" />
              View Trip Route
            </Button>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature, index) => (
            <div key={index} className="flex gap-3 p-4 border rounded-lg">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                {feature.icon}
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Integration Details */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Info className="w-4 h-4" />
            How Google Maps Integration Works
          </h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>Each location includes precise coordinates and search terms for accurate mapping</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>Map links automatically open in your default browser's Google Maps</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>All links include "India" in the search for better local results</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>Directions consider local traffic patterns and transportation options</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-600 mt-1">•</span>
              <span>Mobile-friendly integration works seamlessly on all devices</span>
            </div>
          </div>
        </div>

        {/* Popular Indian Destinations Quick Access */}
        <div className="space-y-3">
          <h4 className="font-medium">Popular Indian Destinations</h4>
          <div className="flex flex-wrap gap-2">
            {[
              "Taj Mahal, Agra",
              "Golden Temple, Amritsar",
              "Gateway of India, Mumbai",
              "Red Fort, Delhi",
              "Mysore Palace, Karnataka",
              "Hawa Mahal, Jaipur"
            ].map((destination, index) => (
              <MapButton
                key={index}
                url={generateMapsSearchUrl(destination)}
                title={destination.split(',')[0]}
                variant="ghost"
                size="sm"
              />
            ))}
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-xs text-muted-foreground border-t pt-4">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-3 h-3" />
            <span>
              All map features powered by Google Maps. Links open in new tabs for seamless navigation.
              For best experience, use the Google Maps mobile app for offline access and real-time updates.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MapStatsProps {
  totalLocations: number;
  totalActivities: number;
  className?: string;
}

export function MapStats({ totalLocations, totalActivities, className = "" }: MapStatsProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold text-blue-600">{totalLocations}</div>
          <p className="text-xs text-muted-foreground">Mapped Locations</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold text-green-600">{totalActivities}</div>
          <p className="text-xs text-muted-foreground">Mapped Activities</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold text-purple-600">100%</div>
          <p className="text-xs text-muted-foreground">Google Maps Ready</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold text-orange-600">24/7</div>
          <p className="text-xs text-muted-foreground">Navigation Access</p>
        </CardContent>
      </Card>
    </div>
  );
}
