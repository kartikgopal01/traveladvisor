"use client";

import { useCallback, useEffect, useState } from "react";

export type GeolocationStatus = "idle" | "prompt" | "granted" | "denied" | "error";

export interface CurrentLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>("idle");
  const [location, setLocation] = useState<CurrentLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("error");
      setError("Geolocation not supported in this browser");
      return;
    }
    setStatus("prompt");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("granted");
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setError(null);
      },
      (err) => {
        setStatus(err.code === 1 ? "denied" : "error");
        setError(err.message || "Failed to get location");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    // Do not auto-request; caller can trigger to avoid surprise prompts
  }, []);

  return { status, location, error, request };
}


