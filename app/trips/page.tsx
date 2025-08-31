"use client";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapButton } from "@/components/maps/map-button";
import { QuickMap } from "@/components/maps/trip-map";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TripsPage() {
  const { data, isLoading } = useSWR("/api/trips", fetcher);
  const trips = data?.trips || [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-semibold">Your Trips</h1>
      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && trips.length === 0 && (
        <Card className="mt-6">
          <CardContent className="pt-6 text-sm text-muted-foreground">No trips yet.</CardContent>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4">
        {trips.map((t: any) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{t.type === "plan" ? (t.result?.destinations?.join(", ") || "Trip Plan") : "Destination Suggestions"}</span>
                <span className="text-sm font-normal text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</span>
              </CardTitle>
              <CardDescription>
                {t.type === "plan" ? "AI-generated Indian trip plan" : "AI-generated suggestions within your budget"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {t.type === "plan" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Total Budget</div>
                    <div className="text-xl font-semibold">₹{t.result?.totalBudget?.toLocaleString?.() || "-"}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Days</div>
                    <div className="text-xl font-semibold">{t.result?.days}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">Destinations</div>
                    <div className="text-sm">{t.result?.destinations?.join(", ")}</div>
                  </div>
                </div>
              )}

              {t.type === "plan" && t.result?.attractions?.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Top Attractions</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {t.result.attractions.slice(0, 6).map((p: any, i: number) => (
                      <div key={i} className="border rounded p-3 text-sm flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.location}</div>
                        </div>
                        {p.mapsUrl && (
                          <MapButton url={p.mapsUrl} title={p.name} size="sm" variant="outline" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {t.type === "suggest" && (
                <div className="grid md:grid-cols-3 gap-3">
                  {t.result?.suggestions?.map((s: any, i: number) => (
                    <Card key={i}>
                      <CardContent className="pt-6 space-y-1">
                        <div className="font-medium">{s.destination}</div>
                        <div className="text-xs text-muted-foreground">{s.state} • {s.region}</div>
                        <div className="text-sm">Est. ₹{s.estimatedCost?.toLocaleString?.()}</div>
                        {s.samplePlan?.accommodations?.[0]?.mapsUrl && (
                          <div className="pt-2">
                            <MapButton
                              url={s.samplePlan.accommodations[0].mapsUrl}
                              title={`${s.destination} Map`}
                              size="sm"
                              variant="outline"
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}



