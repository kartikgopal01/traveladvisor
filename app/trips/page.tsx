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
  const [expandedTripCard, setExpandedTripCard] = useState<string | null>(null);
  
  // Get popup width and height classes
  const getPopupClasses = () => {
    switch (popupWidth) {
      case 'sm': return {
        width: 'w-[90vw] sm:w-[70vw] md:w-[60vw] lg:w-[50vw] max-w-2xl',
        height: 'h-[70vh] max-h-[80vh]',
        position: 'popup-mobile sm:popup-tablet md:popup-desktop'
      };
      case 'md': return {
        width: 'w-[95vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] max-w-4xl',
        height: 'h-[80vh] max-h-[85vh]',
        position: 'popup-mobile sm:popup-tablet md:popup-desktop'
      };
      case 'lg': return {
        width: 'w-[98vw] sm:w-[90vw] md:w-[80vw] lg:w-[70vw] max-w-6xl',
        height: 'h-[85vh] max-h-[90vh]',
        position: 'popup-mobile sm:popup-tablet md:popup-desktop'
      };
      case 'xl': return {
        width: 'w-[99vw] sm:w-[95vw] md:w-[90vw] lg:w-[80vw] max-w-7xl',
        height: 'h-[90vh] max-h-[95vh]',
        position: 'popup-mobile sm:popup-tablet md:popup-desktop'
      };
      default: return {
        width: 'w-[95vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] max-w-4xl',
        height: 'h-[80vh] max-h-[85vh]',
        position: 'popup-mobile sm:popup-tablet md:popup-desktop'
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
    <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-10" onClick={handleClickOutside}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
      <h1 className="text-2xl sm:text-3xl font-semibold">Your Trips</h1>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
          {/* Tab Buttons */}
          <div className="flex gap-1 sm:gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all touch-target flex-1 sm:flex-none ${
                activeTab === 'suggestions'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              <span className="hidden sm:inline">Destination Suggestions</span>
              <span className="sm:hidden">Suggestions</span>
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all touch-target flex-1 sm:flex-none ${
                activeTab === 'plans'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              <span className="hidden sm:inline">Trip Plans</span>
              <span className="sm:hidden">Plans</span>
            </button>
          </div>
          
          {/* Sort Button */}
          {sortedTrips.length > 0 && (
            <Button
              onClick={toggleSortOrder}
              variant="outline"
              size="sm"
              className="flex items-center gap-1 sm:gap-2 touch-target btn-mobile"
            >
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
              <span className="sm:hidden">{sortOrder === 'newest' ? 'New' : 'Old'}</span>
              <ArrowUpDown className="w-3 h-3 sm:w-4 sm:h-4" />
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

      <div className="mt-4 sm:mt-6 grid grid-cols-1 gap-3 sm:gap-4">
        {sortedTrips.map((t: any) => (
          <Card key={t.id} data-trip-id={t.id} className="card-mobile">
            <CardHeader className="p-mobile">
              <CardTitle className="flex items-center justify-between text-mobile-lg">
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
            <CardContent className="space-y-3 sm:space-y-4 p-mobile">
              {activeTab === 'plans' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <div className="text-mobile-sm text-muted-foreground">Total Budget</div>
                    <div className="text-mobile-xl font-semibold">₹{t.result?.totalBudget?.toLocaleString?.() || "-"}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-mobile-sm text-muted-foreground">Days</div>
                    <div className="text-mobile-xl font-semibold">{t.result?.days}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-mobile-sm text-muted-foreground">Destinations</div>
                    <div className="text-mobile-sm">{t.result?.destinations?.join(", ")}</div>
                  </div>
                </div>
              )}

              {/* Preference Analysis for Trip Plans */}
              {activeTab === 'plans' && t.result?.preferenceAnalysis && (
                <div className="space-y-3">
                  <div className="text-mobile-sm font-medium">🎯 Your Preferences Analysis</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Interests Coverage */}
                    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                          <span className="text-white text-sm font-bold">🎯</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-blue-800">Interests</div>
                          <div className="text-xs text-blue-600 font-medium">{t.result.preferenceAnalysis.interestsCoverage.coveragePercentage}% Match</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {t.result.preferenceAnalysis.interestsCoverage.matchedInterests.slice(0, 2).map((interest: string, idx: number) => (
                          <div key={idx} className="text-xs bg-blue-100 text-blue-800 px-3 py-2 rounded-lg border border-blue-200 shadow-sm">
                            ✓ {interest}
                          </div>
                        ))}
                        {t.result.preferenceAnalysis.interestsCoverage.matchedInterests.length > 2 && (
                          <div className="text-xs text-blue-600">
                            +{t.result.preferenceAnalysis.interestsCoverage.matchedInterests.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dietary Compliance */}
                    <div className="border border-green-200 bg-green-50 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center shadow-md">
                          <span className="text-white text-sm font-bold">🍽️</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-green-800">Dietary</div>
                          <div className="text-xs text-green-600 font-medium">{t.result.preferenceAnalysis.dietaryCompliance.compliancePercentage}% Compliant</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {t.result.preferenceAnalysis.dietaryCompliance.restrictions.slice(0, 2).map((restriction: string, idx: number) => (
                          <div key={idx} className="text-xs bg-green-100 text-green-800 px-3 py-2 rounded-lg border border-green-200 shadow-sm">
                            ✓ {restriction}
                          </div>
                        ))}
                        {t.result.preferenceAnalysis.dietaryCompliance.restrictions.length > 2 && (
                          <div className="text-xs text-green-600">
                            +{t.result.preferenceAnalysis.dietaryCompliance.restrictions.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Accessibility Compliance */}
                    <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 shadow-lg hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center shadow-md">
                          <span className="text-white text-sm font-bold">♿</span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-purple-800">Accessibility</div>
                          <div className="text-xs text-purple-600 font-medium">{t.result.preferenceAnalysis.accessibilityCompliance.compliancePercentage}% Accessible</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {t.result.preferenceAnalysis.accessibilityCompliance.requirements.slice(0, 2).map((requirement: string, idx: number) => (
                          <div key={idx} className="text-xs bg-purple-100 text-purple-800 px-3 py-2 rounded-lg border border-purple-200 shadow-sm">
                            ✓ {requirement}
                          </div>
                        ))}
                        {t.result.preferenceAnalysis.accessibilityCompliance.requirements.length > 2 && (
                          <div className="text-xs text-purple-600">
                            +{t.result.preferenceAnalysis.accessibilityCompliance.requirements.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'plans' && t.result?.attractions?.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Top Attractions</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(expandedTripCard === t.id ? t.result.attractions : t.result.attractions.slice(0, 2)).map((p: any, i: number) => (
                      <div key={i} className="border border-muted/50 rounded-lg p-4 text-sm bg-background/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <div className="font-medium text-lg mb-2">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.location}</div>
                          </div>
                          {p.mapsUrl && (
                            <MapButton url={p.mapsUrl} title={p.name} size="sm" variant="outline" />
                          )}
                        </div>
                        
                        {/* Interest Match Badges */}
                        {p.interestMatch && p.interestMatch.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {p.interestMatch.slice(0, 2).map((interest: string, idx: number) => (
                              <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-3 py-2 rounded-lg border border-blue-200 shadow-sm">
                                🎯 {interest}
                              </span>
                            ))}
                            {p.interestMatch.length > 2 && (
                              <span className="text-xs text-blue-600">
                                +{p.interestMatch.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Accessibility Info */}
                        {p.accessibilityInfo && (
                          <div className="text-xs text-purple-600 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200 shadow-sm">
                            ♿ {p.accessibilityInfo}
                          </div>
                        )}
                      </div>
                    ))}
                    {expandedTripCard !== t.id && t.result.attractions.length > 2 && (
                      <div className="text-sm text-muted-foreground text-center py-2 bg-muted rounded col-span-full">
                        +{t.result.attractions.length - 2} more attractions (click "View More" to see all)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {activeTab === 'plans' && (
                <div className="space-y-3">
                  {/* View More Button */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => setExpandedTripCard(expandedTripCard === t.id ? null : t.id)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      {expandedTripCard === t.id ? 'View Less' : 'View More'}
                    </Button>
                  </div>
                  
                  {/* Functional Action Buttons */}
                  {t.result?.destinations?.length > 0 && (
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
                </div>
              )}

              {/* Expanded Content - Detailed sections */}
              {activeTab === 'plans' && expandedTripCard === t.id && (
                <div className="space-y-4 transition-all duration-300 ease-in-out">
                  {/* Daily Itinerary */}
                  {t.result?.roadmap && t.result.roadmap.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-3">
                        📅 Daily Itinerary ({t.result.roadmap.length} days)
                      </div>
                      <div className="space-y-3">
                        {t.result.roadmap.map((day: any, dayIdx: number) => (
                          <div key={dayIdx} className="border rounded-lg p-3 bg-muted/30">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                                {day.day}
                              </div>
                              <h5 className="font-semibold text-sm">Day {day.day}</h5>
                              <span className="text-xs text-muted-foreground">
                                {day.locationName || day.destination || day.city || day.place || 'Location'}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{day.summary}</p>
                            
                            {/* Activities */}
                            {day.activities && day.activities.length > 0 && (
                              <div className="space-y-1">
                                <h6 className="font-medium text-xs text-foreground">
                                  Activities ({day.activities.length}):
                                </h6>
                                {day.activities.map((activity: any, actIdx: number) => (
                                  <div key={actIdx} className="flex items-start gap-2 p-2 bg-background rounded border text-xs">
                                    <div className="flex-1">
                                      <div className="font-medium text-xs">{activity.title}</div>
                                      {activity.description && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {activity.description}
                                        </div>
                                      )}
                                      {activity.time && activity.duration && activity.cost && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {activity.time} • {activity.duration} • ₹{activity.cost}
                                        </div>
                                      )}
                                      {activity.tips && (
                                        <div className="text-xs text-blue-600 mt-1">💡 {activity.tips}</div>
                                      )}
                                    </div>
                                    {activity.mapsUrl && (
                                      <MapButton
                                        url={activity.mapsUrl}
                                        title={activity.title}
                                        size="sm"
                                        variant="outline"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Meals */}
                            {day.meals && day.meals.length > 0 && (
                              <div className="mt-2">
                                <h6 className="font-medium text-xs text-foreground mb-1">
                                  Meals ({day.meals.length}):
                                </h6>
                                <div className="grid grid-cols-1 gap-1">
                                  {day.meals.map((meal: any, mealIdx: number) => (
                                    <div key={mealIdx} className="text-xs border rounded p-2 bg-background">
                                      <div className="font-medium">{meal.type}</div>
                                      <div className="text-muted-foreground">{meal.suggestion}</div>
                                      <div className="text-muted-foreground">₹{meal.cost}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Transportation */}
                            {day.transportation && (
                              <div className="mt-2">
                                <h6 className="font-medium text-xs text-foreground mb-1">Transportation:</h6>
                                <div className="text-xs border rounded p-2 bg-background">
                                  <div className="font-medium">{day.transportation.mode}</div>
                                  <div className="text-muted-foreground">{day.transportation.details}</div>
                                  <div className="text-muted-foreground">
                                    ₹{day.transportation.cost} • {day.transportation.duration}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Accommodation for the day */}
                            {day.accommodation && (
                              <div className="mt-2">
                                <h6 className="font-medium text-xs text-foreground mb-1">Accommodation:</h6>
                                <div className="text-xs border rounded p-2 bg-background">
                                  <div className="font-medium">{day.accommodation.name}</div>
                                  <div className="text-muted-foreground">₹{day.accommodation.price?.toLocaleString()}/night</div>
                                  {day.accommodation.location && (
                                    <div className="text-muted-foreground">{day.accommodation.location}</div>
                                  )}
                                  {day.accommodation.type && (
                                    <div className="text-muted-foreground">{day.accommodation.type}</div>
                                  )}
                                  {day.accommodation.amenities && (
                                    <div className="text-muted-foreground mt-1">
                                      Amenities: {day.accommodation.amenities.join(", ")}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Additional tips and notes */}
                            {day.tips && (
                              <div className="mt-2">
                                <h6 className="font-medium text-xs text-foreground mb-1">Day Tips:</h6>
                                <div className="text-xs text-blue-600 bg-blue-50 rounded p-2">
                                  💡 {day.tips}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      {/* Itinerary Summary */}
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                        <div className="text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>📊 Trip Summary:</span>
                            <span>
                              {t.result.roadmap.reduce((total: number, day: any) => total + (day.activities?.length || 0), 0)} activities • {' '}
                              {t.result.roadmap.reduce((total: number, day: any) => total + (day.meals?.length || 0), 0)} meals • {' '}
                              {t.result.roadmap.length} days
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* View Less Button at Bottom */}
                  <div className="flex justify-center pt-4 border-t">
                    <Button
                      onClick={() => {
                        // Get the current card element
                        const cardElement = document.querySelector(`[data-trip-id="${t.id}"]`);
                        
                        // Collapse the content first
                        setExpandedTripCard(null);
                        
                        // After content collapses, scroll to the card
                        setTimeout(() => {
                          if (cardElement) {
                            // Calculate the card's position
                            const cardRect = cardElement.getBoundingClientRect();
                            const cardTop = cardRect.top + window.scrollY;
                            
                            // Scroll to the card with some offset from top
                            const scrollPosition = cardTop - 100; // 100px offset from top
                            
                            window.scrollTo({
                              top: Math.max(0, scrollPosition), // Ensure we don't scroll above the page
                              behavior: 'smooth'
                            });
                          }
                        }, 150); // Slightly longer delay to ensure content has collapsed
                      }}
                      variant="outline"
                      size="sm"
                      className="px-6"
                    >
                      View Less
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 relative">
                  {t.result?.suggestions?.map((s: any, i: number) => {
                    const cardId = `${t.id}-suggestion-${i}`;
                    const isExpanded = expandedCard === cardId;
                    
                     return (
                       <div key={i} className="relative card-container">
                         <Card 
                           className={`cursor-pointer transition-all duration-300 border-muted bg-background shadow-lg hover:shadow-xl ${
                             isExpanded ? 'ring-2 ring-blue-500 shadow-xl z-10' : ''
                           }`}
                           onClick={() => handleCardClick(cardId)}
                         >
                        <CardContent className="pt-4 sm:pt-6 space-y-2 sm:space-y-3 flex flex-col h-full p-mobile">
                          <div className="flex-1 space-y-2 sm:space-y-3">
                            <div className="space-y-1">
                              <div className="font-medium text-mobile-lg">{s.destination}</div>
                              <div className="text-mobile-sm text-muted-foreground">{s.state} • {s.region}</div>
                              <div className="flex items-center justify-between">
                                <div className="text-mobile-lg font-semibold text-foreground">
                                  Est. ₹{s.estimatedCost?.toLocaleString?.()}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-mobile-xs font-medium text-foreground bg-muted px-2 py-1 rounded-full">
                                    {t.input?.days || s.days || s.samplePlan?.days || 'N/A'} days
                                  </div>
                                  {/* Preference Score */}
                                  {s.preferenceScore && (
                                    <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                      🎯 {s.preferenceScore}% Match
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Interest Match Badges */}
                              {s.interestMatch && s.interestMatch.length > 0 && (
                                <div className="flex flex-wrap gap-1 sm:gap-2">
                                  {s.interestMatch.slice(0, 3).map((interest: string, i: number) => (
                                    <span key={i} className="text-mobile-xs bg-blue-100 text-blue-800 px-2 sm:px-3 py-1 sm:py-2 rounded-lg border border-blue-200 shadow-sm">
                                      🎯 {interest}
                                    </span>
                                  ))}
                                  {s.interestMatch.length > 3 && (
                                    <span className="text-mobile-xs text-muted-foreground">
                                      +{s.interestMatch.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                          </div>
                          
                          {/* Click hint - moved to bottom */}
                          {!isExpanded && (
                            <div className="text-mobile-xs text-muted-foreground text-center pt-2 sm:pt-3 mt-auto border-t">
                              Click to see places to visit
                            </div>
                          )}
                        </CardContent>
                      </Card>

                       {/* Pop-up Overlay */}
                       {isExpanded && (
                         <div className={`${getPopupClasses().position} z-20 bg-blue-50 border border-blue-200 rounded-lg shadow-2xl p-3 sm:p-4 ${getPopupClasses().width} ${getPopupClasses().height}`}>
                           <div className="space-y-2 sm:space-y-3">
                             <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                               <h3 className="font-semibold text-mobile-lg text-blue-800">{s.destination}</h3>
                              <div className="flex items-center gap-2">
                                {/* Preference Score */}
                                {s.preferenceScore && (
                                  <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                    🎯 {s.preferenceScore}% Match
                                  </div>
                                )}
                                {/* Width Adjustment Controls */}
                                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPopupWidth('sm');
                                    }}
                                    className={`px-1 sm:px-2 py-1 rounded text-xs font-medium transition-all touch-target ${
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
                                    className={`px-1 sm:px-2 py-1 rounded text-xs font-medium transition-all touch-target ${
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
                                    className={`px-1 sm:px-2 py-1 rounded text-xs font-medium transition-all touch-target ${
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
                                    className={`px-1 sm:px-2 py-1 rounded text-xs font-medium transition-all touch-target ${
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
                                  className="text-muted-foreground hover:text-foreground text-xl touch-target mobile-hover"
                                >
                                  ×
                                </button>
                              </div>
                            </div>

                            {/* Interest Match Badges */}
                            {s.interestMatch && s.interestMatch.length > 0 && (
                              <div>
                                <h4 className="font-medium text-sm mb-2 text-foreground">
                                  🎯 Matches Your Interests
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {s.interestMatch.map((interest: string, i: number) => (
                                    <span key={i} className="text-xs bg-blue-100 text-blue-800 px-3 py-2 rounded-lg border border-blue-200 shadow-sm">
                                      🎯 {interest}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

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
                                       
                                       {/* Interest Match Badges */}
                                       {attraction.interestMatch && attraction.interestMatch.length > 0 && (
                                         <div className="flex flex-wrap gap-2 mb-2">
                                           {attraction.interestMatch.slice(0, 2).map((interest: string, i: number) => (
                                             <span key={i} className="text-xs bg-blue-100 text-blue-800 px-3 py-2 rounded-lg border border-blue-200 shadow-sm">
                                               🎯 {interest}
                                             </span>
                                           ))}
                                           {attraction.interestMatch.length > 2 && (
                                             <span className="text-xs text-blue-600">
                                               +{attraction.interestMatch.length - 2} more
                                             </span>
                                           )}
                                         </div>
                                       )}
                                       
                                       {/* Accessibility Info */}
                                       {attraction.accessibilityInfo && (
                                         <div className="text-xs text-purple-600 bg-purple-50 px-3 py-2 rounded-lg border border-purple-200 shadow-sm mb-2">
                                           ♿ {attraction.accessibilityInfo}
                                         </div>
                                       )}
                                       
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
                                       
                                       {/* Accessibility Features */}
                                       {accommodation.accessibilityFeatures && accommodation.accessibilityFeatures.length > 0 && (
                                         <div className="flex flex-wrap gap-2 mb-2">
                                           {accommodation.accessibilityFeatures.slice(0, 2).map((feature: string, i: number) => (
                                             <span key={i} className="text-xs bg-purple-100 text-purple-800 px-3 py-2 rounded-lg border border-purple-200 shadow-sm">
                                               ♿ {feature}
                                             </span>
                                           ))}
                                           {accommodation.accessibilityFeatures.length > 2 && (
                                             <span className="text-xs text-purple-600">
                                               +{accommodation.accessibilityFeatures.length - 2} more
                                             </span>
                                           )}
                                         </div>
                                       )}
                                       
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
                                       
                                       {/* Dietary Compliance */}
                                       {restaurant.dietaryCompliance && restaurant.dietaryCompliance.length > 0 && (
                                         <div className="flex flex-wrap gap-2 mb-2">
                                           {restaurant.dietaryCompliance.slice(0, 2).map((diet: string, i: number) => (
                                             <span key={i} className="text-xs bg-green-100 text-green-800 px-3 py-2 rounded-lg border border-green-200 shadow-sm">
                                               ✓ {diet}
                                             </span>
                                           ))}
                                           {restaurant.dietaryCompliance.length > 2 && (
                                             <span className="text-xs text-green-600">
                                               +{restaurant.dietaryCompliance.length - 2} more
                                             </span>
                                           )}
                                         </div>
                                       )}
                                       
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



