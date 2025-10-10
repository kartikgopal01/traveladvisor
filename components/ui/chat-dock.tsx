"use client";

import { useEffect, useState } from "react";
import { RiChat3Line, RiCloseLine } from "@remixicon/react";
import ChatPlaces from "./chat-places";

export default function ChatDock() {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [chatSize, setChatSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');

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

  // Get chat size classes
  const getChatSizeClasses = () => {
    switch (chatSize) {
      case 'sm': return {
        width: 'w-80 max-w-[90vw]',
        height: 'h-96 max-h-[60vh]'
      };
      case 'md': return {
        width: 'w-96 max-w-[90vw]',
        height: 'h-[50vh] sm:h-[60vh] md:h-[70vh]'
      };
      case 'lg': return {
        width: 'w-[28rem] max-w-[90vw]',
        height: 'h-[60vh] sm:h-[70vh] md:h-[80vh]'
      };
      case 'xl': return {
        width: 'w-[32rem] max-w-[90vw]',
        height: 'h-[70vh] sm:h-[80vh] md:h-[90vh]'
      };
      default: return {
        width: 'w-96 max-w-[90vw]',
        height: 'h-[50vh] sm:h-[60vh] md:h-[70vh]'
      };
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open && (
        <button
          className="rounded-full shadow-lg bg-foreground text-background w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center hover:scale-105 transition-transform btn-hover-enhanced"
          onClick={() => setOpen(true)}
          aria-label="Open travel assistant"
        >
          <RiChat3Line className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {open && (
        <div className={`${getChatSizeClasses().width} ${getChatSizeClasses().height} bg-background/95 backdrop-blur-lg border border-border/50 rounded-lg shadow-2xl overflow-hidden flex flex-col`}>
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="text-sm font-medium">Travel Assistant</div>
            <div className="flex items-center gap-2">
              {/* Size Adjustment Controls */}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatSize('sm');
                  }}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    chatSize === 'sm'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Small (320px width, 60% height)"
                >
                  S
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatSize('md');
                  }}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    chatSize === 'md'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Medium (384px width, 70% height)"
                >
                  M
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatSize('lg');
                  }}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    chatSize === 'lg'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Large (448px width, 80% height)"
                >
                  L
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatSize('xl');
                  }}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    chatSize === 'xl'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Extra Large (512px width, 90% height)"
                >
                  XL
                </button>
              </div>
              <button className="p-1 hover:bg-muted rounded transition-colors icon-hover-enhanced" onClick={() => setOpen(false)} aria-label="Close">
                <RiCloseLine className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
          <div className="p-2 sm:p-3 overflow-y-auto flex-1">
            <ChatPlaces defaultCity={city} />
          </div>
        </div>
      )}
    </div>
  );
}


