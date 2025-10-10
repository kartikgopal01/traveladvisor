"use client";

import {
  RiArrowRightSLine,
  RiFileTextLine,
  RiHomeLine,
  RiEditLine,
  RiCheckLine,
  RiCloseLine,
} from "@remixicon/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { RiMapPinFill } from "@remixicon/react";
import { useGeolocation } from "@/components/maps/use-geolocation";
import { useAuth } from "@clerk/nextjs";
import { RiSettingsLine, RiCalendarLine } from "@remixicon/react";
// Simple scroll visibility hook
function useScrollVisibility() {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsVisible(currentScrollY < lastScrollY || currentScrollY < 10);
      lastScrollY = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return isVisible;
}

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
  const isHeaderVisible = useScrollVisibility();
  
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
    <nav className={`fixed top-16 sm:top-18 left-0 right-0 z-40 flex items-center justify-between text-sm text-muted-foreground px-2 sm:px-4 py-2 glass-navigation backdrop-blur-glass transition-transform duration-300 ${
      isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
    }`}>
      <div className="flex items-center space-x-1 min-w-0 flex-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <RiHomeLine className="h-4 w-4" />
          </Link>
        </Button>

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

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
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
        
        <div className="flex items-center gap-1 sm:gap-2">
          <RiMapPinFill className="h-4 w-4 text-foreground flex-shrink-0" />
          <span className="text-foreground text-xs sm:text-sm truncate max-w-24 sm:max-w-none">
            {navCity || (geoStatus === "granted" ? "Locating..." : "Detecting location...")}
          </span>
        </div>
      </div>
    </nav>
  );
}
