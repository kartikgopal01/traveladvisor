"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, Users, IndianRupee, Edit, Trash2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminEventsPage() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    city: "",
    state: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    category: "",
    price: "",
    maxCapacity: "",
    imageUrl: "",
    organizer: "",
    contactEmail: "",
    contactPhone: "",
    mapsUrl: "",
    website: "",
    tags: "",
    isActive: "true",
  });

  const [editingEvent, setEditingEvent] = useState<any>(null);

  // Check admin status
  useEffect(() => {
    async function checkAdminStatus() {
      if (!isLoaded) return;
      
      if (!userId) {
        router.push("/");
        return;
      }
      
      try {
        const response = await fetch("/api/admin/events");
        if (response.ok) {
          setIsAdmin(true);
        } else {
          router.push("/");
        }
      } catch {
        router.push("/");
      } finally {
        setIsChecking(false);
      }
    }
    
    checkAdminStatus();
  }, [userId, isLoaded, router]);

  const { data, isLoading } = useSWR(isAdmin ? "/api/admin/events" : null, fetcher);
  const events = data?.events || [];

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

  // Show loading while checking admin status
  if (isChecking || !isLoaded) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // If not admin, don't render anything (redirect will happen)
  if (!isAdmin) {
    return null;
  }

  async function addEvent() {
    if (!form.title.trim()) { alert("Title is required"); return; }
    if (!form.description.trim()) { alert("Description is required"); return; }
    if (!form.location.trim()) { alert("Location is required"); return; }
    if (!form.eventDate) { alert("Event date is required"); return; }

    const payload = {
      ...form,
      price: form.price ? Number(form.price) : null,
      maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : null,
      tags: form.tags ? form.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      isActive: form.isActive === "true",
    };

    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await mutate("/api/admin/events");
      resetForm();
    } else {
      const msg = await res.text();
      alert("Failed: " + msg);
    }
  }

  async function updateEvent() {
    if (!editingEvent) return;

    const payload = {
      ...form,
      price: form.price ? Number(form.price) : null,
      maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : null,
      tags: form.tags ? form.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
      isActive: form.isActive === "true",
    };

    const res = await fetch(`/api/admin/events/${editingEvent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await mutate("/api/admin/events");
      setEditingEvent(null);
      resetForm();
    } else {
      const msg = await res.text();
      alert("Update failed: " + msg);
    }
  }

  async function deleteEvent(eventId: string) {
    if (!confirm("Are you sure you want to delete this event?")) return;

    const res = await fetch(`/api/admin/events/${eventId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      await mutate("/api/admin/events");
    } else {
      const msg = await res.text();
      alert("Delete failed: " + msg);
    }
  }

  function resetForm() {
    setForm({
      title: "",
      description: "",
      location: "",
      city: "",
      state: "",
      eventDate: "",
      startTime: "",
      endTime: "",
      category: "",
      price: "",
      maxCapacity: "",
      imageUrl: "",
      organizer: "",
      contactEmail: "",
      contactPhone: "",
      mapsUrl: "",
      website: "",
      tags: "",
      isActive: "true",
    });
  }

  function startEdit(event: any) {
    setEditingEvent(event);
    setForm({
      title: event.title || "",
      description: event.description || "",
      location: event.location || "",
      city: event.city || "",
      state: event.state || "",
      eventDate: event.eventDate ? new Date(event.eventDate).toISOString().split('T')[0] : "",
      startTime: event.startTime || "",
      endTime: event.endTime || "",
      category: event.category || "",
      price: event.price ? String(event.price) : "",
      maxCapacity: event.maxCapacity ? String(event.maxCapacity) : "",
      imageUrl: event.imageUrl || "",
      organizer: event.organizer || "",
      contactEmail: event.contactEmail || "",
      contactPhone: event.contactPhone || "",
      mapsUrl: event.mapsUrl || "",
      website: event.website || "",
      tags: event.tags ? event.tags.join(", ") : "",
      isActive: event.isActive ? "true" : "false",
    });
  }

  function cancelEdit() {
    setEditingEvent(null);
    resetForm();
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-red-600 mb-2">🔒 Admin Panel</h1>
        <p className="text-lg text-muted-foreground">Manage Events - Admin Only</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {editingEvent ? "Edit Event" : "Add New Event"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Event Title *</Label>
              <Input 
                value={form.title} 
                onChange={(e) => setForm({ ...form, title: e.target.value })} 
                placeholder="Enter event title"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description *</Label>
              <Textarea 
                value={form.description} 
                onChange={(e) => setForm({ ...form, description: e.target.value })} 
                placeholder="Enter event description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Location *</Label>
              <Input 
                value={form.location} 
                onChange={(e) => setForm({ ...form, location: e.target.value })} 
                placeholder="Event venue/address"
              />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input 
                value={form.city} 
                onChange={(e) => setForm({ ...form, city: e.target.value })} 
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input 
                value={form.state} 
                onChange={(e) => setForm({ ...form, state: e.target.value })} 
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label>Event Date *</Label>
              <Input 
                type="date"
                value={form.eventDate} 
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input 
                type="time"
                value={form.startTime} 
                onChange={(e) => setForm({ ...form, startTime: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input 
                type="time"
                value={form.endTime} 
                onChange={(e) => setForm({ ...form, endTime: e.target.value })} 
              />
            </div>
            <div className="space-y-2">
              <Label>Price (₹)</Label>
              <Input 
                type="number"
                value={form.price} 
                onChange={(e) => setForm({ ...form, price: e.target.value })} 
                placeholder="0 for free events"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Capacity</Label>
              <Input 
                type="number"
                value={form.maxCapacity} 
                onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })} 
                placeholder="Maximum attendees"
              />
            </div>
            <div className="space-y-2">
              <Label>Organizer</Label>
              <Input 
                value={form.organizer} 
                onChange={(e) => setForm({ ...form, organizer: e.target.value })} 
                placeholder="Event organizer name"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input 
                type="email"
                value={form.contactEmail} 
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} 
                placeholder="contact@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input 
                value={form.contactPhone} 
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} 
                placeholder="+91 1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input 
                value={form.imageUrl} 
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} 
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="space-y-2">
              <Label>Google Maps URL</Label>
              <Input 
                value={form.mapsUrl} 
                onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })} 
                placeholder="https://maps.google.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input 
                value={form.website} 
                onChange={(e) => setForm({ ...form, website: e.target.value })} 
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input 
                value={form.tags} 
                onChange={(e) => setForm({ ...form, tags: e.target.value })} 
                placeholder="music, outdoor, family-friendly"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.isActive} onValueChange={(value) => setForm({ ...form, isActive: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={editingEvent ? updateEvent : addEvent} className="flex-1">
              {editingEvent ? "Update Event" : "Add Event"}
            </Button>
            {editingEvent && (
              <Button variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Events ({events.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && events.length === 0 && (
            <div className="text-sm text-muted-foreground">No events added yet.</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((event: any) => (
              <Card key={event.id} className="overflow-hidden">
                {event.imageUrl && (
                  <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${event.imageUrl})` }} />
                )}
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-lg leading-tight">{event.title}</h3>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => startEdit(event)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteEvent(event.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(event.eventDate).toLocaleDateString()}</span>
                    </div>
                    
                    {event.startTime && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{event.location}</span>
                    </div>
                    
                    {event.price !== null && (
                      <div className="flex items-center gap-2 text-sm">
                        <IndianRupee className="w-4 h-4" />
                        <span>{event.price === 0 ? "Free" : `₹${event.price}`}</span>
                      </div>
                    )}
                    
                    {event.maxCapacity && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>Max: {event.maxCapacity}</span>
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-1">
                      {event.category && (
                        <Badge variant="secondary">{event.category}</Badge>
                      )}
                      <Badge variant={event.isActive ? "default" : "outline"}>
                        {event.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    
                    {event.tags && event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {event.tags.slice(0, 3).map((tag: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
