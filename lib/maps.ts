/**
 * Google Maps Integration Utilities
 * Handles URL generation, encoding, and map-related functionality
 */

export interface MapLocation {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Generate Google Maps search URL
 */
export function generateMapsSearchUrl(query: string): string {
  const encodedQuery = encodeURIComponent(query);
  return `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
}

/**
 * Generate Google Maps directions URL
 */
export function generateMapsDirectionsUrl(
  origin: string,
  destination: string,
  travelMode: 'driving' | 'walking' | 'transit' | 'bicycling' = 'driving'
): string {
  const encodedOrigin = encodeURIComponent(origin);
  const encodedDestination = encodeURIComponent(destination);
  return `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}&travelmode=${travelMode}`;
}

/**
 * Generate Google Maps place URL
 */
export function generateMapsPlaceUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
}

/**
 * Generate Google Maps coordinates URL
 */
export function generateMapsCoordinatesUrl(lat: number, lng: number, zoom: number = 15): string {
  return `https://www.google.com/maps/@${lat},${lng},${zoom}z`;
}

/**
 * Generate optimized route URL for multiple destinations
 */
export function generateMapsMultiStopRoute(
  waypoints: string[],
  origin?: string,
  destination?: string
): string {
  if (waypoints.length === 0) return '';

  const encodedWaypoints = waypoints.map(wp => encodeURIComponent(wp)).join('|');

  if (origin && destination) {
    const encodedOrigin = encodeURIComponent(origin);
    const encodedDestination = encodeURIComponent(destination);
    return `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}&waypoints=${encodedWaypoints}`;
  } else if (origin) {
    const encodedOrigin = encodeURIComponent(origin);
    return `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&waypoints=${encodedWaypoints}`;
  } else {
    return `https://www.google.com/maps/search/?api=1&query=${encodedWaypoints.split('|')[0]}`;
  }
}

/**
 * Generate street view URL
 */
export function generateStreetViewUrl(lat: number, lng: number, heading?: number): string {
  const baseUrl = `https://www.google.com/maps/@?api=1&map_action=pano&pano=`;
  const coords = `${lat},${lng}`;
  const headingParam = heading ? `&heading=${heading}` : '';
  return `${baseUrl}${coords}${headingParam}`;
}

/**
 * Generate Google Maps embed URL for iframe
 */
export function generateMapsEmbedUrl(query: string, zoom: number = 15): string {
  const encodedQuery = encodeURIComponent(query);
  return `https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${encodedQuery}&zoom=${zoom}`;
}

/**
 * Generate location-specific search query
 */
export function generateLocationQuery(location: MapLocation): string {
  const { name, address, city, state } = location;

  // Try different combinations for better search results
  if (address && city) {
    return `${name}, ${address}, ${city}`;
  } else if (city && state) {
    return `${name}, ${city}, ${state}, India`;
  } else if (city) {
    return `${name}, ${city}, India`;
  } else if (name) {
    return `${name}, India`;
  }

  return 'India';
}

/**
 * Open Google Maps in new tab
 */
export function openInMaps(url: string): void {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Generate Google My Maps URL for custom maps
 */
export function generateMyMapsUrl(mapId: string): string {
  return `https://www.google.com/maps/d/viewer?mid=${mapId}`;
}

/**
 * Generate Google Maps share URL
 */
export function generateMapsShareUrl(query: string): string {
  const encodedQuery = encodeURIComponent(query);
  return `https://maps.google.com/?q=${encodedQuery}`;
}

/**
 * Validate if a string is a valid Google Maps URL
 */
export function isValidMapsUrl(url: string): boolean {
  return url.startsWith('https://www.google.com/maps/') ||
         url.startsWith('https://maps.google.com/');
}

/**
 * Extract place ID from Google Maps URL if available
 */
export function extractPlaceIdFromUrl(url: string): string | null {
  const match = url.match(/place_id:([^&]+)/);
  return match ? match[1] : null;
}

/**
 * Generate comprehensive maps data for a location
 */
export function generateLocationMapsData(location: MapLocation) {
  const query = generateLocationQuery(location);

  return {
    searchUrl: generateMapsSearchUrl(query),
    shareUrl: generateMapsShareUrl(query),
    embedUrl: generateMapsEmbedUrl(query),
    hasCoordinates: !!(location.latitude && location.longitude),
    coordinatesUrl: location.latitude && location.longitude ?
      generateMapsCoordinatesUrl(location.latitude, location.longitude) : null,
    streetViewUrl: location.latitude && location.longitude ?
      generateStreetViewUrl(location.latitude, location.longitude) : null,
  };
}

/**
 * Generate trip route with all destinations
 */
export function generateTripRoute(destinations: MapLocation[]): {
  routeUrl: string;
  waypoints: string[];
  individualUrls: string[];
} {
  const waypoints = destinations.map(dest => generateLocationQuery(dest));
  const routeUrl = generateMapsMultiStopRoute(waypoints);
  const individualUrls = destinations.map(dest =>
    generateMapsSearchUrl(generateLocationQuery(dest))
  );

  return {
    routeUrl,
    waypoints,
    individualUrls,
  };
}
