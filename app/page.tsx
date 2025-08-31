"use client";
import { useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { MapPin, Calendar, Users, IndianRupee, Camera, Utensils, Train, Car, Plane } from "lucide-react";
import { MapButton } from "@/components/maps/map-button";
import { TripMap } from "@/components/maps/trip-map";
import { MapPreview, MapGrid } from "@/components/maps/map-preview";
import { DirectionsPanel } from "@/components/maps/directions-panel";
import { MapsIntegrationSummary, MapStats } from "@/components/maps/maps-integration-summary";
import { DistanceCostPanel } from "@/components/maps/distance-cost-panel";
import { PartnerHotelsPanel } from "@/components/partner-hotels/panel";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [planResult, setPlanResult] = useState<any | null>(null);
  const [suggestResult, setSuggestResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states for plan
  const [places, setPlaces] = useState<string[]>([""]);
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] = useState(50000);
  const [travelStyle, setTravelStyle] = useState("balanced");
  const [accommodationType, setAccommodationType] = useState("hotel");
  const [transportationType, setTransportationType] = useState("mix");
  const [interests, setInterests] = useState<string[]>([]);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [accessibility, setAccessibility] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  // Form states for suggest
  const [budgetINR, setBudgetINR] = useState(50000);
  const [suggestDays, setSuggestDays] = useState(3);
  const [origin, setOrigin] = useState("");
  const [suggestTravelStyle, setSuggestTravelStyle] = useState("balanced");
  const [suggestInterests, setSuggestInterests] = useState<string[]>([]);
  const [preferredSeason, setPreferredSeason] = useState("any");
  const [groupSize, setGroupSize] = useState(2);

  const interestOptions = [
    "Culture & Heritage", "Adventure & Trekking", "Wildlife & Nature", "Beach & Relaxation",
    "Food & Cuisine", "Shopping & Markets", "Photography", "Festivals & Events",
    "Spiritual & Religious", "Nightlife", "History", "Architecture"
  ];

  const dietaryOptions = [
    "Vegetarian", "Vegan", "Jain", "Halal", "Kosher", "Gluten-Free", "Dairy-Free"
  ];

  const accessibilityOptions = [
    "Wheelchair Accessible", "Hearing Impaired", "Visually Impaired", "Elderly Friendly"
  ];

  async function createPlan() {
    setLoading(true);
    setSuggestResult(null);
    setErrorMsg(null);
    try {
      const validPlaces = places.filter(p => p.trim() !== "");
      if (validPlaces.length === 0) {
        setErrorMsg("Please add at least one destination");
        return;
      }

      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          places: validPlaces,
          days,
          travelers,
          budget,
          travelStyle,
          accommodationType,
          transportationType,
          interests,
          dietaryRestrictions,
          accessibility,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          specialRequests: specialRequests || undefined
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const extra = data?.details || (typeof data?.raw === "string" ? `: ${data.raw.slice(0, 200)}...` : "");
        setErrorMsg((data?.error || "Failed to generate plan") + extra);
        return;
      }
      setPlanResult(data.plan || data);
    } finally {
      setLoading(false);
    }
  }

  async function suggestTrips() {
    setLoading(true);
    setPlanResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetINR,
          days: suggestDays,
          origin: origin || undefined,
          travelStyle: suggestTravelStyle,
          interests: suggestInterests,
          preferredSeason: preferredSeason || undefined,
          groupSize
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const extra = data?.details || (typeof data?.raw === "string" ? `: ${data.raw.slice(0, 200)}...` : "");
        setErrorMsg((data?.error || "Failed to suggest destinations") + extra);
        return;
      }
      setSuggestResult(data.suggestions || data);
    } finally {
      setLoading(false);
    }
  }

  const addPlace = () => {
    setPlaces([...places, ""]);
  };

  const removePlace = (index: number) => {
    if (places.length > 1) {
      setPlaces(places.filter((_, i) => i !== index));
    }
  };

  const updatePlace = (index: number, value: string) => {
    const newPlaces = [...places];
    newPlaces[index] = value;
    setPlaces(newPlaces);
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleSuggestInterest = (interest: string) => {
    setSuggestInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleDietary = (option: string) => {
    setDietaryRestrictions(prev =>
      prev.includes(option)
        ? prev.filter(d => d !== option)
        : [...prev, option]
    );
  };

  const toggleAccessibility = (option: string) => {
    setAccessibility(prev =>
      prev.includes(option)
        ? prev.filter(a => a !== option)
        : [...prev, option]
    );
  };

  return (
    <div className="min-h-screen px-6 py-10 max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Trip Advisor
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Plan perfect trips across India with AI-powered recommendations
        </p>
      </div>

      <SignedOut>
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Welcome to Trip Advisor</CardTitle>
            <CardDescription>Please sign in to start planning your perfect Indian adventure</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
          <SignInButton mode="modal">
              <Button size="lg" className="w-full">
                Sign in to Get Started
              </Button>
          </SignInButton>
          </CardContent>
        </Card>
      </SignedOut>

      <SignedIn>
        <Tabs defaultValue="plan" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="plan" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Plan by Places
            </TabsTrigger>
            <TabsTrigger value="suggest" className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4" />
              Suggest by Budget
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plan" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Create Custom Trip Plan
                </CardTitle>
                <CardDescription>
                  Plan your perfect Indian adventure by specifying destinations and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Places Section */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Destinations in India</Label>
                  {places.map((place, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Destination ${index + 1} (e.g., Mumbai, Kerala, Delhi)`}
                        value={place}
                        onChange={(e) => updatePlace(index, e.target.value)}
                        className="flex-1"
                      />
                      {places.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removePlace(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPlace}
                    className="w-full"
                  >
                    Add Another Destination
                  </Button>
                </div>

                {/* Basic Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="days">Number of Days</Label>
                    <Input
                      id="days"
                      type="number"
                      min={1}
                      max={30}
                      value={days}
                      onChange={(e) => setDays(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="travelers">Number of Travelers</Label>
                    <Input
                      id="travelers"
                      type="number"
                      min={1}
                      max={20}
                      value={travelers}
                      onChange={(e) => setTravelers(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget">Total Budget (₹)</Label>
                    <Input
                      id="budget"
                      type="number"
                      min={1000}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Travel Preferences */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="travelStyle">Travel Style</Label>
                    <Select value={travelStyle} onValueChange={setTravelStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="budget">Budget</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="luxury">Luxury</SelectItem>
                        <SelectItem value="adventure">Adventure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accommodation">Accommodation Type</Label>
                    <Select value={accommodationType} onValueChange={setAccommodationType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="budget-hotel">Budget Hotel</SelectItem>
                        <SelectItem value="hotel">Standard Hotel</SelectItem>
                        <SelectItem value="boutique">Boutique Hotel</SelectItem>
                        <SelectItem value="resort">Resort</SelectItem>
                        <SelectItem value="homestay">Homestay</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transportation">Transportation</Label>
                    <Select value={transportationType} onValueChange={setTransportationType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="train">Train</SelectItem>
                        <SelectItem value="bus">Bus</SelectItem>
                        <SelectItem value="car">Car Rental</SelectItem>
                        <SelectItem value="flight">Flight</SelectItem>
                        <SelectItem value="mix">Mix</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Interests */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Interests & Activities</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {interestOptions.map((interest) => (
                      <div key={interest} className="flex items-center space-x-2">
                        <Checkbox
                          id={`interest-${interest}`}
                          checked={interests.includes(interest)}
                          onCheckedChange={() => toggleInterest(interest)}
                        />
                        <Label
                          htmlFor={`interest-${interest}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {interest}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dietary Restrictions */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Dietary Restrictions</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {dietaryOptions.map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`dietary-${option}`}
                          checked={dietaryRestrictions.includes(option)}
                          onCheckedChange={() => toggleDietary(option)}
                        />
                        <Label
                          htmlFor={`dietary-${option}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Accessibility */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Accessibility Requirements</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {accessibilityOptions.map((option) => (
                      <div key={option} className="flex items-center space-x-2">
                        <Checkbox
                          id={`accessibility-${option}`}
                          checked={accessibility.includes(option)}
                          onCheckedChange={() => toggleAccessibility(option)}
                        />
                        <Label
                          htmlFor={`accessibility-${option}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {option}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date (Optional)</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Special Requests */}
                <div className="space-y-2">
                  <Label htmlFor="specialRequests">Special Requests (Optional)</Label>
                  <Input
                    id="specialRequests"
                    placeholder="Any special requirements or preferences..."
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                  />
                </div>

                <Button
                  onClick={createPlan}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? "Planning Your Trip..." : "Generate Trip Plan"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suggest" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IndianRupee className="w-5 h-5" />
                  Get Destination Suggestions
                </CardTitle>
                <CardDescription>
                  Let AI suggest the best Indian destinations based on your budget and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Budget and Basic Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="budgetINR">Total Budget (₹)</Label>
                    <Input
                      id="budgetINR"
                      type="number"
                      min={5000}
                      value={budgetINR}
                      onChange={(e) => setBudgetINR(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="suggestDays">Number of Days</Label>
                    <Input
                      id="suggestDays"
                      type="number"
                      min={2}
                      max={30}
                      value={suggestDays}
                      onChange={(e) => setSuggestDays(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="groupSize">Group Size</Label>
                    <Input
                      id="groupSize"
                      type="number"
                      min={1}
                      max={20}
                      value={groupSize}
                      onChange={(e) => setGroupSize(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Travel Style and Origin */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="suggestTravelStyle">Travel Style</Label>
                    <Select value={suggestTravelStyle} onValueChange={setSuggestTravelStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="budget">Budget</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="luxury">Luxury</SelectItem>
                        <SelectItem value="adventure">Adventure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferredSeason">Preferred Season</Label>
                    <Select value={preferredSeason} onValueChange={setPreferredSeason}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any Season</SelectItem>
                        <SelectItem value="summer">Summer (Mar-Jun)</SelectItem>
                        <SelectItem value="monsoon">Monsoon (Jun-Sep)</SelectItem>
                        <SelectItem value="autumn">Autumn (Sep-Nov)</SelectItem>
                        <SelectItem value="winter">Winter (Dec-Feb)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="origin">Starting Location (Optional)</Label>
                    <Input
                      id="origin"
                      placeholder="e.g., Mumbai, Delhi"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                    />
                  </div>
                </div>

                {/* Interests for suggestions */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Interests & Activities</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {interestOptions.map((interest) => (
                      <div key={interest} className="flex items-center space-x-2">
                        <Checkbox
                          id={`suggest-interest-${interest}`}
                          checked={suggestInterests.includes(interest)}
                          onCheckedChange={() => toggleSuggestInterest(interest)}
                        />
                        <Label
                          htmlFor={`suggest-interest-${interest}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {interest}
                        </Label>
                      </div>
                    ))}
              </div>
            </div>

                <Button
                  onClick={suggestTrips}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? "Finding Perfect Destinations..." : "Get Suggestions"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium">Crafting your perfect Indian adventure...</p>
            </div>
        </div>
        )}

        {errorMsg && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{errorMsg}</p>
            </CardContent>
          </Card>
        )}

        {planResult && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Your Custom Trip Plan
                </CardTitle>
                <CardDescription>
                  Destinations: {planResult.destinations?.join(", ") || "India"}
                  • Total Budget: ₹{planResult.totalBudget?.toLocaleString() || "N/A"}
                  • {planResult.days} Days • {planResult.currency}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Budget Breakdown */}
                {planResult.budgetBreakdown && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Budget Breakdown</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">₹{planResult.budgetBreakdown.accommodation?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Accommodation</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">₹{planResult.budgetBreakdown.transportation?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Transportation</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">₹{planResult.budgetBreakdown.food?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Food</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">₹{planResult.budgetBreakdown.attractions?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Attractions</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold">₹{planResult.budgetBreakdown.miscellaneous?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Miscellaneous</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold text-green-600">₹{planResult.budgetBreakdown.total?.toLocaleString()}</div>
                          <p className="text-sm text-muted-foreground">Total</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Roadmap */}
                {planResult.roadmap && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Daily Itinerary</h4>
                    <div className="space-y-4">
                      {planResult.roadmap.map((day: any) => (
                        <Card key={day.day}>
                          <CardHeader>
                            <CardTitle className="text-lg">Day {day.day}: {day.location}</CardTitle>
                            <CardDescription>{day.date && new Date(day.date).toLocaleDateString()}</CardDescription>
                            <p className="text-sm">{day.summary}</p>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Activities */}
                            {day.activities && day.activities.length > 0 && (
                              <div>
                                <h5 className="font-semibold mb-2 flex items-center gap-2">
                                  <Camera className="w-4 h-4" />
                                  Activities
                                </h5>
                                <div className="space-y-2">
                                  {day.activities.map((activity: any, idx: number) => (
                                    <div key={idx} className="border rounded p-3">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                          <div className="font-medium">{activity.title}</div>
                                          <div className="text-sm text-muted-foreground">{activity.description}</div>
                                          <div className="text-xs text-muted-foreground mt-1">
                                            {activity.time} • {activity.duration} • ₹{activity.cost}
                                          </div>
                                          {activity.tips && (
                                            <div className="text-xs mt-1 text-blue-600">💡 {activity.tips}</div>
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
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Meals */}
                            {day.meals && day.meals.length > 0 && (
                              <div>
                                <h5 className="font-semibold mb-2 flex items-center gap-2">
                                  <Utensils className="w-4 h-4" />
                                  Meals
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  {day.meals.map((meal: any, idx: number) => (
                                    <div key={idx} className="text-sm border rounded p-2">
                                      <div className="font-medium">{meal.type}</div>
                                      <div>{meal.suggestion}</div>
                                      <div className="text-xs text-muted-foreground">₹{meal.cost}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Transportation */}
                            {day.transportation && (
              <div>
                                <h5 className="font-semibold mb-2 flex items-center gap-2">
                                  <Train className="w-4 h-4" />
                                  Transportation
                                </h5>
                                <div className="text-sm border rounded p-2">
                                  <div className="font-medium">{day.transportation.mode}</div>
                                  <div>{day.transportation.details}</div>
                                  <div className="text-xs text-muted-foreground">
                                    ₹{day.transportation.cost} • {day.transportation.duration}
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trip Route Map */}
                {planResult.roadmap && planResult.roadmap.length > 0 && (
                  <div className="space-y-4">
                    <TripMap
                      destinations={planResult.roadmap.map((day: any) => ({
                        name: day.location,
                        location: day.location,
                        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.location)}, India`,
                        day: day.day,
                      }))}
                      title="Your Trip Route"
                    />
                  </div>
                )}

                {/* Directions Panel */}
                {planResult.roadmap && planResult.roadmap.length > 1 && (
                  <div className="space-y-4">
                    <DirectionsPanel
                      destinations={planResult.roadmap.map((day: any) => ({
                        name: day.location,
                        location: day.location,
                        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.location)}, India`,
                        day: day.day,
                      }))}
                      title="Navigation & Directions"
                    />
                  </div>
                )}

                {/* Accommodations */}
                {planResult.accommodations && planResult.accommodations.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Recommended Accommodations</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {planResult.accommodations.map((hotel: any, idx: number) => (
                        <Card key={idx}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h5 className="font-semibold">{hotel.name}</h5>
                                <p className="text-sm text-muted-foreground">{hotel.location}</p>
                                <p className="text-sm">{hotel.type}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-sm font-medium">₹{hotel.pricePerNight}/night</span>
                                  {hotel.rating && <span className="text-xs">⭐ {hotel.rating}</span>}
                                </div>
                                {hotel.amenities && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {hotel.amenities.slice(0, 3).map((amenity: string, i: number) => (
                                      <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                                        {amenity}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {hotel.mapsUrl && (
                                <MapButton
                                  url={hotel.mapsUrl}
                                  title={hotel.name}
                                  size="sm"
                                  variant="outline"
                                />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attractions */}
                {planResult.attractions && planResult.attractions.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Must-Visit Attractions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {planResult.attractions.map((place: any, idx: number) => (
                        <Card key={idx}>
                          <CardContent className="pt-6">
                            <h5 className="font-semibold">{place.name}</h5>
                            <p className="text-sm text-muted-foreground">{place.location}</p>
                            <p className="text-sm mt-2">{place.description}</p>
                            <div className="flex items-center justify-between mt-3">
                              <div className="text-sm">
                                <div>₹{place.entryFee}</div>
                                <div className="text-xs text-muted-foreground">
                                  {place.bestTime} • {place.duration}
                                </div>
                              </div>
                              <MapButton
                                url={place.mapsUrl}
                                title={place.name}
                                size="sm"
                                variant="outline"
                              />
                            </div>
                            {place.tips && (
                              <div className="text-xs mt-2 text-blue-600">💡 {place.tips}</div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Map Preview for Key Attractions */}
                {planResult.attractions && planResult.attractions.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Location Map - Key Attractions</h4>
                    <MapGrid
                      locations={planResult.attractions.slice(0, 6).map((place: any) => ({
                        name: place.name,
                        location: place.location,
                        mapsUrl: place.mapsUrl,
                      }))}
                    />
                    <DistanceCostPanel
                      destinations={planResult.attractions.slice(0, 6).map((place: any) => ({
                        name: place.name,
                        location: place.location,
                        mapsQuery: `${place.name}, ${place.location}, India`,
                      }))}
                      costPerKmINR={15}
                      baseFareINR={0}
                    />
                  </div>
                )}

                {/* Restaurants */}
                {planResult.restaurants && planResult.restaurants.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Recommended Restaurants</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {planResult.restaurants.map((restaurant: any, idx: number) => (
                        <Card key={idx}>
                          <CardContent className="pt-6">
                            <h5 className="font-semibold">{restaurant.name}</h5>
                            <p className="text-sm text-muted-foreground">{restaurant.cuisine}</p>
                            <p className="text-sm">{restaurant.location}</p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="text-sm">
                                <div className="font-medium">{restaurant.priceRange}</div>
                                <div className="text-xs text-muted-foreground">
                                  {restaurant.specialties?.join(", ")}
                                </div>
                              </div>
                              <MapButton
                                url={restaurant.mapsUrl}
                                title={restaurant.name}
                                size="sm"
                                variant="outline"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Partner Hotels near destinations */}
                {planResult.destinations && planResult.destinations.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Partner Hotels Near Your Trip</h4>
                    <PartnerHotelsPanel destinations={planResult.destinations} />
                  </div>
                )}

                {/* Transportation Summary */}
                {planResult.transportation && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Transportation Overview</h4>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-sm mb-4">{planResult.transportation.summary}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {planResult.transportation.options?.map((option: any, idx: number) => (
                            <div key={idx} className="border rounded p-3">
                              <div className="font-medium">{option.mode}</div>
                              <div className="text-sm text-muted-foreground">{option.description}</div>
                              <div className="text-xs mt-1">
                                ₹{option.cost} • {option.duration}
                              </div>
                              <div className="text-xs text-blue-600 mt-1">💡 {option.tips}</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Packing List */}
                {planResult.packingList && planResult.packingList.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Packing Checklist</h4>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {planResult.packingList.map((item: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Checkbox id={`pack-${idx}`} />
                              <Label htmlFor={`pack-${idx}`} className="text-sm">
                                {item}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
              </div>
                )}

                {/* Local Tips */}
                {planResult.localTips && planResult.localTips.length > 0 && (
              <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Local Tips & Advice</h4>
                    <Card>
                      <CardContent className="pt-6">
                        <ul className="space-y-2">
                          {planResult.localTips.map((tip: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-blue-600 mt-1">💡</span>
                              <span className="text-sm">{tip}</span>
                      </li>
                    ))}
                  </ul>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Emergency Contacts */}
                {planResult.emergencyContacts && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold">Emergency Contacts</h4>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl mb-2">🚔</div>
                            <div className="font-medium">Police</div>
                            <div className="text-sm text-muted-foreground">{planResult.emergencyContacts.police}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl mb-2">🏥</div>
                            <div className="font-medium">Hospital</div>
                            <div className="text-sm text-muted-foreground">{planResult.emergencyContacts.hospital}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl mb-2">📞</div>
                            <div className="font-medium">Tourist Helpline</div>
                            <div className="text-sm text-muted-foreground">{planResult.emergencyContacts.touristHelpline}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Map Integration Summary */}
                <div className="space-y-6">
                  <MapStats
                    totalLocations={planResult.attractions?.length || 0}
                    totalActivities={planResult.roadmap?.reduce((total: number, day: any) => total + (day.activities?.length || 0), 0) || 0}
                  />

                  <MapsIntegrationSummary
                    destinations={planResult.destinations || []}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {suggestResult && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IndianRupee className="w-5 h-5" />
                  Destination Suggestions
                </CardTitle>
                <CardDescription>
                  {suggestResult.suggestions?.length} destinations matching your preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {suggestResult.suggestions?.map((suggestion: any, idx: number) => (
                    <Card key={idx} className="h-full">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <CardTitle className="text-xl">{suggestion.destination}</CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              {suggestion.state}, {suggestion.region}
                            </CardDescription>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">
                              ₹{suggestion.estimatedCost?.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {suggestion.budgetCategory}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Best Time & Highlights */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4" />
                            <span className="font-medium">Best Time:</span>
                            <span>{suggestion.bestTimeToVisit}</span>
                          </div>
                          {suggestion.highlights && suggestion.highlights.length > 0 && (
                <div>
                              <div className="font-medium text-sm mb-1">Highlights:</div>
                              <ul className="text-xs space-y-1">
                                {suggestion.highlights.slice(0, 3).map((highlight: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-green-600 mt-1">✓</span>
                                    <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                          )}
                        </div>

                        {/* Budget Breakdown */}
                        {suggestion.breakdown && (
                          <div className="space-y-2">
                            <div className="font-medium text-sm">Budget Breakdown:</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex justify-between">
                                <span>Flights:</span>
                                <span>₹{suggestion.breakdown.flights?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Stay:</span>
                                <span>₹{suggestion.breakdown.accommodation?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Food:</span>
                                <span>₹{suggestion.breakdown.food?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Transport:</span>
                                <span>₹{suggestion.breakdown.localTransport?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Activities:</span>
                                <span>₹{suggestion.breakdown.attractions?.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Misc:</span>
                                <span>₹{suggestion.breakdown.miscellaneous?.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Sample Plan Preview */}
                        {suggestion.samplePlan && (
                          <div className="space-y-2">
                            <div className="font-medium text-sm">Sample Daily Plan:</div>
                            <div className="space-y-2">
                              {suggestion.samplePlan.roadmap?.slice(0, 2).map((day: any) => (
                                <div key={day.day} className="text-xs border rounded p-2 bg-muted/50">
                                  <div className="font-medium">Day {day.day}:</div>
                                  <div className="text-muted-foreground">{day.summary}</div>
                                  <div className="mt-1">
                                    {day.activities?.slice(0, 2).map((activity: any, i: number) => (
                                      <div key={i} className="text-xs">
                                        • {activity.title}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Transportation */}
                        {suggestion.transportation && (
                          <div className="space-y-2">
                            <div className="font-medium text-sm">Getting There:</div>
                            <div className="text-xs border rounded p-2">
                              <div className="font-medium">{suggestion.transportation.toDestination?.mode}</div>
                              <div className="text-muted-foreground">
                                {suggestion.transportation.toDestination?.duration} •
                                ₹{suggestion.transportation.toDestination?.cost?.toLocaleString()}
                              </div>
                              <div className="text-blue-600 mt-1">
                                💡 {suggestion.transportation.toDestination?.tips}
              </div>
            </div>
          </div>
        )}

                        {/* Local Tips */}
                        {(suggestion.localTips || suggestion.safetyNotes || suggestion.culturalNotes) && (
                          <div className="space-y-2">
                            <div className="font-medium text-sm">Quick Tips:</div>
                            <div className="space-y-1">
                              {suggestion.localTips?.slice(0, 1).map((tip: string, i: number) => (
                                <div key={i} className="text-xs flex items-start gap-2">
                                  <span className="text-blue-600 mt-1">💡</span>
                                  <span>{tip}</span>
                                </div>
                              ))}
                              {suggestion.safetyNotes?.slice(0, 1).map((note: string, i: number) => (
                                <div key={i} className="text-xs flex items-start gap-2">
                                  <span className="text-orange-600 mt-1">⚠️</span>
                                  <span>{note}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Map and Details Buttons */}
                        <div className="flex gap-2">
                          {suggestion.samplePlan?.accommodations?.[0]?.mapsUrl && (
                            <MapButton
                              url={suggestion.samplePlan.accommodations[0].mapsUrl}
                              title={`${suggestion.destination} Accommodation`}
                              variant="outline"
                              size="sm"
                            />
                          )}
                          <Button className="flex-1" variant="outline" size="sm">
                            View Full Details
                          </Button>
                  </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Overall Route Map for all Suggestions */}
            {suggestResult.suggestions && suggestResult.suggestions.length > 1 && (
              <div className="mt-8">
                <TripMap
                  destinations={suggestResult.suggestions.map((suggestion: any, index: number) => ({
                    name: suggestion.destination,
                    location: `${suggestion.state}, India`,
                    mapsUrl: suggestion.samplePlan?.accommodations?.[0]?.mapsUrl ||
                            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(suggestion.destination)}, ${suggestion.state}, India`,
                    day: index + 1,
                  }))}
                  title="Compare All Suggested Destinations"
                />
              </div>
            )}
          </div>
        )}
      </SignedIn>
    </div>
  );
}
