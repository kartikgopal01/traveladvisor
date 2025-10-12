"use client";
import { useEffect, useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { MapPin, Calendar, Users, IndianRupee, Camera, Utensils, Train, Car, Plane } from "lucide-react";
import { MapButton } from "@/components/maps/map-button";
import { TripMap } from "@/components/maps/trip-map";
import { MapPreview, MapGrid } from "@/components/maps/map-preview";
import { DirectionsPanel } from "@/components/maps/directions-panel";
import { MapsIntegrationSummary, MapStats } from "@/components/maps/maps-integration-summary";
import { DistanceCostPanel } from "@/components/maps/distance-cost-panel";
import { PartnerHotelsPanel } from "@/components/partner-hotels/panel";
import {
  RiArrowRightLine,
  RiFileTextLine,
  RiFlashlightLine,
  RiGitBranchLine,
  RiGlobalLine,
  RiShieldCheckLine,
  RiTeamLine,
  RiMagicLine,
  RiUserLine,
} from "@remixicon/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { FlipWords } from "@/components/ui/flip-words";
import { useGeolocation } from "@/components/maps/use-geolocation";
import { ChatPlaces, EventsSection } from "@/components/ui";

// Theme-aware logo component for hero section with dynamic colors
function ThemeLogo() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    checkTheme();
    
    // Listen for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  return (
    <img
      src={isDark ? "/logoDark.png" : "/logowhite.png"}
      alt="Happy Journey Logo"
      className={`w-full h-60 opacity-100 transition-opacity duration-300 ${
        isDark ? 'dynamic-logo-dark' : 'dynamic-logo-light'
      }`}
    />
  );
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [planResult, setPlanResult] = useState<any | null>(null);
  const [suggestResult, setSuggestResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Local places near current user
  const { status: geoStatus, location, error: geoError, request: requestLocation } = useGeolocation();
  const [fallbackLoc, setFallbackLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [localCity, setLocalCity] = useState<string | null>(null);
  const [localPlaces, setLocalPlaces] = useState<Array<{ title: string; description: string; imageUrl: string | null; mapsUrl?: string }>>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [customCity, setCustomCity] = useState("");
  const [isAnimationPaused, setIsAnimationPaused] = useState(false);

  // Generate colored gradient for places without images
  function getPlaceCardColor(title: string) {
    const colors = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600', 
      'from-orange-500 to-red-600',
      'from-purple-500 to-pink-600',
      'from-indigo-500 to-blue-600',
      'from-emerald-500 to-green-600',
      'from-rose-500 to-pink-600',
      'from-cyan-500 to-blue-600'
    ];
    const colorIndex = title.length % colors.length;
    return colors[colorIndex];
  }

  // Helper function to extract location name from various formats
  function getLocationName(day: any): string {
    // Try different possible field names
    if (day.locationName) return day.locationName;
    if (day.destination) return day.destination;
    if (day.city) return day.city;
    if (day.place) return day.place;
    
    // If location is a URL, try to extract the query parameter
    if (day.location && day.location.includes('google.com/maps')) {
      try {
        const url = new URL(day.location);
        const query = url.searchParams.get('query');
        if (query) {
          // Remove "India" suffix and decode
          return decodeURIComponent(query).replace(/,?\s*India\s*$/, '').trim();
        }
      } catch (e) {
        // If URL parsing fails, fall back to original
      }
    }
    
    // Fall back to original location or default
    return day.location || 'Location';
  }

  async function fetchPlacesByCity(cityName: string) {
    if (!cityName.trim()) return;
    setLocalLoading(true);
    try {
      const res = await fetch(`/api/ai/local-places?city=${encodeURIComponent(cityName.trim())}&count=15`);
      const data = await res.json();
      if (res.ok) {
        setLocalCity(data.city || cityName.trim());
        setLocalPlaces(Array.isArray(data.places) ? data.places : []);
      }
    } finally {
      setLocalLoading(false);
    }
  }


  useEffect(() => {
    // Auto-request on mount; if blocked/slow, fallback to IP location after 2s
    requestLocation();
    const timer = setTimeout(async () => {
      if (!location) {
        try {
          // Try server-side IP first
          const r = await fetch("/api/geo/ip");
          if (r.ok) {
            const d = await r.json();
            if (typeof d.lat === "number" && typeof d.lng === "number") {
              setFallbackLoc({ lat: d.lat, lng: d.lng });
              return;
            }
          }
        } catch {}
        try {
          // Fallback: call public IP API directly from the browser (works on localhost)
          const rr = await fetch("https://ipapi.co/json/");
          if (rr.ok) {
            const dd = await rr.json();
            const la = Number(dd?.latitude);
            const ln = Number(dd?.longitude);
            if (!Number.isNaN(la) && !Number.isNaN(ln)) {
              setFallbackLoc({ lat: la, lng: ln });
            }
          }
        } catch {}
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let timeout: any;
    async function fetchLocalPlaces() {
      let loc = location || fallbackLoc;
      // If we still don't have coordinates but navbar shows a city, use that
      if (!loc && typeof window !== 'undefined') {
        // @ts-ignore
        const cityFromNav = (window as any).__NAV_CITY__ as string | undefined;
        if (cityFromNav) {
          setLocalCity(cityFromNav);
          setLocalLoading(true);
          try {
            const r2 = await fetch(`/api/ai/local-places?city=${encodeURIComponent(cityFromNav)}&count=15`);
            const d2 = await r2.json();
            if (r2.ok && Array.isArray(d2.places)) {
              setLocalPlaces(d2.places);
              console.log(`Navbar auto-detected: ${cityFromNav}, ${d2.places.length} places`);
            }
          } finally {
            setLocalLoading(false);
          }
          return;
        }
      }
      if (!loc) return;
      setLocalLoading(true);
      try {
        const params = new URLSearchParams({ lat: String(loc.lat), lng: String(loc.lng), count: String(15) });
        const res = await fetch(`/api/ai/local-places?${params.toString()}`);
        const data = await res.json();
        if (res.ok) {
          setLocalCity(data.city || null);
          setLocalPlaces(Array.isArray(data.places) ? data.places : []);
          console.log(`Auto-detected: ${data.city}, ${data.places?.length || 0} places`);
          // If empty, try city-based request via reverse geocode
          if ((!data.places || data.places.length === 0)) {
            try {
              const r = await fetch(`/api/geo/reverse?lat=${loc.lat}&lng=${loc.lng}`);
              const g = await r.json();
              const cityName = g?.city || g?.state;
              if (cityName) {
                const r2 = await fetch(`/api/ai/local-places?city=${encodeURIComponent(cityName)}&count=15`);
                const d2 = await r2.json();
                if (r2.ok && Array.isArray(d2.places) && d2.places.length > 0) {
                  setLocalCity(d2.city || cityName);
                  setLocalPlaces(d2.places);
                  console.log(`Fallback auto-detected: ${d2.city || cityName}, ${d2.places.length} places`);
                }
              }
            } catch {}
          }
        }
      } finally {
        setLocalLoading(false);
      }
    }
    // If we have location, fetch immediately; otherwise debounce
    if (location || fallbackLoc) {
      fetchLocalPlaces();
    } else {
      // Debounce to avoid spamming API while location permission transitions
      timeout = setTimeout(fetchLocalPlaces, 300);
    }
    const onNavCity = (e: any) => {
      const c = e?.detail;
      if (c && !location && !fallbackLoc) {
        setLocalCity(c);
        // trigger fetch by calling function directly (city mode)
        (async () => {
          setLocalLoading(true);
          try {
            const r2 = await fetch(`/api/ai/local-places?city=${encodeURIComponent(c)}&count=15`);
            const d2 = await r2.json();
            if (r2.ok && Array.isArray(d2.places)) {
              setLocalPlaces(d2.places);
              console.log(`Nav-city event: ${c}, ${d2.places.length} places`);
            }
          } finally {
            setLocalLoading(false);
          }
        })();
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('nav-city', onNavCity as any);
    return () => {
      clearTimeout(timeout);
      if (typeof window !== 'undefined') window.removeEventListener('nav-city', onNavCity as any);
    };
  }, [location, fallbackLoc]);

  // Form states for plan
  const [places, setPlaces] = useState<string[]>([""]);
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] = useState(50000);
  const [travelStyle, setTravelStyle] = useState("balanced");
  const [accommodationType, setAccommodationType] = useState("hotel");
  const [transportationType, setTransportationType] = useState("mix");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleMileage, setVehicleMileage] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [fuelCostPerLiter, setFuelCostPerLiter] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [accessibility, setAccessibility] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [popupWidth, setPopupWidth] = useState<'sm' | 'md' | 'lg' | 'xl'>('lg');

  // Popup size helper function
  const getPopupClasses = () => {
    switch (popupWidth) {
      case 'sm':
        return { 
          width: 'w-[95vw] sm:w-[80vw] md:w-[60vw] lg:w-[50vw] xl:w-[45vw] max-w-2xl', 
          height: 'h-[80vh] max-h-[85vh]',
          position: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50'
        };
      case 'md':
        return { 
          width: 'w-[95vw] sm:w-[85vw] md:w-[70vw] lg:w-[60vw] xl:w-[55vw] max-w-4xl', 
          height: 'h-[85vh] max-h-[90vh]',
          position: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50'
        };
      case 'lg':
        return { 
          width: 'w-[95vw] sm:w-[90vw] md:w-[80vw] lg:w-[70vw] xl:w-[65vw] max-w-6xl', 
          height: 'h-[90vh] max-h-[95vh]',
          position: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50'
        };
      case 'xl':
        return { 
          width: 'w-[95vw] sm:w-[95vw] md:w-[90vw] lg:w-[80vw] xl:w-[75vw] max-w-7xl', 
          height: 'h-[95vh] max-h-[98vh]',
          position: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50'
        };
      default:
        return { 
          width: 'w-[95vw] sm:w-[90vw] md:w-[80vw] lg:w-[70vw] xl:w-[65vw] max-w-6xl', 
          height: 'h-[90vh] max-h-[95vh]',
          position: 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50'
        };
    }
  };

  // Handle click outside to close popup
  const handleClickOutside = (e: React.MouseEvent) => {
    if (expandedSuggestion !== null && !(e.target as HTMLElement).closest('.suggestion-popup')) {
      setExpandedSuggestion(null);
    }
  };

  // Handle keyboard events for popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedSuggestion !== null) {
        setExpandedSuggestion(null);
      }
    };

    if (expandedSuggestion !== null) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when popup is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [expandedSuggestion]);

  // Form states for suggest
  const [budgetINR, setBudgetINR] = useState(50000);
  const [suggestDays, setSuggestDays] = useState(3);
  const [preferredLocation, setPreferredLocation] = useState("");
  const [includeAccommodation, setIncludeAccommodation] = useState(true);
  const [suggestTravelStyle, setSuggestTravelStyle] = useState("balanced");
  const [suggestInterests, setSuggestInterests] = useState<string[]>([]);
  const [preferredSeason, setPreferredSeason] = useState("any");
  const [groupSize, setGroupSize] = useState(2);

  const interestOptions = [
    "Culture & Heritage", "Adventure & Trekking", "Wildlife & Nature", "Beach & Relaxation",
    "Food & Cuisine", "Shopping & Markets", "Photography", "Festivals & Events",
    "Spiritual & Religious", "Nightlife", "History", "Architecture"
  ];

  const dietaryOptions = [
    "Vegetarian", "Vegan", "Jain", "Halal", "Kosher", "Gluten-Free", "Dairy-Free"
  ];

  const accessibilityOptions = [
    "Wheelchair Accessible", "Hearing Impaired", "Visually Impaired", "Elderly Friendly"
  ];

  async function createPlan() {
    setLoading(true);
    setSuggestResult(null);
    setErrorMsg(null);
    try {
      const validPlaces = places.filter(p => p.trim() !== "");
      if (validPlaces.length === 0) {
        setErrorMsg("Please add at least one destination");
        return;
      }

      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          places: validPlaces,
          days: days || undefined,
          travelers: travelers || undefined,
          budget: budget || undefined,
          travelStyle,
          accommodationType,
          transportationType,
          vehicleType: transportationType === "own-vehicle" ? vehicleType : undefined,
          vehicleMileage: transportationType === "own-vehicle" ? vehicleMileage : undefined,
          fuelType: transportationType === "own-vehicle" ? fuelType : undefined,
          fuelCostPerLiter: transportationType === "own-vehicle" ? fuelCostPerLiter : undefined,
          interests,
          dietaryRestrictions,
          accessibility,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          specialRequests: specialRequests || undefined
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const extra = data?.details || (typeof data?.raw === "string" ? `: ${data.raw.slice(0, 200)}...` : "");
        setErrorMsg((data?.error || "Failed to generate plan") + extra);
        return;
      }
      setPlanResult(data.plan || data);
    } finally {
      setLoading(false);
    }
  }

  async function suggestTrips() {
    setLoading(true);
    setPlanResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetINR,
          days: suggestDays,
          preferredLocation: preferredLocation || undefined,
          includeAccommodation,
          travelStyle: suggestTravelStyle,
          interests: suggestInterests,
          preferredSeason: preferredSeason || undefined,
          groupSize
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const extra = data?.details || (typeof data?.raw === "string" ? `: ${data.raw.slice(0, 200)}...` : "");
        setErrorMsg((data?.error || "Failed to suggest destinations") + extra);
        return;
      }
      setSuggestResult(data.suggestions || data);
    } finally {
      setLoading(false);
    }
  }

  const addPlace = () => {
    setPlaces([...places, ""]);
  };

  const removePlace = (index: number) => {
    if (places.length > 1) {
      setPlaces(places.filter((_, i) => i !== index));
    }
  };

  const updatePlace = (index: number, value: string) => {
    const newPlaces = [...places];
    newPlaces[index] = value;
    setPlaces(newPlaces);
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleSuggestInterest = (interest: string) => {
    setSuggestInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleDietary = (option: string) => {
    setDietaryRestrictions(prev =>
      prev.includes(option)
        ? prev.filter(d => d !== option)
        : [...prev, option]
    );
  };

  const toggleAccessibility = (option: string) => {
    setAccessibility(prev =>
      prev.includes(option)
        ? prev.filter(a => a !== option)
        : [...prev, option]
    );
  };

  return (
    <>
      <SignedOut>
        <div>
          {/* Hero Section */}
          <section className="min-h-screen relative overflow-hidden hero-background">
            {/* Background Overlay */}
            <div className="absolute inset-0 bg-black/0"></div>
            
            {/* Hero Icons */}
            <div className="mt-8 sm:mt-12 flex gap-4 sm:gap-8 justify-center relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 150 }}
                animate={{ opacity: 1, y: 50 }}
                transition={{
                  duration: 0.8,
                  ease: "easeOut",
                  delay: 0.2,
                }}
                className="relative"
              >
                <ThemeLogo />
              </motion.div>
            </div>

            <div className="container-mobile pt-8 sm:pt-12 md:pt-16 lg:pt-20 pb-8 sm:pb-12 md:pb-16 relative z-10">
              <div className="text-center">
                <Badge variant="secondary" className="mb-2 sm:mb-3 md:mb-4 text-xs sm:text-sm touch-target">
                  <RiFlashlightLine className="w-3 h-3 mr-1" />
                  AI trip planning
                </Badge>

                <h1 className="text-mobile-xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-normal sm:font-bold tracking-tight mb-3 sm:mb-4 md:mb-6 text-foreground">
                  Plan your next{" "}
                  <FlipWords
                    words={["Adventure", "Journey", "Experience", "Memory"]}
                    className="dynamic-color-text text-hover-glow"
                  />{" "}
                  with
                  <span className="text-foreground block">AI Superpowers</span>
                </h1>
                <p className="text-mobile-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-4 sm:mb-6 md:mb-8 px-4">
                  Create detailed itineraries with AI, compare destinations by budget, and visualize routes on interactive maps. All in one fast, modern app.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-center px-4">
                  <SignInButton mode="modal">
                    <Button size="lg" className="flex items-center group bg-foreground text-background hover:bg-foreground/90 border-foreground w-full sm:w-auto btn-hover-enhanced btn-mobile touch-target">
                      Get Started Free
                      <RiArrowRightLine className="h-4 w-4 ml-1" />
                    </Button>
                  </SignInButton>
                  <Button variant="outline" size="lg" asChild className="border-foreground text-foreground hover:bg-foreground hover:text-background w-full sm:w-auto btn-hover-enhanced btn-mobile touch-target">
                    <Link href="#features">Learn More</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Local Discover Section */}
          <section className="section-padding">
            <div className="container-mobile">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="text-mobile-sm text-muted-foreground">
                  {localCity ? (
                    <>You are near <span className="font-medium text-foreground">{localCity}</span></>
                  ) : (
                    <>Detecting your location…</>
                  )}
                </div>
                {geoError && <span className="text-xs text-red-500">{geoError}</span>}
              </div>

            {/* Change location */}
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2 form-mobile">
              <Input
                placeholder="Change city (e.g., Jaipur)"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                className="w-full sm:w-56 touch-target"
              />
              <Button size="sm" variant="outline" onClick={() => fetchPlacesByCity(customCity)} className="w-full sm:w-auto btn-hover-enhanced btn-mobile touch-target">Show places</Button>
            </div>

              {localPlaces.length > 0 && (
                <div className="mt-6 relative overflow-hidden">
                  {/* Pause/Play Button */}
                  <div className="absolute top-2 right-2 z-10">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-8 h-8 p-0 bg-white/80 hover:bg-white touch-target mobile-hover"
                      onClick={() => {
                        setIsAnimationPaused(!isAnimationPaused);
                        const container = document.querySelector('.animate-scroll-all-cards') as HTMLElement;
                        if (container) {
                          container.style.animationPlayState = isAnimationPaused ? 'running' : 'paused';
                        }
                      }}
                    >
                      {isAnimationPaused ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </Button>
                  </div>
                  <div 
                    className="relative overflow-hidden"
                    onWheel={(e) => {
                      // Only handle wheel events when animation is paused and mouse is over cards
                      if (!isAnimationPaused) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const cardContainer = e.currentTarget.querySelector('.animate-scroll-all-cards') as HTMLElement;
                      if (cardContainer) {
                        cardContainer.scrollLeft += e.deltaY;
                      }
                    }}
                  >
                    <div 
                      className="animate-scroll-all-cards"
                      onMouseDown={(e) => {
                        // Only allow dragging when animation is paused
                        if (!isAnimationPaused) return;
                        
                        const container = e.currentTarget;
                        let isDragging = true;
                        let startX = e.pageX;
                        let scrollLeft = container.scrollLeft;
                        
                        const handleMouseMove = (e: MouseEvent) => {
                          if (!isDragging) return;
                          e.preventDefault();
                          const x = e.pageX;
                          const walk = (x - startX) * 2;
                          container.scrollLeft = scrollLeft - walk;
                        };
                        
                        const handleMouseUp = () => {
                          isDragging = false;
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                      onWheel={(e) => {
                        // Only allow wheel scrolling when animation is paused
                        if (!isAnimationPaused) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const container = e.currentTarget;
                        container.scrollLeft += e.deltaY;
                      }}
                      onMouseEnter={(e) => {
                        // Only pause on hover if animation is not manually paused
                        if (!isAnimationPaused) {
                          (e.currentTarget as HTMLElement).style.animationPlayState = 'paused';
                        }
                      }}
                      onMouseLeave={(e) => {
                        // Only resume on leave if animation is not manually paused
                        if (!isAnimationPaused) {
                          (e.currentTarget as HTMLElement).style.animationPlayState = 'running';
                        }
                      }}
                    >
                      <div className="flex gap-3 pb-4">
                        {/* First set of all cards */}
                        {localPlaces.map((p, idx) => (
                          <Card 
                            key={idx} 
                            className="flex-shrink-0 w-48 sm:w-56 hover:scale-105 hover:shadow-lg transition-all duration-300 cursor-pointer group card-hover-enhanced"
                            onClick={(e) => {
                              // Only open maps if not dragging
                              if (!e.defaultPrevented && p.mapsUrl) {
                                window.open(p.mapsUrl, '_blank');
                              }
                            }}
                          >
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.title} className="w-full h-32 sm:h-40 object-cover group-hover:scale-110 transition-transform duration-300" />
                            ) : (
                              <div className={`w-full h-32 sm:h-40 bg-gradient-to-br ${getPlaceCardColor(p.title)} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                <div className="text-white text-center px-3 sm:px-4">
                                  <div className="text-sm sm:text-lg font-bold">{p.title}</div>
                                </div>
                              </div>
                            )}
                            <CardContent className="pt-3 sm:pt-4">
                              <div className="font-semibold text-sm sm:text-base group-hover:text-primary transition-colors duration-300">{p.title}</div>
                              {p.description && (
                                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 mt-1">{p.description}</p>
                              )}
                              <div className="mt-2 sm:mt-3">
                                <MapButton 
                                  url={p.mapsUrl || ''} 
                                  title="View on Maps" 
                                  size="sm" 
                                  variant="outline"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        
                        {/* Second set of all cards for seamless loop */}
                        {localPlaces.map((p, idx) => (
                          <Card 
                            key={`duplicate-${idx}`} 
                            className="flex-shrink-0 w-48 sm:w-56 hover:scale-105 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                            onClick={(e) => {
                              // Only open maps if not dragging
                              if (!e.defaultPrevented && p.mapsUrl) {
                                window.open(p.mapsUrl, '_blank');
                              }
                            }}
                          >
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.title} className="w-full h-32 sm:h-40 object-cover group-hover:scale-110 transition-transform duration-300" />
                            ) : (
                              <div className={`w-full h-32 sm:h-40 bg-gradient-to-br ${getPlaceCardColor(p.title)} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                <div className="text-white text-center px-3 sm:px-4">
                                  <div className="text-sm sm:text-lg font-bold">{p.title}</div>
                                </div>
                              </div>
                            )}
                            <CardContent className="pt-3 sm:pt-4">
                              <div className="font-semibold text-sm sm:text-base group-hover:text-primary transition-colors duration-300">{p.title}</div>
                              {p.description && (
                                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-3 mt-1">{p.description}</p>
                              )}
                              <div className="mt-2 sm:mt-3">
                                <MapButton 
                                  url={p.mapsUrl || ''} 
                                  title="View on Maps" 
                                  size="sm" 
                                  variant="outline"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {localLoading && (
                <div className="mt-4 text-center text-responsive-sm text-muted-foreground">Loading places near you…</div>
              )}
            </div>
          </section>

          {/* Events Section */}
          <section className="py-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="events-section-mobile">
                <EventsSection city={localCity || undefined} showModeToggle={true} limit={6} />
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section
            id="features"
            className="py-20 bg-muted min-h-screen flex items-center justify-center w-full"
          >
            <div className="container px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
                  Everything you need to plan smarter
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                  Built for travelers who want clarity, speed, and beautiful plans
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <RiMagicLine className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-foreground">AI Trip Planning</CardTitle>
                    <CardDescription>
                      Generate complete itineraries tailored to your style and budget
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <IndianRupee className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-foreground">Budget Planner</CardTitle>
                    <CardDescription>
                      Transparent cost breakdowns for stay, food, travel, and activities
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <MapPin className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-foreground">Interactive Maps</CardTitle>
                    <CardDescription>
                      See routes, attractions, and hotels plotted for easy navigation
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <Train className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-foreground">Routes & Directions</CardTitle>
                    <CardDescription>
                      Compare travel modes with durations, costs, and tips
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-foreground">Partner Hotels</CardTitle>
                    <CardDescription>
                      Curated stays near key attractions, with pricing and ratings
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <Utensils className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-foreground">Food & Restaurants</CardTitle>
                    <CardDescription>
                      Find great places to eat with specialties and price ranges
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <RiFileTextLine className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-foreground">Share & Export</CardTitle>
                    <CardDescription>
                      Share plans or export details for offline access
                    </CardDescription>
                  </CardHeader>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <RiFlashlightLine className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-foreground">Lightning Fast</CardTitle>
                    <CardDescription>
                      Built with Next.js for speed and smooth interactions
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </section>


          {/* Footer */}
        <footer className="transform scale-60">
          
          <div className="max-w-7xl mx-auto px-4 py-0 sm:px-6 lg:px-8">
            
            <div className="flex flex-col items-center justify-center">
              <div className="transform scale-90">
                <ThemeLogo />
              </div>
              <p className="text-muted-foreground text-sm  -mt-1 md:-mt-2">
                Plan, compare, and map your next adventure
              </p>
            </div>
          </div>
         </footer>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="min-h-screen px-6 max-w-6xl mx-auto">
          <div className="text-center transform scale-80">
            <div className="flex justify-center items-center w-full h-full mb-0">
              <div className="transform scale-100">
                <ThemeLogo />
              </div>
            </div>
            <p className="text-lg text-muted-foreground mt-1">
              Plan perfect trips across India with AI-powered recommendations
            </p>
          </div>

          {/* Local Discover Section (Signed In) */}
          <section className="py-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="text-sm text-muted-foreground">
                {localCity ? (
                  <>You are near <span className="font-medium text-foreground">{localCity}</span></>
                ) : (
                  <>Detecting your location…</>
                )}
              </div>
              {geoError && <span className="text-xs text-red-500">{geoError}</span>}
            </div>

            {/* Change location */}
            <div className="mt-2 flex items-center justify-center gap-2">
              <Input
                placeholder="Change city (e.g., Jaipur)"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                className="w-56"
              />
              <Button size="sm" variant="outline" onClick={() => fetchPlacesByCity(customCity)}>Show places</Button>
            </div>

            {localPlaces.length > 0 && (
              <div className="mt-6 relative overflow-hidden">
                <div className="relative overflow-hidden">
                  {/* Pause/Play button */}
                  <div className="absolute top-2 right-2 z-10">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-8 h-8 p-0 bg-white/80 hover:bg-white"
                      onClick={() => {
                        setIsAnimationPaused(!isAnimationPaused);
                        const container = document.querySelector('.animate-scroll-all-cards') as HTMLElement;
                        if (container) {
                          container.style.animationPlayState = isAnimationPaused ? 'running' : 'paused';
                        }
                      }}
                    >
                      {isAnimationPaused ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </Button>
                  </div>
                  <div 
                    className="animate-scroll-all-cards"
                    onMouseDown={(e) => {
                      // Only allow dragging when animation is paused
                      if (!isAnimationPaused) return;
                      // Stop auto-scroll when user starts dragging
                      const container = e.currentTarget;
                      container.style.animationPlayState = 'paused';
                      
                      let isDragging = true;
                      let startX = e.pageX;
                      let scrollLeft = container.scrollLeft;
                      
                      const handleMouseMove = (e: MouseEvent) => {
                        if (!isDragging) return;
                        e.preventDefault();
                        const x = e.pageX;
                        const walk = (x - startX) * 2;
                        container.scrollLeft = scrollLeft - walk;
                      };
                      
                      const handleMouseUp = () => {
                        isDragging = false;
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        // Resume auto-scroll after a delay
                        setTimeout(() => {
                          container.style.animationPlayState = 'running';
                        }, 2000);
                      };
                      
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                    onWheel={(e) => {
                      // Only allow wheel scrolling when animation is paused
                      if (!isAnimationPaused) return;
                      e.preventDefault();
                      e.stopPropagation(); // Prevent page scroll
                      const container = e.currentTarget;
                      container.scrollLeft += e.deltaY;
                    }}
                    onMouseEnter={(e) => {
                      // Only pause on hover if animation is not manually paused
                      if (!isAnimationPaused) {
                        (e.currentTarget as HTMLElement).style.animationPlayState = 'paused';
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Only resume on leave if animation is not manually paused
                      if (!isAnimationPaused) {
                        (e.currentTarget as HTMLElement).style.animationPlayState = 'running';
                      }
                    }}
                  >
                    <div className="flex gap-3 pb-4">
                      {/* First set of all cards */}
                        {localPlaces.map((p, idx) => (
                          <Card 
                            key={idx} 
                            className="flex-shrink-0 w-56 hover:scale-105 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                          onClick={(e) => {
                            // Only open maps if not dragging
                            if (!e.defaultPrevented && (p as any).mapsUrl) {
                              window.open((p as any).mapsUrl, '_blank');
                            }
                          }}
                        >
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.title} className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300" />
                          ) : (
                            <div className={`w-full h-40 bg-gradient-to-br ${getPlaceCardColor(p.title)} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                              <div className="text-white text-center px-4">
                                <div className="text-lg font-bold">{p.title}</div>
                              </div>
                            </div>
                          )}
                          <CardContent className="pt-4">
                            <div className="font-semibold group-hover:text-primary transition-colors duration-300">{p.title}</div>
                            {p.description && (
                              <p className="text-sm text-muted-foreground line-clamp-3 mt-1">{p.description}</p>
                            )}
                            <div className="mt-3">
                              <MapButton 
                                url={p.mapsUrl || ''} 
                                title="View on Maps" 
                                size="sm" 
                                variant="outline"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      {/* Second set for seamless loop */}
                      {localPlaces.map((p, idx) => (
                        <Card 
                          key={`duplicate-${idx}`} 
                          className="overflow-hidden flex-shrink-0 w-56 hover:scale-105 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                          onClick={(e) => {
                            // Only open maps if not dragging
                            if (!e.defaultPrevented && (p as any).mapsUrl) {
                              window.open((p as any).mapsUrl, '_blank');
                            }
                          }}
                        >
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.title} className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-300" />
                          ) : (
                            <div className={`w-full h-40 bg-gradient-to-br ${getPlaceCardColor(p.title)} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                              <div className="text-white text-center px-4">
                                <div className="text-lg font-bold">{p.title}</div>
                              </div>
                            </div>
                          )}
                          <CardContent className="pt-4">
                            <div className="font-semibold group-hover:text-primary transition-colors duration-300">{p.title}</div>
                            {p.description && (
                              <p className="text-sm text-muted-foreground line-clamp-3 mt-1">{p.description}</p>
                            )}
                            <div className="mt-3">
                              <MapButton 
                                url={p.mapsUrl || ''} 
                                title="View on Maps" 
                                size="sm" 
                                variant="outline"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {localLoading && (
              <div className="mt-3 text-center text-sm text-muted-foreground">Loading places near you…</div>
            )}
          </section>

          {/* Events Section for Signed In Users */}
          <section className="py-6">
            <div className="events-section-mobile">
              <EventsSection city={localCity || undefined} showModeToggle={true} limit={4} />
            </div>
          </section>

          <Tabs defaultValue="plan" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 sm:mb-8 gap-1">
            <TabsTrigger value="plan" className="flex items-center gap-2 bg-purple-100 text-purple-700 data-[state=active]:bg-purple-700 data-[state=active]:text-white hover:bg-purple-200 rounded-full btn-mobile touch-target">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Plan by Places</span>
              <span className="sm:hidden">Places</span>
            </TabsTrigger>
            <TabsTrigger value="suggest" className="flex items-center gap-2 bg-purple-100 text-purple-700 data-[state=active]:bg-purple-700 data-[state=active]:text-white hover:bg-purple-200 rounded-full btn-mobile touch-target">
              <IndianRupee className="w-4 h-4" />
              <span className="hidden sm:inline">Suggest by Budget</span>
              <span className="sm:hidden">Budget</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="space-y-4 sm:space-y-6">
            <Card className="card-mobile">
              <CardHeader className="p-mobile">
                <CardTitle className="flex items-center gap-2 text-mobile-lg">
                  <MapPin className="w-5 h-5" />
                  Create Custom Trip Plan
                </CardTitle>
                <CardDescription className="text-mobile-sm">
                  Plan your perfect Indian adventure by specifying destinations and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-mobile">
                {/* Places Section */}
                <div className="space-y-3">
                  <Label className="text-mobile-base font-semibold">Destinations in India</Label>
                  {places.map((place, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder={`Destination ${index + 1} (e.g., Mumbai, Kerala, Delhi)`}
                        value={place}
                        onChange={(e) => updatePlace(index, e.target.value)}
                        className="flex-1 touch-target"
                      />
                      {places.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removePlace(index)}
                          className="btn-mobile touch-target"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPlace}
                    className="w-full btn-mobile touch-target"
                  >
                    Add Another Destination
                  </Button>
                </div>

                {/* Basic Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="days" className="text-mobile-sm">Number of Days (Optional)</Label>
                    <Input
                      id="days"
                      type="number"
                      min={1}
                      max={30}
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value))}
                      placeholder="Leave empty for auto-calculation"
                      className="touch-target"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="travelers" className="text-mobile-sm">Number of Travelers (Optional)</Label>
                    <Input
                      id="travelers"
                      type="number"
                      min={1}
                      max={20}
                      value={travelers}
                      onChange={(e) => setTravelers(Number(e.target.value))}
                      placeholder="Leave empty for auto-calculation"
                      className="touch-target"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget" className="text-mobile-sm">Total Budget (₹) (Optional)</Label>
                    <Input
                      id="budget"
                      type="number"
                      min={1000}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      placeholder="Leave empty for auto-calculation"
                      className="touch-target"
                    />
                  </div>
                </div>

                {/* Travel Preferences */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="travelStyle" className="text-mobile-sm">Travel Style</Label>
                    <Select value={travelStyle} onValueChange={setTravelStyle}>
                      <SelectTrigger className="touch-target">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="budget">Budget</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="luxury">Luxury</SelectItem>
                        <SelectItem value="adventure">Adventure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accommodation">Accommodation Type</Label>
                    <Select value={accommodationType} onValueChange={setAccommodationType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="budget-hotel">Budget Hotel</SelectItem>
                        <SelectItem value="hotel">Standard Hotel</SelectItem>
                        <SelectItem value="boutique">Boutique Hotel</SelectItem>
                        <SelectItem value="resort">Resort</SelectItem>
                        <SelectItem value="homestay">Homestay</SelectItem>
                        <SelectItem value="na">NA (Not Needed)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transportation">Transportation</Label>
                    <Select value={transportationType} onValueChange={setTransportationType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="train">Train</SelectItem>
                        <SelectItem value="bus">Bus</SelectItem>
                        <SelectItem value="car">Car Rental</SelectItem>
                        <SelectItem value="flight">Flight</SelectItem>
                        <SelectItem value="mix">Mix</SelectItem>
                        <SelectItem value="na">NA (Not Needed)</SelectItem>
                        <SelectItem value="own-vehicle">Own Vehicle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Vehicle Details - Only show when "Own Vehicle" is selected */}
                {transportationType === "own-vehicle" && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold">Vehicle Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vehicleType">Vehicle Type</Label>
                        <Select value={vehicleType} onValueChange={setVehicleType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vehicle type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bike">Bike/Motorcycle</SelectItem>
                            <SelectItem value="car">Car</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicleMileage">Mileage (km/liter)</Label>
                        <Input
                          id="vehicleMileage"
                          type="number"
                          min={1}
                          max={50}
                          value={vehicleMileage}
                          onChange={(e) => setVehicleMileage(e.target.value)}
                          placeholder="e.g., 15"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fuelType">Fuel Type</Label>
                        <Select value={fuelType} onValueChange={setFuelType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select fuel type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="petrol">Petrol</SelectItem>
                            <SelectItem value="diesel">Diesel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fuelCostPerLiter">Fuel Cost (₹/liter)</Label>
                        <Input
                          id="fuelCostPerLiter"
                          type="number"
                          min={50}
                          max={200}
                          value={fuelCostPerLiter}
                          onChange={(e) => setFuelCostPerLiter(e.target.value)}
                          placeholder="e.g., 100"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Interests */}
                <div className="space-y-3">
                  <Label className="text-mobile-base font-semibold">Interests & Activities</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {interestOptions.map((interest) => (
                      <div key={interest} className="flex items-center space-x-2 touch-target">
                        <Checkbox
                          id={`interest-${interest}`}
                          checked={interests.includes(interest)}
                          onCheckedChange={() => toggleInterest(interest)}
                          className="touch-target"
                        />
                        <Label
                          htmlFor={`interest-${interest}`}
                          className="text-mobile-xs font-normal cursor-pointer touch-target"
                        >
                          {interest}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dietary Restrictions */}
                <div className="space-y-3">
                  <Label className="text-mobile-base font-semibold">Dietary Restrictions</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {dietaryOptions.map((option) => (
                      <div key={option} className="flex items-center space-x-2 touch-target">
                        <Checkbox
                          id={`dietary-${option}`}
                          checked={dietaryRestrictions.includes(option)}
                          onCheckedChange={() => toggleDietary(option)}
                          className="touch-target"
                        />
                        <Label
                          htmlFor={`dietary-${option}`}
                          className="text-mobile-xs font-normal cursor-pointer touch-target"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Accessibility */}
                <div className="space-y-3">
                  <Label className="text-mobile-base font-semibold">Accessibility Requirements</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {accessibilityOptions.map((option) => (
                      <div key={option} className="flex items-center space-x-2 touch-target">
                        <Checkbox
                          id={`accessibility-${option}`}
                          checked={accessibility.includes(option)}
                          onCheckedChange={() => toggleAccessibility(option)}
                          className="touch-target"
                        />
                        <Label
                          htmlFor={`accessibility-${option}`}
                          className="text-mobile-xs font-normal cursor-pointer touch-target"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-mobile-sm">Start Date (Optional)</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="touch-target"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="text-mobile-sm">End Date (Optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="touch-target"
                    />
                  </div>
                </div>

                {/* Special Requests */}
                <div className="space-y-2">
                  <Label htmlFor="specialRequests" className="text-mobile-sm">Special Requests (Optional)</Label>
                  <Input
                    id="specialRequests"
                    placeholder="Any special requirements or preferences..."
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    className="touch-target"
                  />
                </div>

                <Button
                  onClick={createPlan}
                  disabled={loading}
                  className="w-full btn-mobile touch-target"
                  size="lg"
                >
                  {loading ? "Planning Your Trip..." : "Generate Trip Plan"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suggest" className="space-y-4 sm:space-y-6">
            <Card className="card-mobile">
              <CardHeader className="p-mobile">
                <CardTitle className="flex items-center gap-2 text-mobile-lg">
                  <IndianRupee className="w-5 h-5" />
                  Get Destination Suggestions
                </CardTitle>
                <CardDescription className="text-mobile-sm">
                  Let AI suggest 5-15 Indian destinations based on your budget and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-mobile">
                {/* Budget and Basic Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="budgetINR" className="text-mobile-sm">Total Budget (₹)</Label>
                    <Input
                      id="budgetINR"
                      type="number"
                      min={5000}
                      value={budgetINR}
                      onChange={(e) => setBudgetINR(Number(e.target.value))}
                      className="touch-target"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="suggestDays" className="text-mobile-sm">Number of Days</Label>
                    <Input
                      id="suggestDays"
                      type="number"
                      min={2}
                      max={30}
                      value={suggestDays}
                      onChange={(e) => setSuggestDays(Number(e.target.value))}
                      className="touch-target"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="groupSize" className="text-mobile-sm">Group Size</Label>
                    <Input
                      id="groupSize"
                      type="number"
                      min={1}
                      max={20}
                      value={groupSize}
                      onChange={(e) => setGroupSize(Number(e.target.value))}
                      className="touch-target"
                    />
                  </div>
                </div>

                {/* Travel Style and Season */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="suggestTravelStyle" className="text-mobile-sm">Travel Style</Label>
                    <Select value={suggestTravelStyle} onValueChange={setSuggestTravelStyle}>
                      <SelectTrigger className="touch-target">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="budget">Budget</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="luxury">Luxury</SelectItem>
                        <SelectItem value="adventure">Adventure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferredSeason">Preferred Season</Label>
                    <Select value={preferredSeason} onValueChange={setPreferredSeason}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Season</SelectItem>
                        <SelectItem value="summer">Summer (Mar-Jun)</SelectItem>
                        <SelectItem value="monsoon">Monsoon (Jun-Sep)</SelectItem>
                        <SelectItem value="autumn">Autumn (Sep-Nov)</SelectItem>
                        <SelectItem value="winter">Winter (Dec-Feb)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preferred Location */}
                <div className="space-y-2">
                  <Label htmlFor="preferredLocation">Preferred Location/State/District</Label>
                  <Input
                    id="preferredLocation"
                    placeholder="e.g., Kerala, Goa, Rajasthan, Shimla, Manali"
                    value={preferredLocation}
                    onChange={(e) => setPreferredLocation(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Specify a particular state, district, or city you'd like to visit
                  </p>
                </div>

                {/* Accommodation Preference */}
                <div className="space-y-2">
                  <Label htmlFor="includeAccommodation">Accommodation Suggestions</Label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="accommodation"
                        value="yes"
                        checked={includeAccommodation === true}
                        onChange={() => setIncludeAccommodation(true)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm">Yes, include accommodation suggestions</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="accommodation"
                        value="no"
                        checked={includeAccommodation === false}
                        onChange={() => setIncludeAccommodation(false)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm">No, only destinations</span>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {includeAccommodation 
                      ? "Accommodation budget will be allocated from your total budget"
                      : "Only destination suggestions will be provided"
                    }
                  </p>
                </div>

                {/* Interests for suggestions */}
                <div className="space-y-3">
                  <Label className="text-mobile-base font-semibold">Interests & Activities</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {interestOptions.map((interest) => (
                      <div key={interest} className="flex items-center space-x-2 touch-target">
                        <Checkbox
                          id={`suggest-interest-${interest}`}
                          checked={suggestInterests.includes(interest)}
                          onCheckedChange={() => toggleSuggestInterest(interest)}
                          className="touch-target"
                        />
                        <Label
                          htmlFor={`suggest-interest-${interest}`}
                          className="text-mobile-xs font-normal cursor-pointer touch-target"
                        >
                          {interest}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={suggestTrips}
                  disabled={loading}
                  className="w-full btn-mobile touch-target"
                  size="lg"
                >
                  {loading ? "Finding Perfect Destinations..." : "Get Suggestions"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium">Crafting your perfect Indian adventure...</p>
            </div>
        </div>
        )}

        {errorMsg && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{errorMsg}</p>
            </CardContent>
          </Card>
        )}

        {planResult && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Your Custom Trip Plan
                </CardTitle>
                <CardDescription>
                  Destinations: {planResult.destinations?.join(", ") || "India"}
                  • Total Budget: ₹{planResult.totalBudget?.toLocaleString() || "N/A"}
                  • {planResult.days} Days • {planResult.currency}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Preference Analysis */}
                {planResult.preferenceAnalysis && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">🎯 Your Preferences Analysis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Interests Coverage */}
                      <Card className="border-blue-200 bg-blue-50 shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                              <span className="text-white text-lg font-bold">🎯</span>
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-blue-800 text-lg">Interests Coverage</div>
                              <div className="text-sm text-blue-600 font-medium">{planResult.preferenceAnalysis.interestsCoverage.coveragePercentage}% Match</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {planResult.preferenceAnalysis.interestsCoverage.matchedInterests.map((interest: string, idx: number) => (
                              <div key={idx} className="text-xs bg-blue-100 text-blue-800 px-3 py-2 rounded-lg border border-blue-200 shadow-sm">
                                ✓ {interest}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Dietary Compliance */}
                      <Card className="border-green-200 bg-green-50 shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center shadow-md">
                              <span className="text-white text-lg font-bold">🍽️</span>
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-green-800 text-lg">Dietary Compliance</div>
                              <div className="text-sm text-green-600 font-medium">{planResult.preferenceAnalysis.dietaryCompliance.compliancePercentage}% Compliant</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {planResult.preferenceAnalysis.dietaryCompliance.restrictions.map((restriction: string, idx: number) => (
                              <div key={idx} className="text-xs bg-green-100 text-green-800 px-3 py-2 rounded-lg border border-green-200 shadow-sm">
                                ✓ {restriction}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Accessibility Compliance */}
                      <Card className="border-purple-200 bg-purple-50 shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center shadow-md">
                              <span className="text-white text-lg font-bold">♿</span>
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-purple-800 text-lg">Accessibility</div>
                              <div className="text-sm text-purple-600 font-medium">{planResult.preferenceAnalysis.accessibilityCompliance.compliancePercentage}% Accessible</div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {planResult.preferenceAnalysis.accessibilityCompliance.requirements.map((requirement: string, idx: number) => (
                              <div key={idx} className="text-xs bg-purple-100 text-purple-800 px-3 py-2 rounded-lg border border-purple-200 shadow-sm">
                                ✓ {requirement}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Budget Breakdown */}
                {planResult.budgetBreakdown && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Budget Breakdown</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Card className="border-muted bg-background shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">₹{planResult.budgetBreakdown.accommodation?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Accommodation</p>
                        </CardContent>
                      </Card>
                      <Card className="border-muted bg-background shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">₹{planResult.budgetBreakdown.transportation?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Transportation</p>
                        </CardContent>
                      </Card>
                      <Card className="border-muted bg-background shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">₹{planResult.budgetBreakdown.food?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Food</p>
                        </CardContent>
                      </Card>
                      <Card className="border-muted bg-background shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">₹{planResult.budgetBreakdown.attractions?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Attractions</p>
                        </CardContent>
                      </Card>
                      <Card className="border-muted bg-background shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">₹{planResult.budgetBreakdown.miscellaneous?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Miscellaneous</p>
                        </CardContent>
                      </Card>
                      <Card className="border-green-200 bg-green-50 shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold text-green-600">₹{planResult.budgetBreakdown.total?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Total</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Roadmap */}
                {planResult.roadmap && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold">📅 Daily Itinerary ({planResult.roadmap.length} days)</h4>
                    </div>
                    <div className="space-y-4">
                      {planResult.roadmap.map((day: any) => (
                        <Card key={day.day}>
                          <CardHeader>
                            <CardTitle className="text-lg">Day {day.day}: {getLocationName(day)}</CardTitle>
                            <CardDescription>{day.date && new Date(day.date).toLocaleDateString()}</CardDescription>
                            <p className="text-sm">{day.summary}</p>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Activities */}
                            {day.activities && day.activities.length > 0 && (
                              <div>
                                <h5 className="font-semibold mb-2 flex items-center gap-2">
                                  <Camera className="w-4 h-4" />
                                  Activities ({day.activities.length})
                                </h5>
                                <div className="space-y-2">
                                  {day.activities.map((activity: any, idx: number) => (
                                    <div key={idx} className="border border-muted rounded-lg p-4 bg-background shadow-lg hover:shadow-xl transition-all duration-300">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                          <div className="font-medium text-lg mb-2">{activity.title}</div>
                                          <div className="text-sm text-muted-foreground mb-3">{activity.description}</div>
                                          <div className="text-xs text-muted-foreground mb-3 bg-muted px-3 py-2 rounded-lg">
                                            {activity.time} • {activity.duration} • ₹{activity.cost}
                                          </div>
                                          
                                          {/* Interest Match Badges */}
                                          {activity.interestMatch && activity.interestMatch.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-3">
                                              {activity.interestMatch.map((interest: string, i: number) => (
                                                <span key={i} className="text-xs bg-blue-100 text-blue-800 px-3 py-2 rounded-lg border border-blue-200 shadow-sm">
                                                  🎯 {interest}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          
                                          {/* Accessibility Info */}
                                          {activity.accessibilityInfo && (
                                            <div className="text-xs text-purple-600 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200 shadow-sm mb-3">
                                              ♿ {activity.accessibilityInfo}
                                            </div>
                                          )}
                                          
                                          {/* Dietary Considerations */}
                                          {activity.dietaryConsiderations && (
                                            <div className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg border border-green-200 shadow-sm mb-3">
                                              🍽️ {activity.dietaryConsiderations}
                                            </div>
                                          )}
                                          
                                          {activity.tips && (
                                            <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 shadow-sm">💡 {activity.tips}</div>
                                          )}
                                        </div>
                                        {activity.mapsUrl && (
                                          <MapButton
                                            url={activity.mapsUrl}
                                            title={activity.title}
                                            size="sm"
                                            variant="outline"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Meals */}
                            {day.meals && day.meals.length > 0 && (
                              <div>
                                <h5 className="font-semibold mb-2 flex items-center gap-2">
                                  <Utensils className="w-4 h-4" />
                                  Meals ({day.meals.length})
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  {day.meals.map((meal: any, idx: number) => (
                                    <div key={idx} className="text-sm border border-muted rounded-lg p-4 bg-background shadow-lg hover:shadow-xl transition-all duration-300">
                                      <div className="font-medium text-lg mb-2">{meal.type}</div>
                                      <div className="text-muted-foreground mb-3">{meal.suggestion}</div>
                                      <div className="text-xs text-muted-foreground mb-3 bg-muted px-3 py-2 rounded-lg">₹{meal.cost}</div>
                                      
                                      {/* Dietary Compliance */}
                                      {meal.dietaryCompliance && meal.dietaryCompliance.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-3">
                                          {meal.dietaryCompliance.map((diet: string, i: number) => (
                                            <span key={i} className="text-xs bg-green-100 text-green-800 px-3 py-2 rounded-lg border border-green-200 shadow-sm">
                                              ✓ {diet}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* Accessibility Info */}
                                      {meal.accessibilityInfo && (
                                        <div className="text-xs text-purple-600 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200 shadow-sm">
                                          ♿ {meal.accessibilityInfo}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Transportation */}
                            {day.transportation && (
              <div>
                                <h5 className="font-semibold mb-2 flex items-center gap-2">
                                  <Train className="w-4 h-4" />
                                  Transportation
                                </h5>
                                <div className="text-sm border rounded p-2">
                                  <div className="font-medium">{day.transportation.mode}</div>
                                  <div>{day.transportation.details}</div>
                                  <div className="text-xs text-muted-foreground">
                                    ₹{day.transportation.cost} • {day.transportation.duration}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Additional details */}
                            <div className="mt-4 pt-4 border-t border-muted">
                                {/* Accommodation for the day */}
                                {day.accommodation && (
                                  <div className="mt-2">
                                    <h5 className="font-semibold mb-2 flex items-center gap-2">
                                      🏨 Accommodation
                                    </h5>
                                    <div className="text-sm border rounded p-3 bg-muted/30">
                                      <div className="font-medium">{day.accommodation.name}</div>
                                      <div className="text-muted-foreground">₹{day.accommodation.price?.toLocaleString()}/night</div>
                                      {day.accommodation.location && (
                                        <div className="text-muted-foreground">{day.accommodation.location}</div>
                                      )}
                                      {day.accommodation.type && (
                                        <div className="text-muted-foreground">{day.accommodation.type}</div>
                                      )}
                                      {day.accommodation.amenities && (
                                        <div className="text-muted-foreground mt-1">
                                          Amenities: {day.accommodation.amenities.join(", ")}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Additional tips and notes */}
                                {day.tips && (
                                  <div className="mt-2">
                                    <h5 className="font-semibold mb-2 flex items-center gap-2">
                                      💡 Day Tips
                                    </h5>
                                    <div className="text-sm text-blue-600 bg-blue-50 rounded p-3">
                                      {day.tips}
                                    </div>
                                  </div>
                                )}

                                {/* Additional day information */}
                                {day.date && (
                                  <div className="mt-2">
                                    <h5 className="font-semibold mb-2 flex items-center gap-2">
                                      📅 Date Details
                                    </h5>
                                    <div className="text-sm text-muted-foreground">
                                      {new Date(day.date).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Weather information if available */}
                                {day.weather && (
                                  <div className="mt-2">
                                    <h5 className="font-semibold mb-2 flex items-center gap-2">
                                      🌤️ Weather
                                    </h5>
                                    <div className="text-sm text-muted-foreground">
                                      {day.weather}
                                    </div>
                                  </div>
                                )}

                                {/* Packing suggestions for the day */}
                                {day.packingSuggestions && (
                                  <div className="mt-2">
                                    <h5 className="font-semibold mb-2 flex items-center gap-2">
                                      🎒 Packing Suggestions
                                    </h5>
                                    <div className="text-sm text-muted-foreground">
                                      {day.packingSuggestions}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      {/* Trip Summary */}
                      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">📊 Trip Summary:</span>
                            <span>
                              {planResult.roadmap.reduce((total: number, day: any) => total + (day.activities?.length || 0), 0)} activities • {' '}
                              {planResult.roadmap.reduce((total: number, day: any) => total + (day.meals?.length || 0), 0)} meals • {' '}
                              {planResult.roadmap.length} days
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Trip Route Map */}
                {planResult.roadmap && planResult.roadmap.length > 0 && (
                  <div className="space-y-4">
                    <TripMap
                      destinations={planResult.roadmap.map((day: any) => {
                        const locationName = getLocationName(day);
                        return {
                          name: locationName,
                          location: locationName,
                          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}, India`,
                          day: day.day,
                        };
                      })}
                      title="Your Trip Route"
                    />
                  </div>
                )}

                {/* Directions Panel */}
                {planResult.roadmap && planResult.roadmap.length > 1 && (
                  <div className="space-y-4">
                    <DirectionsPanel
                      destinations={planResult.roadmap.map((day: any) => {
                        const locationName = getLocationName(day);
                        return {
                          name: locationName,
                          location: locationName,
                          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName)}, India`,
                          day: day.day,
                        };
                      })}
                      title="Navigation & Directions"
                    />
                  </div>
                )}

                {/* Attractions */}
                {planResult.attractions && planResult.attractions.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Must-Visit Attractions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {planResult.attractions.map((place: any, idx: number) => (
                        <Card key={idx} className="border-muted bg-background shadow-lg hover:shadow-xl transition-all duration-300">
                          <CardContent className="pt-6">
                            <h5 className="font-semibold text-lg mb-2">{place.name}</h5>
                            <p className="text-sm text-muted-foreground mb-3">{place.location}</p>
                            <p className="text-sm mb-4">{place.description}</p>
                            
                            {/* Interest Match Badges */}
                            {place.interestMatch && place.interestMatch.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {place.interestMatch.map((interest: string, i: number) => (
                                  <span key={i} className="text-xs bg-blue-100 text-blue-800 px-3 py-2 rounded-lg border border-blue-200 shadow-sm">
                                    🎯 {interest}
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            {/* Accessibility Info */}
                            {place.accessibilityInfo && (
                              <div className="text-xs text-purple-600 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200 shadow-sm mb-3">
                                ♿ {place.accessibilityInfo}
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between mt-4">
                              <div className="text-sm">
                                <div className="text-lg font-bold">₹{place.entryFee}</div>
                                <div className="text-xs text-muted-foreground">
                                  {place.bestTime} • {place.duration}
                                </div>
                              </div>
                              <MapButton
                                url={place.mapsUrl}
                                title={place.name}
                                size="sm"
                                variant="outline"
                              />
                            </div>
                            {place.tips && (
                              <div className="text-xs mt-3 text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 shadow-sm">💡 {place.tips}</div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Partner Hotels near destinations */}
                {planResult.destinations && planResult.destinations.length > 0 && accommodationType !== "na" && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Partner Hotels Near Your Trip</h4>
                    <PartnerHotelsPanel destinations={planResult.destinations} />
                  </div>
                )}

                {/* Accommodations */}
                {planResult.accommodations && planResult.accommodations.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Recommended Accommodations</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {planResult.accommodations.map((hotel: any, idx: number) => (
                        <Card key={idx} className="border-muted bg-background shadow-lg hover:shadow-xl transition-all duration-300">
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h5 className="font-semibold text-lg mb-2">{hotel.name}</h5>
                                <p className="text-sm text-muted-foreground mb-3">{hotel.location}</p>
                                <p className="text-sm mb-3">{hotel.type}</p>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-lg font-medium">₹{hotel.pricePerNight}/night</span>
                                  {hotel.rating && <span className="text-xs">⭐ {hotel.rating}</span>}
                                </div>
                                
                                {/* Accessibility Features */}
                                {hotel.accessibilityFeatures && hotel.accessibilityFeatures.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {hotel.accessibilityFeatures.map((feature: string, i: number) => (
                                      <span key={i} className="text-xs bg-purple-100 text-purple-800 px-3 py-2 rounded-lg border border-purple-200 shadow-sm">
                                        ♿ {feature}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Dietary Options */}
                                {hotel.dietaryOptions && hotel.dietaryOptions.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {hotel.dietaryOptions.map((option: string, i: number) => (
                                      <span key={i} className="text-xs bg-green-100 text-green-800 px-3 py-2 rounded-lg border border-green-200 shadow-sm">
                                        🍽️ {option}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                
                                {hotel.amenities && (
                                  <div className="flex flex-wrap gap-2">
                                    {hotel.amenities.slice(0, 3).map((amenity: string, i: number) => (
                                      <span key={i} className="text-xs bg-muted px-3 py-2 rounded-lg border border-muted shadow-sm">
                                        {amenity}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {hotel.mapsUrl && (
                                <MapButton
                                  url={hotel.mapsUrl}
                                  title={hotel.name}
                                  size="sm"
                                  variant="outline"
                                />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                

                {/* Restaurants */}
                {planResult.restaurants && planResult.restaurants.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Recommended Restaurants</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {planResult.restaurants.map((restaurant: any, idx: number) => (
                        <Card key={idx} className="border-muted bg-background shadow-lg hover:shadow-xl transition-all duration-300">
                          <CardContent className="pt-6">
                            <h5 className="font-semibold text-lg mb-2">{restaurant.name}</h5>
                            <p className="text-sm text-muted-foreground mb-3">{restaurant.cuisine}</p>
                            <p className="text-sm mb-4">{restaurant.location}</p>
                            
                            {/* Dietary Compliance */}
                            {restaurant.dietaryCompliance && restaurant.dietaryCompliance.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {restaurant.dietaryCompliance.map((diet: string, i: number) => (
                                  <span key={i} className="text-xs bg-green-100 text-green-800 px-3 py-2 rounded-lg border border-green-200 shadow-sm">
                                    ✓ {diet}
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            {/* Accessibility Info */}
                            {restaurant.accessibilityInfo && (
                              <div className="text-xs text-purple-600 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200 shadow-sm mb-3">
                                ♿ {restaurant.accessibilityInfo}
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between mt-4">
                              <div className="text-sm">
                                <div className="font-medium text-lg">{restaurant.priceRange}</div>
                                <div className="text-xs text-muted-foreground">
                                  {restaurant.specialties?.join(", ")}
                                </div>
                              </div>
                              <MapButton
                                url={restaurant.mapsUrl}
                                title={restaurant.name}
                                size="sm"
                                variant="outline"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}


                {/* Transportation Summary */}
                {planResult.transportation && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Transportation Overview</h4>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm mb-4">{planResult.transportation.summary}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {planResult.transportation.options?.map((option: any, idx: number) => (
                            <div key={idx} className="border rounded p-3">
                              <div className="font-medium">{option.mode}</div>
                              <div className="text-sm text-muted-foreground">{option.description}</div>
                              <div className="text-xs mt-1">
                                ₹{option.cost} • {option.duration}
                              </div>
                              <div className="text-xs text-blue-600 mt-1">💡 {option.tips}</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Packing List */}
                {planResult.packingList && planResult.packingList.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Packing Checklist</h4>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {planResult.packingList.map((item: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Checkbox id={`pack-${idx}`} />
                              <Label htmlFor={`pack-${idx}`} className="text-sm">
                                {item}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
              </div>
                )}

                {/* Local Tips */}
                {planResult.localTips && planResult.localTips.length > 0 && (
              <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Local Tips & Advice</h4>
                    <Card>
                      <CardContent className="pt-6">
                        <ul className="space-y-2">
                          {planResult.localTips.map((tip: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-blue-600 mt-1">💡</span>
                              <span className="text-sm">{tip}</span>
                      </li>
                    ))}
                  </ul>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Emergency Contacts */}
                {planResult.emergencyContacts && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Emergency Contacts</h4>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl mb-2">🚔</div>
                            <div className="font-medium">Police</div>
                            <div className="text-sm text-muted-foreground">{planResult.emergencyContacts.police}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl mb-2">🏥</div>
                            <div className="font-medium">Hospital</div>
                            <div className="text-sm text-muted-foreground">{planResult.emergencyContacts.hospital}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl mb-2">📞</div>
                            <div className="font-medium">Tourist Helpline</div>
                            <div className="text-sm text-muted-foreground">{planResult.emergencyContacts.touristHelpline}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Map Integration Summary */}
                <div className="space-y-6">
                  <MapStats
                    totalLocations={planResult.attractions?.length || 0}
                    totalActivities={planResult.roadmap?.reduce((total: number, day: any) => total + (day.activities?.length || 0), 0) || 0}
                  />

                  <MapsIntegrationSummary
                    destinations={planResult.destinations || []}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {suggestResult && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IndianRupee className="w-5 h-5" />
                  Destination Suggestions
                </CardTitle>
                <CardDescription>
                  {suggestResult.suggestions?.length} destinations matching your preferences (5-15 based on budget)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" onClick={handleClickOutside}>
                  {suggestResult.suggestions?.map((suggestion: any, idx: number) => (
                    <div key={idx} className="relative">
                      <Card className="h-full border-muted bg-background shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg break-words">{suggestion.destination}</CardTitle>
                              <CardDescription className="flex items-center gap-1 text-sm break-words">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{suggestion.state}, {suggestion.region}</span>
                              </CardDescription>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-green-600">
                                ₹{suggestion.estimatedCost?.toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {suggestion.budgetCategory}
                              </div>
                              {/* Preference Score */}
                              {suggestion.preferenceScore && (
                                <div className="text-xs mt-1">
                                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    🎯 {suggestion.preferenceScore}% Match
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Compact Info */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-3 h-3 flex-shrink-0" />
                              <span className="text-muted-foreground break-words">{suggestion.bestTimeToVisit}</span>
                            </div>
                            
                            {/* Interest Match Badges */}
                            {suggestion.interestMatch && suggestion.interestMatch.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {suggestion.interestMatch.slice(0, 3).map((interest: string, i: number) => (
                                  <span key={i} className="text-xs bg-blue-100 text-blue-800 px-3 py-2 rounded-lg border border-blue-200 shadow-sm">
                                    🎯 {interest}
                                  </span>
                                ))}
                                {suggestion.interestMatch.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{suggestion.interestMatch.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {suggestion.highlights && suggestion.highlights.length > 0 && (
                              <div className="text-xs text-muted-foreground break-words line-clamp-2">
                                {suggestion.highlights.slice(0, 2).join(" • ")}
                              </div>
                            )}
                          </div>

                          {/* Quick Budget Preview */}
                          {suggestion.breakdown && (
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span>Stay:</span>
                                <span>₹{suggestion.breakdown.accommodation?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Activities:</span>
                                <span>₹{suggestion.breakdown.attractions?.toLocaleString()}</span>
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            {suggestion.samplePlan?.accommodations?.[0]?.mapsUrl && (
                              <MapButton
                                url={suggestion.samplePlan.accommodations[0].mapsUrl}
                                title={`${suggestion.destination} Accommodation`}
                                variant="outline"
                                size="sm"
                                className="flex-1"
                              />
                            )}
                            <Button 
                              className="flex-1" 
                              variant="default" 
                              size="sm"
                              onClick={() => setExpandedSuggestion(expandedSuggestion === idx ? null : idx)}
                            >
                              View Full Details
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Full Details Popup */}
                      {expandedSuggestion === idx && (
                        <>
                          {/* Backdrop */}
                          <div 
                            className="fixed inset-0 bg-black/50 z-40"
                            onClick={() => setExpandedSuggestion(null)}
                          />
                          {/* Popup */}
                          <div className={`suggestion-popup ${getPopupClasses().position} bg-blue-50 border border-blue-200 rounded-lg shadow-2xl p-4 ${getPopupClasses().width} ${getPopupClasses().height} overflow-y-auto max-w-[95vw] max-h-[95vh]`}>
                          <div className="space-y-3">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-blue-200 pb-3">
                              <div>
                                <h3 className="text-2xl font-bold text-blue-800 break-words">{suggestion.destination}</h3>
                                <p className="text-muted-foreground break-words">{suggestion.state}, {suggestion.region}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {/* Width Adjustment Controls */}
                                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPopupWidth('sm');
                                    }}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                      popupWidth === 'sm' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/20'
                                    }`}
                                    title="Small"
                                  >
                                    SM
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPopupWidth('md');
                                    }}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                      popupWidth === 'md' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/20'
                                    }`}
                                    title="Medium"
                                  >
                                    MD
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPopupWidth('lg');
                                    }}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                      popupWidth === 'lg' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/20'
                                    }`}
                                    title="Large"
                                  >
                                    LG
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPopupWidth('xl');
                                    }}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                      popupWidth === 'xl' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted-foreground/20'
                                    }`}
                                    title="Extra Large"
                                  >
                                    XL
                                  </button>
                                </div>
                                <button
                                  onClick={() => setExpandedSuggestion(null)}
                                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                                  title="Close popup"
                                >
                                  ×
                                </button>
                              </div>
                            </div>

                            {/* Full Day Details */}
                            {suggestion.samplePlan?.roadmap && (
                              <div className="space-y-2">
                                <h4 className="text-base font-bold text-blue-700 bg-blue-100 px-3 py-2 rounded-lg border-l-4 border-blue-500">
                                  📅 Complete Daily Itinerary
                                </h4>
                                {suggestion.samplePlan.roadmap.map((day: any, dayIdx: number) => (
                                  <div key={dayIdx} className="border rounded-lg p-4 bg-gray-50">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                                        {day.day}
                                      </div>
                                      <h5 className="font-semibold text-lg">Day {day.day}</h5>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-3">{day.summary}</p>
                                    
                                    {/* Activities with Location Links */}
                                    {day.activities && (
                                      <div className="space-y-2">
                                        <h6 className="font-medium text-sm">Activities:</h6>
                                        {day.activities.map((activity: any, actIdx: number) => (
                                          <div key={actIdx} className="flex items-start gap-3 p-2 bg-white rounded border">
                                            <div className="flex-1">
                                              <div className="font-medium text-sm break-words">{activity.title}</div>
                                              {activity.description && (
                                                <div className="text-xs text-muted-foreground mt-1 break-words">
                                                  {activity.description}
                                                </div>
                                              )}
                                              {activity.location && (
                                                <div className="text-xs text-blue-600 mt-1 break-words">
                                                  📍 {activity.location}
                                                </div>
                                              )}
                                            </div>
                                            {activity.location && (
                                              <MapButton
                                                url={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}, ${encodeURIComponent(suggestion.destination)}, ${encodeURIComponent(preferredLocation || suggestion.state)}, India`}
                                                title={activity.title}
                                                size="sm"
                                                variant="outline"
                                              />
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Accommodation for the day */}
                                    {day.accommodation && (
                                      <div className="mt-3 p-2 bg-green-50 rounded border">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <div className="font-medium text-sm text-green-800">
                                              🏨 {day.accommodation.name}
                                            </div>
                                            <div className="text-xs text-green-600">
                                              ₹{day.accommodation.price?.toLocaleString()}/night
                                            </div>
                                          </div>
                                          {day.accommodation.location && (
                                            <MapButton
                                              url={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.accommodation.location)}, ${encodeURIComponent(suggestion.destination)}, ${encodeURIComponent(preferredLocation || suggestion.state)}, India`}
                                              title={day.accommodation.name}
                                              size="sm"
                                              variant="outline"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Detailed Budget Breakdown */}
                            {suggestion.breakdown && (
                              <div className="space-y-2">
                                <h4 className="text-base font-bold text-green-700 bg-green-100 px-3 py-2 rounded-lg border-l-4 border-green-500">
                                  💰 Detailed Budget Breakdown
                                </h4>
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                                    <div className="text-xs font-medium text-blue-800 mb-1">✈️ Flights</div>
                                    <div className="text-sm font-bold text-blue-900">₹{suggestion.breakdown.flights?.toLocaleString()}</div>
                                  </div>
                                  <div className="p-2 bg-green-50 rounded-lg border border-green-200">
                                    <div className="text-xs font-medium text-green-800 mb-1">🏨 Stay</div>
                                    <div className="text-sm font-bold text-green-900">₹{suggestion.breakdown.accommodation?.toLocaleString()}</div>
                                  </div>
                                  <div className="p-2 bg-orange-50 rounded-lg border border-orange-200">
                                    <div className="text-xs font-medium text-orange-800 mb-1">🍽️ Food</div>
                                    <div className="text-sm font-bold text-orange-900">₹{suggestion.breakdown.food?.toLocaleString()}</div>
                                  </div>
                                  <div className="p-2 bg-purple-50 rounded-lg border border-purple-200">
                                    <div className="text-xs font-medium text-purple-800 mb-1">🚗 Transport</div>
                                    <div className="text-sm font-bold text-purple-900">₹{suggestion.breakdown.localTransport?.toLocaleString()}</div>
                                  </div>
                                  <div className="p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                                    <div className="text-xs font-medium text-yellow-800 mb-1">🎯 Activities</div>
                                    <div className="text-sm font-bold text-yellow-900">₹{suggestion.breakdown.attractions?.toLocaleString()}</div>
                                  </div>
                                  <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className="text-xs font-medium text-gray-800 mb-1">📦 Misc</div>
                                    <div className="text-sm font-bold text-gray-900">₹{suggestion.breakdown.miscellaneous?.toLocaleString()}</div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Transportation Details */}
                            {suggestion.transportation && (
                              <div className="space-y-2">
                                <h4 className="text-base font-bold text-purple-700 bg-purple-100 px-3 py-2 rounded-lg border-l-4 border-purple-500">
                                  🚗 Transportation Details
                                </h4>
                                
                                {/* Primary Transportation Option */}
                                {suggestion.transportation.toDestination && (
                                  <div className="p-4 bg-purple-50 rounded-lg mb-3">
                                    <div className="font-medium text-purple-800 mb-2">Primary Option: {suggestion.transportation.toDestination.mode}</div>
                                    <div className="text-sm text-muted-foreground">
                                      Duration: {suggestion.transportation.toDestination.duration}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      Cost: ₹{suggestion.transportation.toDestination.cost?.toLocaleString()}
                                    </div>
                                    {suggestion.transportation.toDestination.tips && (
                                      <div className="text-sm text-blue-600 mt-2">
                                        💡 {suggestion.transportation.toDestination.tips}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* All Available Transportation Options */}
                                {suggestion.transportation.availableOptions && suggestion.transportation.availableOptions.length > 0 && (
                                  <div className="space-y-3">
                                    <div className="text-sm font-medium text-muted-foreground">All Available Options:</div>
                                    {suggestion.transportation.availableOptions.map((option: any, idx: number) => (
                                      <div key={idx} className="p-3 bg-gray-50 rounded-lg border">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="font-medium text-sm">{option.mode}</div>
                                          <div className="text-sm font-bold text-green-600">₹{option.cost?.toLocaleString()}</div>
                                        </div>
                                        <div className="text-sm text-muted-foreground mb-1">
                                          Duration: {option.duration}
                                        </div>
                                        {option.description && (
                                          <div className="text-sm text-muted-foreground mb-1">
                                            {option.description}
                                          </div>
                                        )}
                                        {option.tips && (
                                          <div className="text-sm text-blue-600">
                                            💡 {option.tips}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Tips and Notes */}
                            <div className="space-y-2">
                              <h4 className="text-base font-bold text-orange-700 bg-orange-100 px-3 py-2 rounded-lg border-l-4 border-orange-500">
                                💡 Travel Tips & Notes
                              </h4>
                              <div className="space-y-2">
                                {suggestion.localTips?.map((tip: string, i: number) => (
                                  <div key={i} className="flex items-start gap-2 p-2 bg-blue-50 rounded">
                                    <span className="text-blue-600 mt-1">💡</span>
                                    <span className="text-sm">{tip}</span>
                                  </div>
                                ))}
                                {suggestion.safetyNotes?.map((note: string, i: number) => (
                                  <div key={i} className="flex items-start gap-2 p-2 bg-orange-50 rounded">
                                    <span className="text-orange-600 mt-1">⚠️</span>
                                    <span className="text-sm">{note}</span>
                                  </div>
                                ))}
                                {suggestion.culturalNotes?.map((note: string, i: number) => (
                                  <div key={i} className="flex items-start gap-2 p-2 bg-green-50 rounded">
                                    <span className="text-green-600 mt-1">🏛️</span>
                                    <span className="text-sm">{note}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Overall Route Map for all Suggestions */}
            {suggestResult.suggestions && suggestResult.suggestions.length > 1 && (
              <div className="mt-8">
                <TripMap
                  destinations={suggestResult.suggestions.map((suggestion: any, index: number) => ({
                    name: suggestion.destination,
                    location: `${suggestion.state}, India`,
                    mapsUrl: suggestion.samplePlan?.accommodations?.[0]?.mapsUrl ||
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(suggestion.destination)}, ${encodeURIComponent(preferredLocation || suggestion.state)}, India`,
                    day: index + 1,
                  }))}
                  title="Compare All Suggested Destinations"
                />
              </div>
            )}
          </div>
        )}
        </div>

        {/* Footer */}
        <footer className="transform scale-60">
          
          <div className="max-w-7xl mx-auto px-4 py-0 sm:px-6 lg:px-8">
            
            <div className="flex flex-col items-center justify-center">
              <div className="transform scale-90">
                <ThemeLogo />
              </div>
              <p className="text-muted-foreground text-sm  -mt-1 md:-mt-2">
                Plan, compare, and map your next adventure
              </p>
            </div>
          </div>
         </footer>
       </SignedIn>
    </>
  );
}
