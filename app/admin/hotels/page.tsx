"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminHotelsPage() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [form, setForm] = useState({
    name: "",
    city: "",
    state: "",
    address: "",
    latitude: "",
    longitude: "",
    pricePerNightINR: "",
    rating: "",
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
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      pricePerNightINR: form.pricePerNightINR ? Number(form.pricePerNightINR) : undefined,
      rating: form.rating ? Number(form.rating) : undefined,
      amenities: form.amenities ? form.amenities.split(",").map((s) => s.trim()).filter(Boolean) : [],
    };
    const res = await fetch("/api/admin/hotels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await mutate("/api/admin/hotels");
      setForm({
        name: "",
        city: "",
        state: "",
        address: "",
        latitude: "",
        longitude: "",
        pricePerNightINR: "",
        rating: "",
        amenities: "",
        mapsUrl: "",
        website: "",
        contact: "",
      });
    } else {
      const msg = await res.text();
      alert("Failed: " + msg);
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
          <CardTitle>Add Partner Hotel</CardTitle>
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
              <Label>Latitude</Label>
              <Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Longitude</Label>
              <Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Price / Night (₹)</Label>
              <Input value={form.pricePerNightINR} onChange={(e) => setForm({ ...form, pricePerNightINR: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rating</Label>
              <Input value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} />
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
          <Button onClick={addHotel} className="w-full btn-hover-enhanced">Add Hotel</Button>
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
                {h.pricePerNightINR && <div className="mt-1">₹{h.pricePerNightINR.toLocaleString?.()}</div>}
                {h.mapsUrl && (
                  <div className="mt-2">
                    <a className="text-blue-600 underline" href={h.mapsUrl} target="_blank" rel="noreferrer">Maps</a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


