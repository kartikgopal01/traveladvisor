"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, Users, IndianRupee, ExternalLink } from "lucide-react";

interface EventCardProps {
  event: {
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
  };
}

export function EventCard({ event }: EventCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const isUpcoming = new Date(event.eventDate) > new Date();
  const capacityFull = event.maxCapacity && event.currentCapacity && event.currentCapacity >= event.maxCapacity;

  return (
    <Card className="h-full overflow-hidden hover:shadow-lg transition-shadow duration-200 card-hover-enhanced">
      {event.imageUrl && (
        <div className="h-32 relative overflow-hidden">
          <img 
            src={event.imageUrl} 
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2">
            {event.category && (
              <Badge variant="secondary" className="bg-white/90 text-black">
                {event.category}
              </Badge>
            )}
          </div>
          {!isUpcoming && (
            <div className="absolute top-2 right-2">
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Past Event</Badge>
            </div>
          )}
          {capacityFull && (
            <div className="absolute bottom-2 right-2">
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                Sold Out
              </Badge>
            </div>
          )}
        </div>
      )}
      
      <CardHeader className="pb-2">
        <CardTitle className="text-base leading-tight line-clamp-2">{event.title}</CardTitle>
        {!event.imageUrl && (
          <div className="flex items-center gap-2">
            {event.category && (
              <Badge variant="secondary">{event.category}</Badge>
            )}
            {!isUpcoming && (
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Past Event</Badge>
            )}
            {capacityFull && (
              <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                Sold Out
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>

        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <span>{formatDate(event.eventDate)}</span>
          </div>

          {event.startTime && (
            <div className="flex items-center gap-1 text-xs">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span>
                {formatTime(event.startTime)}
                {event.endTime && ` - ${formatTime(event.endTime)}`}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs">
            <MapPin className="w-3 h-3 text-muted-foreground" />
            <span className="truncate">
              {event.location}
              {event.city && `, ${event.city}`}
              {event.state && `, ${event.state}`}
            </span>
          </div>

          {event.organizer && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">By:</span> {event.organizer}
            </div>
          )}

          {event.price !== undefined && (
            <div className="flex items-center gap-1 text-xs font-medium">
              <IndianRupee className="w-3 h-3" />
              <span className={event.price === 0 ? "text-green-600" : ""}>
                {event.price === 0 ? "Free" : `₹${event.price}`}
              </span>
            </div>
          )}

          {event.maxCapacity && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>
                {event.currentCapacity || 0} / {event.maxCapacity}
              </span>
            </div>
          )}
        </div>

        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {event.tags.slice(0, 2).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs px-1 py-0">
                {tag}
              </Badge>
            ))}
            {event.tags.length > 2 && (
              <Badge variant="outline" className="text-xs px-1 py-0">
                +{event.tags.length - 2}
              </Badge>
            )}
          </div>
        )}

        <div className="flex gap-1 pt-1">
          {event.mapsUrl && (
            <Button variant="outline" size="sm" asChild className="flex-1 text-xs">
              <a href={event.mapsUrl} target="_blank" rel="noopener noreferrer">
                <MapPin className="w-3 h-3 mr-1" />
                Map
              </a>
            </Button>
          )}
          {event.website && (
            <Button variant="outline" size="sm" asChild className="flex-1 text-xs">
              <a href={event.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 mr-1" />
                Site
              </a>
            </Button>
          )}
        </div>

        {(event.contactEmail || event.contactPhone) && (
          <div className="text-xs text-muted-foreground pt-1 border-t">
            <div className="font-medium">Contact:</div>
            {event.contactEmail && <div className="truncate">{event.contactEmail}</div>}
            {event.contactPhone && <div>{event.contactPhone}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
