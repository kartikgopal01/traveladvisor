"use client";

import { Button } from "@/components/ui/button";
import { MapPin, Navigation, ExternalLink, Route } from "lucide-react";
import { openInMaps, generateMapsDirectionsUrl } from "@/lib/maps";

interface MapButtonProps {
  url: string;
  title: string;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showIcon?: boolean;
  type?: "location" | "directions" | "route";
  origin?: string;
  destination?: string;
}

export function MapButton({
  url,
  title,
  variant = "outline",
  size = "sm",
  className = "",
  showIcon = true,
  type = "location",
  origin,
  destination,
}: MapButtonProps) {
  const handleClick = () => {
    if (type === "directions" && origin && destination) {
      const directionsUrl = generateMapsDirectionsUrl(origin, destination);
      openInMaps(directionsUrl);
    } else {
      openInMaps(url);
    }
  };

  const getIcon = () => {
    switch (type) {
      case "directions":
        return <Navigation className="w-4 h-4" />;
      case "route":
        return <Route className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  const getButtonText = () => {
    switch (type) {
      case "directions":
        return "Get Directions";
      case "route":
        return "View Route";
      default:
        return title;
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={`transition-all duration-200 hover:scale-105 ${className}`}
      title={`Open ${title} in Google Maps`}
    >
      {showIcon && getIcon()}
      {size !== "icon" && (
        <>
          {showIcon && <span className="ml-1" />}
          {getButtonText()}
          <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
        </>
      )}
    </Button>
  );
}

interface MapLinkProps {
  url: string;
  children: React.ReactNode;
  className?: string;
}

export function MapLink({ url, children, className = "" }: MapLinkProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    openInMaps(url);
  };

  return (
    <a
      href={url}
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors cursor-pointer ${className}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Google Maps"
    >
      {children}
      <ExternalLink className="w-3 h-3 opacity-70" />
    </a>
  );
}
