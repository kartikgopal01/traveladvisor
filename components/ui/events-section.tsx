"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EventCard } from "./event-card";
import { Calendar, MapPin, Filter } from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  city?: string;
  state?: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  category?: string;
  price?: number;
  maxCapacity?: number;
  currentCapacity?: number;
  imageUrl?: string;
  organizer?: string;
  contactEmail?: string;
  contactPhone?: string;
  mapsUrl?: string;
  website?: string;
  tags?: string[];
}

interface EventsSectionProps {
  city?: string;
  limit?: number;
  showRecent?: boolean;
  showModeToggle?: boolean;
}

export function EventsSection({ city, limit = 6, showRecent = false, showModeToggle = false }: EventsSectionProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [currentMode, setCurrentMode] = useState<'recent' | 'nearby'>('recent');

  const categories = [
    "Cultural Festival",
    "Music & Entertainment", 
    "Food & Culinary",
    "Adventure & Sports",
    "Art & Exhibition",
    "Religious & Spiritual",
    "Educational & Workshop",
    "Business & Networking",
    "Health & Wellness",
    "General"
  ];

  useEffect(() => {
    fetchEvents();
  }, [city, limit, showRecent, showModeToggle, currentMode]);

  useEffect(() => {
    if (selectedCategory === "all") {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(events.filter(event => event.category === selectedCategory));
    }
  }, [events, selectedCategory]);

  async function fetchEvents() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      
      // Determine the mode to use
      const useRecentMode = showModeToggle ? currentMode === 'recent' : showRecent;
      
      if (city && !useRecentMode) params.append("city", city);
      if (useRecentMode) params.append("recent", "true");
      params.append("limit", limit.toString());
      
      const response = await fetch(`/api/events?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {showModeToggle ? 
                (currentMode === 'recent' ? "Recent Events" : "Nearby Events") : 
                "Upcoming Events"
              }
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {showModeToggle && (
                <div className="flex items-center gap-1 mr-4">
                  <Button
                    variant={currentMode === 'recent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentMode('recent')}
                  >
                    Recent
                  </Button>
                  <Button
                    variant={currentMode === 'nearby' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentMode('nearby')}
                  >
                    Nearby
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading events...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {showModeToggle ? 
                (currentMode === 'recent' ? "Recent Events" : "Nearby Events") : 
                "Upcoming Events"
              }
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {showModeToggle && (
                <div className="flex items-center gap-1 mr-4">
                  <Button
                    variant={currentMode === 'recent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentMode('recent')}
                  >
                    Recent
                  </Button>
                  <Button
                    variant={currentMode === 'nearby' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentMode('nearby')}
                  >
                    Nearby
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchEvents} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {showModeToggle ? 
                (currentMode === 'recent' ? "Recent Events" : "Nearby Events") : 
                "Upcoming Events"
              }
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {showModeToggle && (
                <div className="flex items-center gap-1 mr-4">
                  <Button
                    variant={currentMode === 'recent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentMode('recent')}
                  >
                    Recent
                  </Button>
                  <Button
                    variant={currentMode === 'nearby' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentMode('nearby')}
                  >
                    Nearby
                  </Button>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {city ? `No upcoming events in ${city}` : "No upcoming events available"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {showModeToggle ? 
              (currentMode === 'recent' ? "Recent Events" : "Nearby Events") : 
              (showRecent ? "Recent Events" : "Upcoming Events")
            }
            <Badge variant="secondary">{filteredEvents.length}</Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {showModeToggle && (
              <div className="flex items-center gap-1 mr-4">
                <Button
                  variant={currentMode === 'recent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentMode('recent')}
                >
                  Recent
                </Button>
                <Button
                  variant={currentMode === 'nearby' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentMode('nearby')}
                >
                  Nearby
                </Button>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {showModeToggle ? (
          currentMode === 'nearby' && city ? (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Showing events in {city}
            </p>
          ) : currentMode === 'recent' ? (
            <p className="text-sm text-muted-foreground">
              Showing recently added events
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Showing upcoming events
            </p>
          )
        ) : (
          <>
            {city && !showRecent && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                Showing events in {city}
              </p>
            )}
            {showRecent && (
              <p className="text-sm text-muted-foreground">
                Showing recently added events
              </p>
            )}
          </>
        )}
      </CardHeader>
      
      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              No events found in the selected category
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
        
        {events.length >= limit && (
          <div className="text-center mt-6">
            <Button variant="outline" asChild>
              <a href="/events">View All Events</a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
