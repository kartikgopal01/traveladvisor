// Export all map-related components and utilities
export { MapButton, MapLink } from './map-button';
export { TripMap, QuickMap } from './trip-map';
export { MapPreview, LocationPreview, MapGrid } from './map-preview';
export { DirectionsPanel, QuickDirections } from './directions-panel';
export { MapsIntegrationSummary, MapStats } from './maps-integration-summary';

// Re-export utility functions from lib/maps
export {
  generateMapsSearchUrl,
  generateMapsDirectionsUrl,
  generateMapsPlaceUrl,
  generateMapsCoordinatesUrl,
  generateMapsMultiStopRoute,
  generateStreetViewUrl,
  generateMapsEmbedUrl,
  generateLocationQuery,
  openInMaps,
  generateMyMapsUrl,
  generateMapsShareUrl,
  isValidMapsUrl,
  extractPlaceIdFromUrl,
  generateLocationMapsData,
  generateTripRoute,
  type MapLocation
} from '@/lib/maps';
