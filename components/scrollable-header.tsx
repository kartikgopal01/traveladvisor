"use client";

import { useEffect, useState } from "react";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeLogo } from "@/components/ui/theme-logo";
import {
  RiArrowRightSLine,
  RiFileTextLine,
  RiHomeLine,
  RiEditLine,
  RiCheckLine,
  RiCloseLine,
  RiMapPinFill,
  RiSettingsLine,
  RiCalendarLine,
  RiRefreshLine,
  RiLoader4Line,
  RiRoadMapLine,
} from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@clerk/nextjs";
import { useGeolocation } from "@/components/maps/use-geolocation";
import { useTheme } from "next-themes";

export function ScrollableHeader() {
  const pathname = usePathname();
  const { userId } = useAuth();
  const { theme } = useTheme();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [documentTitle, setDocumentTitle] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const { status: geoStatus, location, error: geoError, request } = useGeolocation();
  const [navCity, setNavCity] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    async function checkAdminStatus() {
      if (!userId) {
        setIsAdmin(false);
        return;
      }
      
      try {
        const response = await fetch("/api/admin/events");
        setIsAdmin(response.ok);
      } catch {
        setIsAdmin(false);
      }
    }
    
    checkAdminStatus();
  }, [userId]);

  // Reverse geocode when location updates
  useEffect(() => {
    async function run() {
      try {
        if (location) {
          const res = await fetch(`/api/geo/reverse?lat=${location.lat}&lng=${location.lng}`);
          const data = await res.json();
          if (res.ok) { 
            setNavCity(data.city || data.state || null); 
            return; 
          }
        }
        // Fallback to client IP geolocation
        if (!location) {
          const rr = await fetch("https://ipapi.co/json/");
          if (rr.ok) {
            const d = await rr.json();
            setNavCity(d?.city || d?.region || null);
          }
        }
      } catch {}
    }
    run();
  }, [location?.lat, location?.lng]);

  const handleEditClick = () => {
    if (!documentTitle || !documentId) return;
    setEditTitle(documentTitle);
    setIsEditing(true);
  };

  const handleSaveTitle = async () => {
    if (!documentId || !userId || !editTitle.trim()) return;

    setIsUpdating(true);
    try {
      setDocumentTitle(editTitle.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating document title:", error);
      setEditTitle(documentTitle || "");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle("");
  };

  const getBreadcrumbs = () => {
    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const path = `/${segments.slice(0, i + 1).join("/")}`;

      if (segment === "dashboard") {
        breadcrumbs.push({ label: "Dashboard", path, icon: null, editable: false });
      } else if (segment === "docs") {
        continue;
      } else if (segment === "new") {
        breadcrumbs.push({ label: "New Document", path, icon: null, editable: false });
      } else if (segment !== "[id]" && segment.length > 0) {
        const title = documentTitle || "Document";
        breadcrumbs.push({ 
          label: title, 
          path, 
          icon: RiFileTextLine, 
          editable: true,
          isDocument: true 
        });
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 glass-header header-always-visible ${
        theme === 'dark' ? 'no-dynamic-colors' : 'dynamic-header-bg-medium'
      }`}
    >
      {/* Main header content */}
      <div className={`w-full px-2 sm:px-4 md:px-6 lg:px-8 h-16 sm:h-20 md:h-24 flex items-center justify-between ${
        theme === 'dark' ? 'glass-header-content-dark-medium' : 'glass-header-content-medium'
      }`}>
        <div className="flex items-center overflow-hidden">
          <a href="/" className="flex items-center justify-center h-full max-w-[120px] sm:max-w-none sm:h-16 sm:w-full ml-2 sm:ml-4 md:ml-25 overflow-hidden" title="Happy Journey - Go to Home">
            <div className="h-full w-full max-w-[100px] sm:max-w-none sm:h-full sm:w-full flex items-center justify-center">
              <ThemeLogo />
            </div>
          </a>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
          {/* Admin buttons */}
          {userId && isAdmin && (
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="touch-target">
                <Link href="/admin/events">
                  <RiCalendarLine className="h-4 w-4" />
                  <span className="hidden lg:inline ml-1">Admin Events</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="touch-target">
                <Link href="/admin/hotels">
                  <RiSettingsLine className="h-4 w-4" />
                  <span className="hidden lg:inline ml-1">Admin Hotels</span>
                </Link>
              </Button>
            </div>
          )}

          {/* Auth buttons */}
          <Button variant="ghost" size="sm" asChild className="border border-border icon-hover-enhanced touch-target">
            <Link href="/">
              <RiHomeLine className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
          </Button>
          
          {/* Trips Button - After Home */}
          <Button variant="ghost" size="sm" asChild className="border border-border icon-hover-enhanced touch-target">
            <Link href="/trips">
              <RiRoadMapLine className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
          </Button>
          
          <ThemeToggle />
          
          <SignedOut>
            <div className="flex items-center gap-1 sm:gap-2">
              <SignInButton mode="modal">
                <button className="px-2 sm:px-3 md:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-muted transition-colors btn-hover-enhanced touch-target">
                  <span className="hidden sm:inline">Sign In</span>
                  <span className="sm:hidden">Sign In</span>
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-2 sm:px-3 md:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium text-background bg-foreground border border-foreground rounded-md hover:bg-foreground/90 transition-colors btn-hover-enhanced touch-target">
                  <span className="hidden sm:inline">Sign Up</span>
                  <span className="sm:hidden">Sign Up</span>
                </button>
              </SignUpButton>
            </div>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
          
          {/* Location Button - After Auth */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => request()}
            disabled={geoStatus === "prompt"}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm icon-hover-enhanced touch-target"
            title={geoStatus === "prompt" ? "Detecting location..." : "Refresh location"}
          >
            {geoStatus === "prompt" ? (
              <RiLoader4Line className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
            ) : (
              <RiMapPinFill className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
            <span className="hidden sm:inline">
              {geoStatus === "prompt" ? "Detecting..." : 
               geoStatus === "granted" ? (navCity || "Located") : 
               geoStatus === "denied" ? "Location Denied" : "Detect Location"}
            </span>
          </Button>
        </div>
      </div>

    </header>
  );
}
