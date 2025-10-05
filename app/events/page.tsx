"use client";

import { EventsSection } from "@/components/ui";

export default function EventsPage() {
  return (
    <div className="min-h-screen px-6 py-10 max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Upcoming Events
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Discover events and activities around you
        </p>
      </div>

      <EventsSection showModeToggle={true} limit={20} />
    </div>
  );
}
