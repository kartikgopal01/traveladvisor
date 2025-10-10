"use client";

import {
  RiArrowRightSLine,
  RiFileTextLine,
  RiHomeLine,
  RiEditLine,
  RiCheckLine,
  RiCloseLine,
  RiSearchLine,
  RiMapPinLine,
  RiMoneyDollarCircleLine,
  RiHotelLine,
  RiMap2Line,
} from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { RiMapPinFill } from "@remixicon/react";
import { useGeolocation } from "@/components/maps/use-geolocation";
import { useAuth, SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { RiSettingsLine, RiCalendarLine } from "@remixicon/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemeLogo } from "@/components/ui/theme-logo";

export default function Navigation() {
  const pathname = usePathname();
  const { userId } = useAuth();
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
      
      // Optional: Add your Firebase update logic here
      // const response = await fetch(`/api/documents/${documentId}`, {
      //   method: "PATCH",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ title: editTitle.trim() }),
      // });
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

  // Always show navigation so location badge is visible on the landing page

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
      } else if (segment === "events") {
        breadcrumbs.push({ label: "Events", path, icon: RiCalendarLine, editable: false });
      } else if (segment === "trips") {
        breadcrumbs.push({ label: "Trips", path, icon: RiMap2Line, editable: false });
      } else if (segment === "admin") {
        breadcrumbs.push({ label: "Admin", path, icon: RiSettingsLine, editable: false });
      } else if (segment === "hotels") {
        breadcrumbs.push({ label: "Hotels", path, icon: RiHotelLine, editable: false });
      } else if (segment === "search") {
        breadcrumbs.push({ label: "Search", path, icon: RiSearchLine, editable: false });
      } else if (segment === "location") {
        breadcrumbs.push({ label: "Location Search", path, icon: RiMapPinLine, editable: false });
      } else if (segment === "price") {
        breadcrumbs.push({ label: "Price Search", path, icon: RiMoneyDollarCircleLine, editable: false });
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
    <header className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
        {/* Left side - Logo and Breadcrumbs */}
        <div className="flex items-center gap-4">
          <a href="/" className="flex items-center" title="Happy Journey - Go to Home">
            <div className="transform scale-25">
              <ThemeLogo />
            </div>
          </a>
          
          {/* Breadcrumbs */}
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <RiHomeLine className="h-4 w-4" />
              </Link>
            </Button>

            {breadcrumbs.map((breadcrumb, index) => (
            <div key={breadcrumb.path} className="flex items-center">
              <RiArrowRightSLine className="h-4 w-4 mr-2" />
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium text-foreground flex items-center gap-2 group">
                  {breadcrumb.icon && (
                    <breadcrumb.icon className="h-4 w-4 inline" />
                  )}
                  {breadcrumb.editable && breadcrumb.isDocument && isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-6 text-sm w-48"
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
                        className="h-6 w-6 p-0"
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
                        className="h-6 w-6 p-0"
                        title="Cancel editing"
                      >
                        <RiCloseLine className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span>{breadcrumb.label}</span>
                      {breadcrumb.editable && breadcrumb.isDocument && canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleEditClick}
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit document title"
                        >
                          <RiEditLine className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </span>
              ) : (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={breadcrumb.path}>
                    {breadcrumb.icon && (
                      <breadcrumb.icon className="h-4 w-4 mr-1" />
                    )}
                    {breadcrumb.label}
                  </Link>
                </Button>
              )}
            </div>
            ))}
          </div>
        </div>

        {/* Right side - Navigation, Admin, Location, Auth */}
        <div className="flex items-center gap-4">
          {/* Main Navigation */}
          <nav className="flex items-center gap-4">
            <SignedIn>
              <a href="/trips" className="text-sm text-foreground hover:text-primary transition-colors">
                Trips
              </a>
            </SignedIn>
          </nav>

          {/* Admin Controls */}
          {userId && isAdmin && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/events">
                  <RiCalendarLine className="h-4 w-4" />
                  Admin Events
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/hotels">
                  <RiSettingsLine className="h-4 w-4" />
                  Admin Hotels
                </Link>
              </Button>
            </div>
          )}
          
          {/* Location Display */}
          <div className="flex items-center gap-2">
            <RiMapPinFill className="h-4 w-4 text-foreground" />
            <span className="text-sm text-foreground">
              {navCity || (geoStatus === "granted" ? "Locating..." : "Detecting location...")}
            </span>
          </div>

          {/* Theme Toggle and Auth */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <SignedOut>
              <div className="flex items-center gap-2">
                <SignInButton mode="modal">
                  <button className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md hover:bg-muted transition-colors">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-4 py-2 text-sm font-medium text-background bg-foreground border border-foreground rounded-md hover:bg-foreground/90 transition-colors">
                    Sign Up
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </div>
    </header>
  );
}
