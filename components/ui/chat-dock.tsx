"use client";

import { useEffect, useState } from "react";
import { RiChat3Line, RiCloseLine } from "@remixicon/react";
import ChatPlaces from "./chat-places";

export default function ChatDock() {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    // Listen to navbar city updates
    const handler = (e: any) => setCity(e?.detail || null);
    // @ts-ignore
    if (typeof window !== 'undefined') {
      // @ts-ignore
      setCity((window as any).__NAV_CITY__ || null);
      window.addEventListener('nav-city', handler as any);
    }
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('nav-city', handler as any);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open && (
        <button
          className="rounded-full shadow-lg bg-foreground text-background w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center hover:scale-105 transition-transform"
          onClick={() => setOpen(true)}
          aria-label="Open travel assistant"
        >
          <RiChat3Line className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {open && (
        <div className="w-[320px] sm:w-[360px] md:w-[400px] max-w-[90vw] h-[50vh] sm:h-[60vh] md:h-[70vh] bg-background border rounded-lg shadow-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="text-sm font-medium">Travel Assistant</div>
            <button className="p-1 hover:bg-muted rounded transition-colors" onClick={() => setOpen(false)} aria-label="Close">
              <RiCloseLine className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
          <div className="p-2 sm:p-3 overflow-y-auto flex-1">
            <ChatPlaces defaultCity={city} />
          </div>
        </div>
      )}
    </div>
  );
}


