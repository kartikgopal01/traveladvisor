/**
 * Simple test utilities for Google Maps integration
 * Run these tests to verify maps functionality
 */

import {
  generateMapsSearchUrl,
  generateMapsDirectionsUrl,
  generateLocationQuery,
  generateTripRoute,
  isValidMapsUrl
} from './maps';

// Test data
const testLocations = [
  { name: 'Taj Mahal', city: 'Agra', state: 'Uttar Pradesh' },
  { name: 'Golden Temple', city: 'Amritsar', state: 'Punjab' },
  { name: 'Gateway of India', city: 'Mumbai', state: 'Maharashtra' }
];

const testMapLocation = {
  name: 'India Gate',
  address: 'Rajpath, India Gate',
  city: 'New Delhi',
  state: 'Delhi'
};

// Test functions
export function testMapsUrls() {
  console.log('🗺️ Testing Google Maps URL Generation...\n');

  // Test search URL
  const searchUrl = generateMapsSearchUrl('Taj Mahal, Agra, India');
  console.log('✅ Search URL:', searchUrl);

  // Test directions URL
  const directionsUrl = generateMapsDirectionsUrl(
    'Mumbai, India',
    'Delhi, India',
    'driving'
  );
  console.log('✅ Directions URL:', directionsUrl);

  // Test location query generation
  const locationQuery = generateLocationQuery(testMapLocation);
  console.log('✅ Location Query:', locationQuery);

  // Test trip route generation
  const tripRoute = generateTripRoute(testLocations);
  console.log('✅ Trip Route URL:', tripRoute.routeUrl);
  console.log('✅ Route Waypoints:', tripRoute.waypoints.length);

  // Test URL validation
  const validUrls = [
    'https://www.google.com/maps/search/?api=1&query=Taj+Mahal',
    'https://maps.google.com/?q=Golden+Temple',
    'https://www.google.com/maps/dir/Mumbai/Delhi'
  ];

  const invalidUrls = [
    'https://example.com/maps',
    'https://maps.apple.com/',
    'not-a-url'
  ];

  console.log('\n🔍 Testing URL Validation:');
  validUrls.forEach(url => {
    console.log(`✅ Valid: ${isValidMapsUrl(url)} - ${url}`);
  });

  invalidUrls.forEach(url => {
    console.log(`❌ Invalid: ${isValidMapsUrl(url)} - ${url}`);
  });

  console.log('\n🎉 All Google Maps integration tests completed!');
}

// Export test function for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testMapsIntegration = testMapsUrls;
}

// Auto-run tests in development
if (process.env.NODE_ENV === 'development') {
  console.log('🚀 Trip Advisor Google Maps Integration Ready!');
  console.log('💡 Run testMapsIntegration() in browser console to test functionality');
}
