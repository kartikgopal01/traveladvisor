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
          className="rounded-full shadow-lg bg-foreground text-background w-12 h-12 flex items-center justify-center"
          onClick={() => setOpen(true)}
          aria-label="Open travel assistant"
        >
          <RiChat3Line className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="w-[360px] max-w-[90vw] h-[60vh] bg-background border rounded-lg shadow-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="text-sm font-medium">Travel Assistant</div>
            <button className="p-1" onClick={() => setOpen(false)} aria-label="Close">
              <RiCloseLine className="w-5 h-5" />
            </button>
          </div>
          <div className="p-3 overflow-y-auto flex-1">
            <ChatPlaces defaultCity={city} />
          </div>
        </div>
      )}
    </div>
  );
}


