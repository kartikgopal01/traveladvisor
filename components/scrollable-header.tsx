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
  
  console.log('ScrollableHeader rendering - ALWAYS VISIBLE');
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [documentTitle, setDocumentTitle] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const { status: geoStatus, location, error: geoError, request } = useGeolocation();
  const [navCity, setNavCity] = useState<string | null>(null);

  // Export navCity to window so home can read it as a last resort
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.__NAV_CITY__ = navCity;
      try {
        window.dispatchEvent(new CustomEvent('nav-city', { detail: navCity }));
      } catch {}
    }
  }, [navCity]);

  // Simplified document title handling without Firebase
  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "docs" && segments[1] && segments[1] !== "[id]") {
      const docId = segments[1];
      setDocumentId(docId);
      // For now, use a generic title - you can enhance this later with Firebase
      setDocumentTitle("Document");
      setCanEdit(userId ? true : false);
    } else {
      setDocumentTitle(null);
      setDocumentId(null);
      setCanEdit(false);
    }
  }, [pathname, userId]);

  // Auto request location on mount
  useEffect(() => {
    request();
  }, []);

  // Check if user is admin
  useEffect(() => {
    async function checkAdminStatus() {
      if (!userId) {
        setIsAdmin(false);
        return;
      }
      
      try {
        // Test admin access by trying to fetch admin data
        const response = await fetch("/api/admin/events");
        setIsAdmin(response.ok);
      } catch {
        setIsAdmin(false);
      }
    }
    
    checkAdminStatus();
  }, [userId]);

  // Reverse geocode when location updates; fallback to client IP geolocation
  useEffect(() => {
    async function run() {
      try {
        if (location) {
          const res = await fetch(`/api/geo/reverse?lat=${location.lat}&lng=${location.lng}`);
          const data = await res.json();
          if (res.ok) { setNavCity(data.city || data.state || null); return; }
        }
        // If no GPS, approximate via client IP
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
      // Simplified save - you can enhance this with Firebase later
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
        // Skip adding "Documents" as a separate breadcrumb
        continue;
      } else if (segment === "new") {
        breadcrumbs.push({ label: "New Document", path, icon: null, editable: false });
      } else if (segment !== "[id]" && segment.length > 0) {
        // This is likely a document ID - use the fetched title or fallback
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
      <div className={`w-full px-4 sm:px-6 lg:px-8 h-20 sm:h-24 flex items-center justify-between ${
        theme === 'dark' ? 'glass-header-content-dark-medium' : 'glass-header-content-medium'
      }`}>
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center mr-4 sm:ml-6" title="Happy Journey - Go to Home">
            <div className="transform scale-20 sm:scale-25">
              <ThemeLogo />
            </div>
          </a>
          
          {/* Breadcrumbs */}
          <div className="hidden sm:flex items-center space-x-1 min-w-0">
            {breadcrumbs.map((breadcrumb, index) => (
            <div key={breadcrumb.path} className="flex items-center min-w-0">
              <RiArrowRightSLine className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium text-foreground flex items-center gap-1 sm:gap-2 group min-w-0">
                  {breadcrumb.icon && (
                    <breadcrumb.icon className="h-4 w-4 inline flex-shrink-0" />
                  )}
                  {breadcrumb.editable && breadcrumb.isDocument && isEditing ? (
                    <div className="flex items-center gap-1 min-w-0">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-6 text-sm w-32 sm:w-48"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSaveTitle();
                          } else if (e.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveTitle}
                        disabled={isUpdating}
                        className="h-6 w-6 p-0 flex-shrink-0"
                        title="Save changes"
                      >
                        {isUpdating ? (
                          <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                        ) : (
                          <RiCheckLine className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={isUpdating}
                        className="h-6 w-6 p-0 flex-shrink-0"
                        title="Cancel editing"
                      >
                        <RiCloseLine className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="truncate">{breadcrumb.label}</span>
                      {breadcrumb.editable && breadcrumb.isDocument && canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleEditClick}
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="Edit document title"
                        >
                          <RiEditLine className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </span>
              ) : (
                <Button variant="ghost" size="sm" asChild className="min-w-0">
                  <Link href={breadcrumb.path}>
                    {breadcrumb.icon && (
                      <breadcrumb.icon className="h-4 w-4 mr-1 flex-shrink-0" />
                    )}
                    <span className="truncate">{breadcrumb.label}</span>
                  </Link>
                </Button>
              )}
            </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Admin buttons */}
          {userId && isAdmin && (
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/events">
                  <RiCalendarLine className="h-4 w-4" />
                  <span className="hidden lg:inline ml-1">Admin Events</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/hotels">
                  <RiSettingsLine className="h-4 w-4" />
                  <span className="hidden lg:inline ml-1">Admin Hotels</span>
                </Link>
              </Button>
            </div>
          )}

          {/* Auth buttons */}
          <Button variant="ghost" size="sm" asChild className="border border-border">
            <Link href="/">
              <RiHomeLine className="h-4 w-4" />
            </Link>
          </Button>
          
          {/* Trips Button - After Home */}
          <Button variant="ghost" size="sm" asChild className="border border-border">
            <Link href="/trips">
              <RiRoadMapLine className="h-4 w-4" />
            </Link>
          </Button>
          
          <ThemeToggle />
          
          <SignedOut>
            <div className="flex items-center gap-1 sm:gap-2">
              <SignInButton mode="modal">
                <button className="px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-muted transition-colors">
                  <span className="hidden sm:inline">Sign In</span>
                  <span className="sm:hidden">Sign In</span>
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-medium text-background bg-foreground border border-foreground rounded-md hover:bg-foreground/90 transition-colors">
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
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
            title={geoStatus === "prompt" ? "Detecting location..." : "Refresh location"}
          >
            {geoStatus === "prompt" ? (
              <RiLoader4Line className="h-4 w-4 animate-spin" />
            ) : (
              <RiMapPinFill className="h-4 w-4" />
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

