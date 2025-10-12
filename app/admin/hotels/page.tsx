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
import { Trash2, Edit, Star } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Function to render star rating
function renderStarRating(rating: number) {
  if (!rating) return null;
  
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  
  for (let i = 0; i < fullStars; i++) {
    stars.push(<Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />);
  }
  
  if (hasHalfStar) {
    stars.push(<Star key="half" className="w-3 h-3 fill-yellow-400/50 text-yellow-400" />);
  }
  
  const emptyStars = 5 - Math.ceil(rating);
  for (let i = 0; i < emptyStars; i++) {
    stars.push(<Star key={`empty-${i}`} className="w-3 h-3 text-gray-300" />);
  }
  
  return (
    <div className="flex items-center gap-1">
      <div className="flex">{stars}</div>
      <span className="text-xs text-muted-foreground ml-1">{rating}/5</span>
    </div>
  );
}

export default function AdminHotelsPage() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [adminInfo, setAdminInfo] = useState<{userEmail?: string, userId?: string, accessType?: string} | null>(null);
  const [deletingHotelId, setDeletingHotelId] = useState<string | null>(null);
  const [editingHotel, setEditingHotel] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    city: "",
    state: "",
    address: "",
    pricePerNightINR: "",
    rating: "0",
    amenities: "",
    mapsUrl: "",
    website: "",
    contact: "",
  });

  // Check admin status
  useEffect(() => {
    async function checkAdminStatus() {
      if (!isLoaded) return;
      
      if (!userId) {
        router.push("/");
        return;
      }
      
      try {
        const response = await fetch("/api/admin/hotels");
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(true);
          setAdminInfo(data.adminInfo || null);
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

  const { data, isLoading } = useSWR(isAdmin ? "/api/admin/hotels" : null, fetcher);
  const hotels = data?.hotels || [];

  // Show loading while checking admin status
  if (isChecking || !isLoaded) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
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

  async function addHotel() {
    if (!form.name.trim()) { alert("Name is required"); return; }
    if (!form.city.trim()) { alert("City is required"); return; }
    const payload = {
      ...form,
      pricePerNightINR: form.pricePerNightINR ? Number(form.pricePerNightINR) : undefined,
      rating: form.rating && form.rating !== "0" ? Number(form.rating) : undefined,
      amenities: form.amenities ? form.amenities.split(",").map((s) => s.trim()).filter(Boolean) : [],
    };
    const res = await fetch("/api/admin/hotels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await mutate("/api/admin/hotels");
      resetForm();
    } else {
      const msg = await res.text();
      alert("Failed: " + msg);
    }
  }

  async function deleteHotel(hotelId: string) {
    if (!confirm("Are you sure you want to delete this hotel?")) return;

    setDeletingHotelId(hotelId);
    
    try {
      const res = await fetch(`/api/admin/hotels/${hotelId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Optimistically update the UI by removing the hotel from the cache
        mutate("/api/admin/hotels", (data: any) => {
          if (!data) return data;
          return {
            ...data,
            hotels: data.hotels.filter((hotel: any) => hotel.id !== hotelId)
          };
        }, false); // false = don't revalidate immediately, we already have the updated data
        
        // Then revalidate to ensure consistency
        await mutate("/api/admin/hotels");
        
        // Show success message
        alert("Hotel deleted successfully!");
      } else {
        const msg = await res.text();
        alert("Delete failed: " + msg);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Delete failed: " + (error as Error).message);
    } finally {
      setDeletingHotelId(null);
    }
  }

  function startEdit(hotel: any) {
    setEditingHotel(hotel);
    setForm({
      name: hotel.name || "",
      city: hotel.city || "",
      state: hotel.state || "",
      address: hotel.address || "",
      pricePerNightINR: hotel.pricePerNightINR?.toString() || "",
      rating: hotel.rating?.toString() || "0",
      amenities: hotel.amenities?.join(", ") || "",
      mapsUrl: hotel.mapsUrl || "",
      website: hotel.website || "",
      contact: hotel.contact || "",
    });
  }

  function cancelEdit() {
    setEditingHotel(null);
    resetForm();
  }

  function resetForm() {
    setForm({
      name: "",
      city: "",
      state: "",
      address: "",
      pricePerNightINR: "",
      rating: "0",
      amenities: "",
      mapsUrl: "",
      website: "",
      contact: "",
    });
  }

  async function updateHotel() {
    if (!editingHotel) return;

    if (!form.name.trim()) { alert("Name is required"); return; }
    if (!form.city.trim()) { alert("City is required"); return; }

    const payload = {
      ...form,
      pricePerNightINR: form.pricePerNightINR ? Number(form.pricePerNightINR) : undefined,
      rating: form.rating && form.rating !== "0" ? Number(form.rating) : undefined,
      amenities: form.amenities ? form.amenities.split(",").map((s) => s.trim()).filter(Boolean) : [],
    };

    try {
      const res = await fetch(`/api/admin/hotels/${editingHotel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await mutate("/api/admin/hotels");
        setEditingHotel(null);
        resetForm();
        alert("Hotel updated successfully!");
      } else {
        const msg = await res.text();
        alert("Update failed: " + msg);
      }
    } catch (error) {
      console.error("Update hotel error:", error);
      alert("Update failed: " + (error as Error).message);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-red-600 mb-2">🔒 Admin Panel</h1>
        <p className="text-lg text-muted-foreground">Manage Hotels - Admin Only</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>{editingHotel ? "Edit Hotel" : "Add Partner Hotel"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Price / Night (₹)</Label>
              <Input value={form.pricePerNightINR} onChange={(e) => setForm({ ...form, pricePerNightINR: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rating</Label>
              <Select value={form.rating} onValueChange={(value) => setForm({ ...form, rating: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No Rating</SelectItem>
                  <SelectItem value="1">⭐ 1 Star</SelectItem>
                  <SelectItem value="2">⭐⭐ 2 Stars</SelectItem>
                  <SelectItem value="3">⭐⭐⭐ 3 Stars</SelectItem>
                  <SelectItem value="4">⭐⭐⭐⭐ 4 Stars</SelectItem>
                  <SelectItem value="5">⭐⭐⭐⭐⭐ 5 Stars</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Amenities (comma separated)</Label>
              <Input value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Google Maps URL</Label>
              <Input value={form.mapsUrl} onChange={(e) => setForm({ ...form, mapsUrl: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Contact</Label>
              <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={editingHotel ? updateHotel : addHotel} className="flex-1 btn-hover-enhanced">
              {editingHotel ? "Update Hotel" : "Add Hotel"}
            </Button>
            {editingHotel && (
              <Button variant="outline" onClick={cancelEdit} className="btn-hover-enhanced">
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partner Hotels</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && hotels.length === 0 && (
            <div className="text-sm text-muted-foreground">No hotels added yet.</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {hotels.map((h: any) => (
              <div key={h.id} className="border rounded p-3 text-sm space-y-2">
                <div className="font-medium">{h.name}</div>
                <div className="flex items-center gap-2">
                  <Input
                    value={h._editCity ?? h.city ?? ""}
                    onChange={(e) => {
                      const next = (data?.hotels || []).map((x: any) => x.id === h.id ? { ...x, _editCity: e.target.value } : x);
                      // Optimistic local mutate
                      mutate("/api/admin/hotels", { hotels: next }, { revalidate: false });
                    }}
                  />
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const newCity = (h._editCity ?? h.city ?? "").trim();
                      if (!newCity) { alert("City is required"); return; }
                      const res = await fetch(`/api/admin/hotels/${h.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ city: newCity }),
                      });
                      if (res.ok) {
                        await mutate("/api/admin/hotels");
                      } else {
                        const msg = await res.text();
                        alert("Update failed: " + msg);
                      }
                    }}
                  >Save City</Button>
                </div>
                <div className="text-xs text-muted-foreground">{h.state ? h.state : null}</div>
                {h.rating && (
                  <div className="mt-1">
                    {renderStarRating(h.rating)}
                  </div>
                )}
                {h.pricePerNightINR && <div className="mt-1">₹{h.pricePerNightINR.toLocaleString?.()}</div>}
                {h.mapsUrl && (
                  <div className="mt-2">
                    <a className="text-blue-600 underline" href={h.mapsUrl} target="_blank" rel="noreferrer">Maps</a>
                  </div>
                )}
                <div className="mt-2 flex justify-end gap-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => startEdit(h)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => deleteHotel(h.id)}
                    disabled={deletingHotelId === h.id}
                    className="text-red-600 hover:text-red-700"
                  >
                    {deletingHotelId === h.id ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


