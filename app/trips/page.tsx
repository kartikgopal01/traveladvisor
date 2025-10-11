"use client";
import useSWR from "swr";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapButton } from "@/components/maps/map-button";
import { QuickMap } from "@/components/maps/trip-map";
import { ArrowUpDown, Calendar, QrCode, Share2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TripsPage() {
  const { data, isLoading } = useSWR("/api/trips", fetcher);
  const trips = data?.trips || [];
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'plans'>('suggestions');
  const [popupWidth, setPopupWidth] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  
  // Get popup width and height classes
  const getPopupClasses = () => {
    switch (popupWidth) {
      case 'sm': return {
        width: 'w-1/3 min-w-80',
        height: 'max-h-[80vh]'
      };
      case 'md': return {
        width: 'w-1/2 min-w-96',
        height: 'max-h-[70vh]'
      };
      case 'lg': return {
        width: 'w-2/3 min-w-[32rem]',
        height: 'max-h-[60vh]'
      };
      case 'xl': return {
        width: 'w-3/4 min-w-[40rem]',
        height: 'max-h-[50vh]'
      };
      default: return {
        width: 'w-1/2 min-w-96',
        height: 'max-h-[70vh]'
      };
    }
  };
  
  // Filter trips based on active tab
  const filteredTrips = trips.filter((trip: any) => {
    if (activeTab === 'suggestions') {
      return trip.type === 'suggest';
    } else {
      return trip.type === 'plan';
    }
  });

  // Sort trips by creation date
  const sortedTrips = filteredTrips.sort((a: any, b: any) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });
  
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
  };

  const handleCardClick = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const handleClickOutside = (e: React.MouseEvent) => {
    if (expandedCard && !(e.target as HTMLElement).closest('.card-container')) {
      setExpandedCard(null);
    }
  };

  const generateQRCode = (url: string) => {
    // Generate QR code using a simple QR code API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    return qrUrl;
  };

  const shareTrip = async (tripData: any, type: 'plan' | 'suggest') => {
    let shareUrl = '';
    let shareText = '';
    
    if (type === 'plan' && tripData.result?.destinations?.length > 0) {
      // For trip plans, create a multi-stop Google Maps route
      const destinations = tripData.result.destinations;
      if (destinations.length === 1) {
        shareUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinations[0])}, India`;
        shareText = `Check out this trip destination: ${destinations[0]}`;
      } else if (destinations.length > 1) {
        const encodedDestinations = destinations.map((dest: string) => encodeURIComponent(dest));
        const origin = encodedDestinations[0];
        const destination = encodedDestinations[encodedDestinations.length - 1];
        const waypoints = encodedDestinations.slice(1, -1);
        
        if (waypoints.length > 0) {
          const waypointsParam = waypoints.join('|');
          shareUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}`;
        } else {
          shareUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
        }
        shareText = `Check out this trip route: ${destinations.join(' → ')}`;
      }
    } else if (type === 'suggest' && tripData.result?.suggestions?.length > 0) {
      // For destination suggestions, create a route with all suggested destinations
      const suggestions = tripData.result.suggestions;
      const allDestinations = suggestions.map((s: any) => `${s.destination}, ${s.state}, India`);
      
      if (allDestinations.length === 1) {
        shareUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(allDestinations[0])}`;
        shareText = `Check out this destination suggestion: ${suggestions[0].destination}`;
      } else if (allDestinations.length > 1) {
        const encodedDestinations = allDestinations.map((dest: string) => encodeURIComponent(dest));
        const origin = encodedDestinations[0];
        const destination = encodedDestinations[encodedDestinations.length - 1];
        const waypoints = encodedDestinations.slice(1, -1);
        
        if (waypoints.length > 0) {
          const waypointsParam = waypoints.join('|');
          shareUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}`;
        } else {
          shareUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
        }
        shareText = `Check out these destination suggestions: ${suggestions.map((s: any) => s.destination).join(', ')}`;
      }
    }
    
    // Fallback to trip page if no Google Maps URL could be generated
    if (!shareUrl) {
      shareUrl = window.location.href;
      shareText = `${type === 'plan' ? 'Trip Plan' : 'Destination Suggestions'} - Happy Journey`;
    }

    const shareData = {
      title: `${type === 'plan' ? 'Trip Plan' : 'Destination Suggestions'}`,
      text: shareText,
      url: shareUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error sharing:', err);
        // Fallback to clipboard
        navigator.clipboard.writeText(shareUrl);
        alert('Google Maps link copied to clipboard!');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
      alert('Google Maps link copied to clipboard!');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10" onClick={handleClickOutside}>
      <div className="flex items-center justify-between mb-6">
      <h1 className="text-3xl font-semibold">Your Trips</h1>
        <div className="flex items-center gap-4">
          {/* Tab Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === 'suggestions'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              Destination Suggestions
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === 'plans'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              Trip Plans
            </button>
          </div>
          
          {/* Sort Button */}
          {sortedTrips.length > 0 && (
            <Button
              onClick={toggleSortOrder}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
              <ArrowUpDown className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && sortedTrips.length === 0 && (
        <Card className="mt-6">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {activeTab === 'suggestions' 
              ? 'No destination suggestions yet.' 
              : 'No trip plans yet.'
            }
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4">
        {sortedTrips.map((t: any) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {activeTab === 'plans' 
                    ? (t.result?.destinations?.join(", ") || "Trip Plan")
                    : "Destination Suggestions"
                  }
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </CardTitle>
              <CardDescription>
                {activeTab === 'plans' 
                  ? "AI-generated Indian trip plan" 
                  : `AI-generated suggestions within your budget • ${t.input?.budgetAnalysis?.accommodationLevel || 'balanced'} level${t.input?.preferredLocation ? ` • Limited to ${t.input.preferredLocation}` : ''}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeTab === 'plans' && (
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

              {activeTab === 'plans' && t.result?.attractions?.length > 0 && (
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

              {/* View All Routes Button for Trip Plans */}
              {activeTab === 'plans' && t.result?.destinations?.length > 0 && (
                <div className="pt-4 border-t space-y-3">
                  <Button
                    onClick={() => {
                      // Create a multi-stop route URL
                      const destinations = t.result.destinations;
                      if (destinations.length === 1) {
                        // Single destination - open directly
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinations[0])}, India`, '_blank');
                      } else if (destinations.length > 1) {
                        // Multiple destinations - create route
                        const encodedDestinations = destinations.map((dest: string) => encodeURIComponent(dest));
                        const origin = encodedDestinations[0];
                        const destination = encodedDestinations[encodedDestinations.length - 1];
                        const waypoints = encodedDestinations.slice(1, -1);
                        
                        let routeUrl;
                        if (waypoints.length > 0) {
                          const waypointsParam = waypoints.join('|');
                          routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}`;
                        } else {
                          routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
                        }
                        
                        window.open(routeUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    variant="default"
                    size="sm"
                    className="w-full flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    View All Routes ({t.result.destinations.length} destinations)
                  </Button>
                  
                  {/* QR Code and Share Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const destinations = t.result.destinations;
                        let routeUrl;
                        if (destinations.length === 1) {
                          routeUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinations[0])}, India`;
                        } else if (destinations.length > 1) {
                          const encodedDestinations = destinations.map((dest: string) => encodeURIComponent(dest));
                          const origin = encodedDestinations[0];
                          const destination = encodedDestinations[encodedDestinations.length - 1];
                          const waypoints = encodedDestinations.slice(1, -1);
                          
                          if (waypoints.length > 0) {
                            const waypointsParam = waypoints.join('|');
                            routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypointsParam}`;
                          } else {
                            routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
                          }
                        }
                        
                        if (routeUrl) {
                          const qrUrl = generateQRCode(routeUrl);
                          window.open(qrUrl, '_blank');
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 flex items-center gap-2"
                    >
                      <QrCode className="w-4 h-4" />
                      QR Code
                    </Button>
                    <Button
                      onClick={() => shareTrip(t, 'plan')}
                      variant="outline"
                      size="sm"
                      className="flex-1 flex items-center gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </Button>
                  </div>
                </div>
              )}

              {/* Total Budget for Suggestions */}
              {activeTab === 'suggestions' && t.input?.budgetINR && (
                <div className="space-y-3">
                  {/* Main Budget Display */}
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Total Budget</div>
                      <div className="text-lg font-semibold text-foreground">₹{t.input.budgetINR?.toLocaleString()}</div>
                    </div>
                  </div>
                  
                  {/* Budget Breakdown if accommodation is included */}
                  {t.input?.includeAccommodation && t.input?.budgetAnalysis && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-muted rounded-lg">
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Accommodation Budget</div>
                        <div className="text-lg font-semibold text-foreground">₹{t.input.budgetAnalysis.accommodationBudget?.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">40% of total</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Activity Budget</div>
                        <div className="text-lg font-semibold text-foreground">₹{t.input.budgetAnalysis.activityBudget?.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">60% of total</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'suggestions' && (
                <div className="grid md:grid-cols-3 gap-3 relative">
                  {t.result?.suggestions?.map((s: any, i: number) => {
                    const cardId = `${t.id}-suggestion-${i}`;
                    const isExpanded = expandedCard === cardId;
                    
                     return (
                       <div key={i} className="relative card-container">
                         <Card 
                           className={`cursor-pointer transition-all duration-300 hover:shadow-md ${
                             isExpanded ? 'ring-2 ring-blue-500 shadow-xl z-10' : ''
                           }`}
                           onClick={() => handleCardClick(cardId)}
                         >
                        <CardContent className="pt-6 space-y-3">
                          <div className="space-y-1">
                            <div className="font-medium text-lg">{s.destination}</div>
                            <div className="text-sm text-muted-foreground">{s.state} • {s.region}</div>
                            <div className="flex items-center justify-between">
                              <div className="text-lg font-semibold text-foreground">
                                Est. ₹{s.estimatedCost?.toLocaleString?.()}
                              </div>
                              <div className="text-sm font-medium text-foreground bg-muted px-2 py-1 rounded-full">
                                {t.input?.days || s.days || s.samplePlan?.days || 'N/A'} days
                              </div>
                            </div>
                          </div>

                          {/* Click hint */}
                          {!isExpanded && (
                            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                              Click to see places to visit
                            </div>
                          )}
                        </CardContent>
                      </Card>

                       {/* Pop-up Overlay */}
                       {isExpanded && (
                         <div className={`absolute top-0 left-0 z-20 bg-background/95 backdrop-blur-lg border border-border/50 rounded-lg shadow-2xl p-4 ${getPopupClasses().width} ${getPopupClasses().height} overflow-y-auto`}>
                           <div className="space-y-3">
                            <div className="flex items-center justify-between border-b pb-2">
                              <h3 className="font-semibold text-lg text-foreground">{s.destination}</h3>
                              <div className="flex items-center gap-2">
                                {/* Width Adjustment Controls */}
                                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPopupWidth('sm');
                                    }}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                      popupWidth === 'sm'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title="Small (1/3 width, 80% height)"
                                  >
                                    S
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPopupWidth('md');
                                    }}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                      popupWidth === 'md'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title="Medium (1/2 width, 70% height)"
                                  >
                                    M
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPopupWidth('lg');
                                    }}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                      popupWidth === 'lg'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title="Large (2/3 width, 60% height)"
                                  >
                                    L
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPopupWidth('xl');
                                    }}
                                    className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                      popupWidth === 'xl'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    title="Extra Large (3/4 width, 50% height)"
                                  >
                                    XL
                                  </button>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedCard(null);
                                  }}
                                  className="text-muted-foreground hover:text-foreground text-xl"
                                >
                                  ×
                                </button>
                              </div>
                            </div>

                            {/* Budget Breakdown */}
                            {s.breakdown && (
                              <div>
                                <h4 className="font-medium text-sm mb-2 text-foreground">
                                  💰 Budget Breakdown
                                </h4>
                                <div className="grid grid-cols-2 gap-2">
                                  {s.breakdown.flights && (
                                    <div className="p-2 bg-blue-50 rounded text-sm">
                                      <div className="text-xs text-blue-800 mb-1">✈️ Flights</div>
                                      <div className="text-sm font-bold text-blue-900">₹{s.breakdown.flights?.toLocaleString()}</div>
                                    </div>
                                  )}
                                  {s.breakdown.accommodation && (
                                    <div className="p-2 bg-green-50 rounded text-sm">
                                      <div className="text-xs text-green-800 mb-1">🏨 Stay</div>
                                      <div className="text-sm font-bold text-green-900">₹{s.breakdown.accommodation?.toLocaleString()}</div>
                                    </div>
                                  )}
                                  {s.breakdown.food && (
                                    <div className="p-2 bg-orange-50 rounded text-sm">
                                      <div className="text-xs text-orange-800 mb-1">🍽️ Food</div>
                                      <div className="text-sm font-bold text-orange-900">₹{s.breakdown.food?.toLocaleString()}</div>
                                    </div>
                                  )}
                                  {s.breakdown.localTransport && (
                                    <div className="p-2 bg-purple-50 rounded text-sm">
                                      <div className="text-xs text-purple-800 mb-1">🚗 Transport</div>
                                      <div className="text-sm font-bold text-purple-900">₹{s.breakdown.localTransport?.toLocaleString()}</div>
                                    </div>
                                  )}
                                  {s.breakdown.attractions && (
                                    <div className="p-2 bg-yellow-50 rounded text-sm">
                                      <div className="text-xs text-yellow-800 mb-1">🎯 Activities</div>
                                      <div className="text-sm font-bold text-yellow-900">₹{s.breakdown.attractions?.toLocaleString()}</div>
                                    </div>
                                  )}
                                  {s.breakdown.miscellaneous && (
                                    <div className="p-2 bg-gray-50 rounded text-sm">
                                      <div className="text-xs text-gray-800 mb-1">📦 Misc</div>
                                      <div className="text-sm font-bold text-gray-900">₹{s.breakdown.miscellaneous?.toLocaleString()}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Transportation Details */}
                            {s.transportation && (
                              <div>
                                <h4 className="font-medium text-sm mb-2 text-foreground">
                                  🚗 Transportation Details
                                </h4>
                                
                                {/* Primary Transportation Option */}
                                {s.transportation.toDestination && (
                                  <div className="p-3 bg-purple-50 rounded text-sm mb-3">
                                    <div className="font-medium mb-1 text-purple-800">Primary Option: {s.transportation.toDestination.mode}</div>
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Duration: {s.transportation.toDestination.duration}
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-1">
                                      Cost: ₹{s.transportation.toDestination.cost?.toLocaleString()}
                                    </div>
                                    {s.transportation.toDestination.tips && (
                                      <div className="text-xs text-blue-600 mt-1">
                                        💡 {s.transportation.toDestination.tips}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* All Available Transportation Options */}
                                {s.transportation.availableOptions && s.transportation.availableOptions.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-xs font-medium text-muted-foreground">All Available Options:</div>
                                    {s.transportation.availableOptions.map((option: any, idx: number) => (
                                      <div key={idx} className="p-2 bg-gray-50 rounded text-sm border">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="font-medium text-sm">{option.mode}</div>
                                          <div className="text-sm font-bold text-green-600">₹{option.cost?.toLocaleString()}</div>
                                        </div>
                                        <div className="text-xs text-muted-foreground mb-1">
                                          Duration: {option.duration}
                                        </div>
                                        {option.description && (
                                          <div className="text-xs text-muted-foreground mb-1">
                                            {option.description}
                                          </div>
                                        )}
                                        {option.tips && (
                                          <div className="text-xs text-blue-600">
                                            💡 {option.tips}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Highlights */}
                            {s.highlights && s.highlights.length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm mb-2 text-foreground">
                                  ⭐ Highlights
                                </h4>
                                <div className="space-y-1">
                                  {s.highlights.map((highlight: string, idx: number) => (
                                    <div key={idx} className="text-sm text-muted-foreground">• {highlight}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Places to Visit */}
                            {s.samplePlan?.attractions?.length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm mb-2 text-foreground">
                                  🏛️ Places to Visit
                                </h4>
                                 <div className="space-y-2">
                                   {s.samplePlan.attractions.slice(0, 4).map((attraction: any, idx: number) => (
                                     <div key={idx} className="p-2 bg-muted rounded text-sm">
                                       <div className="font-medium text-sm mb-1">{attraction.name}</div>
                                       <div className="text-xs text-muted-foreground mb-2">{attraction.location}</div>
                                       {attraction.mapsUrl && (
                                         <MapButton
                                           url={attraction.mapsUrl}
                                           title={attraction.name}
                                           size="sm"
                                           variant="outline"
                                           className="w-full"
                                         />
                                       )}
                                     </div>
                                   ))}
                                  {s.samplePlan.attractions.length > 4 && (
                                    <div className="text-xs text-muted-foreground text-center py-1">
                                      +{s.samplePlan.attractions.length - 4} more places
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Accommodations */}
                            {s.samplePlan?.accommodations?.length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm mb-2 text-foreground">
                                  🏨 Accommodations
                                </h4>
                                 <div className="space-y-2">
                                   {s.samplePlan.accommodations.slice(0, 3).map((accommodation: any, idx: number) => (
                                     <div key={idx} className="p-2 bg-muted rounded text-sm">
                                       <div className="font-medium text-sm mb-1">{accommodation.name}</div>
                                       <div className="text-xs text-muted-foreground mb-2">
                                         ₹{accommodation.price?.toLocaleString?.()}/night
                                       </div>
                                       {accommodation.mapsUrl && (
                                         <MapButton
                                           url={accommodation.mapsUrl}
                                           title={accommodation.name}
                                           size="sm"
                                           variant="outline"
                                           className="w-full"
                                         />
                                       )}
                                     </div>
                                   ))}
                                </div>
                              </div>
                            )}

                            {/* Restaurants */}
                            {s.samplePlan?.restaurants?.length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm mb-2 text-foreground">
                                  🍽️ Local Cuisine
                                </h4>
                                 <div className="space-y-2">
                                   {s.samplePlan.restaurants.slice(0, 3).map((restaurant: any, idx: number) => (
                                     <div key={idx} className="p-2 bg-muted rounded text-sm">
                                       <div className="font-medium text-sm mb-1">{restaurant.name}</div>
                                       <div className="text-xs text-muted-foreground mb-2">{restaurant.cuisine}</div>
                                       {restaurant.mapsUrl && (
                                         <MapButton
                                           url={restaurant.mapsUrl}
                                           title={restaurant.name}
                                           size="sm"
                                           variant="outline"
                                           className="w-full"
                                         />
                                       )}
                                     </div>
                                   ))}
                                </div>
                              </div>
                            )}

                            {/* Accommodation Routes */}
                            {s.samplePlan?.accommodationRoutes?.length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm mb-2 text-foreground">🗺️ Accommodation Routes</h4>
                                <div className="space-y-2">
                                  {s.samplePlan.accommodationRoutes.slice(0, 3).map((route: any, idx: number) => (
                                    <div key={idx} className="p-2 bg-muted rounded text-sm">
                                      <div className="font-medium text-sm mb-1">{route.fromAccommodation} → {route.toAttraction}</div>
                                      <div className="text-xs text-muted-foreground mb-2">
                                        {route.distance} • {route.duration}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(route.routeUrl, '_blank');
                                        }}
                                      >
                                        View Route
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Local Tips */}
                            {s.localTips && s.localTips.length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm mb-2 text-foreground">
                                  💡 Travel Tips & Notes
                                </h4>
                                <div className="space-y-2">
                                  {s.localTips.map((tip: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-2 p-2 bg-blue-50 rounded">
                                      <span className="text-blue-600 mt-1">💡</span>
                                      <span className="text-sm">{tip}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                             {/* Quick Map Access */}
                             <div className="pt-2 border-t">
                               <div className="space-y-2">
                        {s.samplePlan?.accommodations?.[0]?.mapsUrl && (
                            <MapButton
                              url={s.samplePlan.accommodations[0].mapsUrl}
                              title={`${s.destination} Map`}
                              size="sm"
                                     variant="default"
                                     className="w-full"
                                   />
                                 )}
                                 <Button
                                   size="sm"
                                   variant="outline"
                                   className="w-full"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.destination)}, ${encodeURIComponent(s.state)}, India`, '_blank');
                                   }}
                                 >
                                   Explore {s.destination}
                                 </Button>
                                 
                                 {/* Export, QR Code and Share Buttons for Suggestions */}
                                 <div className="flex gap-2">
                                   <Button
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       // Create comprehensive trip summary
                                       const summary = `
${s.destination} Trip Summary
${s.state}, ${s.region}

💰 Budget Breakdown:
${s.breakdown?.flights ? `✈️ Flights: ₹${s.breakdown.flights.toLocaleString()}` : ''}
${s.breakdown?.accommodation ? `🏨 Stay: ₹${s.breakdown.accommodation.toLocaleString()}` : ''}
${s.breakdown?.food ? `🍽️ Food: ₹${s.breakdown.food.toLocaleString()}` : ''}
${s.breakdown?.localTransport ? `🚗 Transport: ₹${s.breakdown.localTransport.toLocaleString()}` : ''}
${s.breakdown?.attractions ? `🎯 Activities: ₹${s.breakdown.attractions.toLocaleString()}` : ''}
${s.breakdown?.miscellaneous ? `📦 Misc: ₹${s.breakdown.miscellaneous.toLocaleString()}` : ''}

🚗 Transportation Options:
Primary: ${s.transportation?.toDestination?.mode || 'N/A'} - ₹${s.transportation?.toDestination?.cost?.toLocaleString() || 'N/A'} (${s.transportation?.toDestination?.duration || 'N/A'})
${s.transportation?.availableOptions?.map((opt: any) => `• ${opt.mode}: ₹${opt.cost?.toLocaleString()} (${opt.duration}) - ${opt.description || ''}`).join('\n') || ''}

⭐ Highlights:
${s.highlights?.map((h: string) => `• ${h}`).join('\n') || 'N/A'}

🏛️ Places to Visit:
${s.samplePlan?.attractions?.map((a: any) => `• ${a.name} - ${a.location}`).join('\n') || 'N/A'}

🏨 Accommodations:
${s.samplePlan?.accommodations?.map((acc: any) => `• ${acc.name} - ₹${acc.price?.toLocaleString()}/night`).join('\n') || 'N/A'}

🍽️ Restaurants:
${s.samplePlan?.restaurants?.map((r: any) => `• ${r.name} - ${r.cuisine}`).join('\n') || 'N/A'}

💡 Travel Tips:
${s.localTips?.map((tip: string) => `• ${tip}`).join('\n') || 'N/A'}

📍 Google Maps: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.destination)}, ${encodeURIComponent(s.state)}, India
                                       `.trim();
                                       
                                       // Create and download text file
                                       const blob = new Blob([summary], { type: 'text/plain' });
                                       const url = URL.createObjectURL(blob);
                                       const a = document.createElement('a');
                                       a.href = url;
                                       a.download = `${s.destination}-trip-summary.txt`;
                                       document.body.appendChild(a);
                                       a.click();
                                       document.body.removeChild(a);
                                       URL.revokeObjectURL(url);
                                     }}
                                     variant="default"
                                     size="sm"
                                     className="flex-1 flex items-center gap-2"
                                   >
                                     📄 Export
                                   </Button>
                                   <Button
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.destination)}, ${encodeURIComponent(s.state)}, India`;
                                       const qrUrl = generateQRCode(mapsUrl);
                                       window.open(qrUrl, '_blank');
                                     }}
                                     variant="outline"
                                     size="sm"
                                     className="flex-1 flex items-center gap-2"
                                   >
                                     <QrCode className="w-4 h-4" />
                                     QR Code
                                   </Button>
                                   <Button
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       shareTrip(t, 'suggest');
                                     }}
                              variant="outline"
                                     size="sm"
                                     className="flex-1 flex items-center gap-2"
                                   >
                                     <Share2 className="w-4 h-4" />
                                     Share
                                   </Button>
                                 </div>
                               </div>
                             </div>
                          </div>
                          </div>
                        )}
                    </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}



