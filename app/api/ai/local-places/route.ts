import { NextResponse } from "next/server";
import { getGenerativeModel } from "@/lib/gemini";
import { generateMapsSearchUrl } from "@/lib/maps";

// Simple in-memory cache for 5 minutes
const cache = new Map<string, { expiry: number; value: any }>();

function toCityFromText(text: string): string | null {
  const m = text.match(/City:\s*([^\n]+)/i) || text.match(/Nearest City:\s*([^\n]+)/i);
  return m ? m[1].trim() : null;
}

async function fetchExactPlaceImage(title: string, city?: string): Promise<string | null> {
  // Special case for Tyavarekoppa Lion Safari - use specific image
  if (title.toLowerCase().includes('tyavarekoppa') || 
      title.toLowerCase().includes('lion tiger safari') ||
      (title.toLowerCase().includes('lion') && title.toLowerCase().includes('safari') && city?.toLowerCase().includes('shivamogga'))) {
    return 'https://www.karnataka.com/wp-content/uploads/2015/07/tyavarekoppa-lion-and-tiger-reserve-shimoga-wiki.jpg';
  }

  // Special case for Sakrebyle Elephant Camp - use specific image
  if (title.toLowerCase().includes('sakrebyle') || 
      title.toLowerCase().includes('elephant camp') ||
      (title.toLowerCase().includes('elephant') && title.toLowerCase().includes('camp') && city?.toLowerCase().includes('shivamogga'))) {
    return 'https://rangataana.com/wp-content/uploads/2025/04/Sakrebyle-Elephant-Camp-What-You-Need-to-Know-Before-Visiting.png';
  }

  // Try Wikipedia with exact place name first
  try {
    const resp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(title)}`);
    const data = await resp.json();
    const pages = data?.query?.pages || {};
    const page = Object.values(pages)[0] as any;
    const img = page?.original?.source;
    if (typeof img === "string") {
      return img;
    }
  } catch {
    // Continue to other sources
  }

  // Try Wikipedia search for exact place with city context
  try {
    const searchQuery = city ? `${title} ${city} India` : `${title} India`;
    const searchResp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(searchQuery)}&srlimit=3`);
    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const results = searchData.query?.search || [];
      
      // Try each search result to find an image
      for (const result of results) {
        if (result?.title) {
          const imgResp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=original&titles=${encodeURIComponent(result.title)}`);
          if (imgResp.ok) {
            const imgData = await imgResp.json();
            const pages = imgData.query?.pages || {};
            const page = Object.values(pages)[0] as any;
            const img = page?.original?.source;
            if (typeof img === "string") {
              return img;
            }
          }
        }
      }
    }
  } catch {
    // Continue to other sources
  }

  // Try Wikimedia Commons with exact place search
  try {
    const searchQuery = city ? `${title} ${city}` : title;
    const commonsResp = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(searchQuery)}&srnamespace=6&srlimit=5`);
    if (commonsResp.ok) {
      const commonsData = await commonsResp.json();
      const results = commonsData.query?.search || [];
      
      // Try each result to find a good image
      for (const result of results) {
        if (result?.title) {
          const imageResp = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(result.title)}`);
          if (imageResp.ok) {
            const imageData = await imageResp.json();
            const pages = imageData.query?.pages || {};
            const page = Object.values(pages)[0] as any;
            const imageUrl = page?.imageinfo?.[0]?.url;
            if (imageUrl) {
              return imageUrl;
            }
          }
        }
      }
    }
  } catch {
    // Continue to other sources
  }

  // Try Pixabay API for exact place photos (free tier)
  try {
    const searchQuery = city ? `${title} ${city} India` : `${title} India`;
    const pixabayResp = await fetch(`https://pixabay.com/api/?key=9656065-a4094594c34c9b8b8e7c308c0&q=${encodeURIComponent(searchQuery)}&image_type=photo&orientation=horizontal&per_page=5&safesearch=true`);
    if (pixabayResp.ok) {
      const pixabayData = await pixabayResp.json();
      const photos = pixabayData.hits || [];
      if (photos.length > 0) {
        return photos[0].webformatURL;
      }
    }
  } catch {
    // Continue to other sources
  }

  // Try Unsplash API for high-quality photos
  try {
    const searchQuery = city ? `${title} ${city} India` : `${title} India`;
    const unsplashResp = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=3&orientation=landscape`, {
      headers: {
        'Authorization': 'Client-ID YOUR_UNSPLASH_ACCESS_KEY'
      }
    });
    if (unsplashResp.ok) {
      const unsplashData = await unsplashResp.json();
      const photos = unsplashData.results || [];
      if (photos.length > 0) {
        return photos[0].urls.regular;
      }
    }
  } catch {
    // Continue to other sources
  }

  // Try Flickr API for real photos of the place
  try {
    const searchQuery = city ? `${title} ${city} India` : `${title} India`;
    const flickrResp = await fetch(`https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=YOUR_FLICKR_KEY&text=${encodeURIComponent(searchQuery)}&format=json&nojsoncallback=1&per_page=5&sort=relevance&content_type=1`);
    if (flickrResp.ok) {
      const flickrData = await flickrResp.json();
      const photos = flickrData.photos?.photo || [];
      if (photos.length > 0) {
        const photo = photos[0];
        return `https://farm${photo.farm}.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`;
      }
    }
  } catch {
    // Continue to other sources
  }

  // Try Google Custom Search API for exact place images
  try {
    const searchQuery = city ? `${title} ${city} India` : `${title} India`;
    const googleResp = await fetch(`https://www.googleapis.com/customsearch/v1?key=YOUR_GOOGLE_API_KEY&cx=YOUR_SEARCH_ENGINE_ID&q=${encodeURIComponent(searchQuery)}&searchType=image&num=3&safe=medium`);
    if (googleResp.ok) {
      const googleData = await googleResp.json();
      const images = googleData.items || [];
      if (images.length > 0) {
        return images[0].link;
      }
    }
  } catch {
    // Continue to other sources
  }

  // Try Pexels API for free stock photos
  try {
    const searchQuery = city ? `${title} ${city} India` : `${title} India`;
    const pexelsResp = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=3&orientation=landscape`, {
      headers: {
        'Authorization': 'YOUR_PEXELS_API_KEY'
      }
    });
    if (pexelsResp.ok) {
      const pexelsData = await pexelsResp.json();
      const photos = pexelsData.photos || [];
      if (photos.length > 0) {
        return photos[0].src.medium;
      }
    }
  } catch {
    // Continue to other sources
  }

  // If no image found from any source, return null to show colored card
    return null;
}

function getDistrictSpecificPlaces(cityName: string | null): any[] {
  if (!cityName) return [];
  
  const cityLower = cityName.toLowerCase();
  
  // Major districts with predefined attractions
  const districtData: { [key: string]: any[] } = {
    // Karnataka - INDIA ONLY
    'shivamogga': [
      { title: "Lion Tiger Safari And Zoo", description: "Famous wildlife safari and zoo in Shivamogga district, India", wikipediaTitle: "Tyavarekoppa Lion Safari" },
      { title: "Jog Falls", description: "Famous waterfall in Shivamogga district, India", wikipediaTitle: "Jog Falls" },
      { title: "Sakrebylu Elephant Camp", description: "Elephant camp in Shivamogga district, India", wikipediaTitle: "Sakrebyle Elephant Camp" },
      { title: "Kodachadri", description: "Mountain peak in Shivamogga district, India", wikipediaTitle: "Kodachadri" },
      { title: "Agumbe", description: "Sunset point in Shivamogga district, India", wikipediaTitle: "Agumbe" },
      { title: "Bhadra Wildlife Sanctuary", description: "Famous wildlife sanctuary in Shivamogga district, India", wikipediaTitle: "Bhadra Wildlife Sanctuary" },
      { title: "Sharavathi Valley Wildlife Sanctuary", description: "Famous wildlife sanctuary in Shivamogga district, India", imageUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiCCX9GEQ18yfRmcybP0y7smJ73lESAydH7Nt8r3xu0GfpTZghnE8kqEkOOFulh9PDwNN2-evRs5u0eSlCCMPcs2zCMn1UaBPnFZjBqdVa4CizF8wO6eSqZad_OtmxBgXwe96tvWGzZtMKTpo3DNA1lUe8XaAMfNaLiL97V74_p30yFSEfJKqoQLHLaywDE/s1280/Sharavathi%20Valley%20Wildlife%20Sanctuary.jpg" },
      { title: "Kavaledurga Fort", description: "Historic fort in Shivamogga district, India", wikipediaTitle: "Kavaledurga Fort" },
      { title: "Puradalu Check Dam", description: "best sunset view point dam in Shivamogga district, India", imageUrl: "https://lh3.googleusercontent.com/gps-cs-s/AC9h4noZXEQtGhFhdWAnO3PFReBJN1Jr5BJuOXhPIuQT1GoPcMsn_WasfbxDirvR2Ju0ILCN5PBJW4I9tZLtOP2pPVakWyVD4Y8OGYHIDn35d8H2BEnluCYFpVNxBjku_ZA4bscUnqrh=w203-h152-k-no" },
      { title: "Kudli", description: "Famous temple town in Shivamogga district, India", wikipediaTitle: "Kudli" },
      { title: "Keladi", description: "Historic town in Shivamogga district, India", wikipediaTitle: "Keladi" },
      { title: "Ikkeri", description: "Famous temple in Shivamogga district, India", wikipediaTitle: "Ikkeri" },
      { title: "Sagara", description: "Famous town in Shivamogga district, India", wikipediaTitle: "Sagara" },
      { title: "Hosanagara", description: "Famous town in Shivamogga district, India", wikipediaTitle: "Hosanagara" },
      { title: "Sorab", description: "Famous town in Shivamogga district, India", wikipediaTitle: "Sorab" }
    ],
    'shimoga': [
      { title: "Lion Tiger Safari And Zoo", description: "Famous wildlife safari and zoo in Shivamogga district, India", wikipediaTitle: "Tyavarekoppa Lion Safari" },
      { title: "Jog Falls", description: "Famous waterfall in Shivamogga district, India", wikipediaTitle: "Jog Falls" },
      { title: "Sakrebylu Elephant Camp", description: "Elephant camp in Shivamogga district, India", wikipediaTitle: "Sakrebyle Elephant Camp" },
      { title: "Kodachadri", description: "Mountain peak in Shivamogga district, India", wikipediaTitle: "Kodachadri" },
      { title: "Agumbe", description: "Sunset point in Shivamogga district, India", wikipediaTitle: "Agumbe" },
      { title: "Bhadra Wildlife Sanctuary", description: "Famous wildlife sanctuary in Shivamogga district, India", wikipediaTitle: "Bhadra Wildlife Sanctuary" },
      { title: "Sharavathi Valley Wildlife Sanctuary", description: "Famous wildlife sanctuary in Shivamogga district, India", wikipediaTitle: "Sharavathi Valley Wildlife Sanctuary", imageUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiCCX9GEQ18yfRmcybP0y7smJ73lESAydH7Nt8r3xu0GfpTZghnE8kqEkOOFulh9PDwNN2-evRs5u0eSlCCMPcs2zCMn1UaBPnFZjBqdVa4CizF8wO6eSqZad_OtmxBgXwe96tvWGzZtMKTpo3DNA1lUe8XaAMfNaLiL97V74_p30yFSEfJKqoQLHLaywDE/s1280/Sharavathi%20Valley%20Wildlife%20Sanctuary.jpg" },
      { title: "Kavaledurga Fort", description: "Historic fort in Shivamogga district, India", wikipediaTitle: "Kavaledurga Fort" },
      { title: "Tyavarekoppa Dam", description: "Famous dam in Shivamogga district, India", wikipediaTitle: "Tyavarekoppa Dam" },
      { title: "Kudli", description: "Famous temple town in Shivamogga district, India", wikipediaTitle: "Kudli" },
      { title: "Keladi", description: "Historic town in Shivamogga district, India", wikipediaTitle: "Keladi" },
      { title: "Ikkeri", description: "Famous temple in Shivamogga district, India", wikipediaTitle: "Ikkeri" },
      { title: "Sagara", description: "Famous town in Shivamogga district, India", wikipediaTitle: "Sagara" },
      { title: "Hosanagara", description: "Famous town in Shivamogga district, India", wikipediaTitle: "Hosanagara" },
      { title: "Sorab", description: "Famous town in Shivamogga district, India", wikipediaTitle: "Sorab" }
    ],
    'mysore': [
      { title: "Mysore Palace", description: "Famous royal palace in Mysore district, India", wikipediaTitle: "Mysore Palace" },
      { title: "Chamundi Hills", description: "Sacred hill in Mysore district, India", wikipediaTitle: "Chamundi Hills" },
      { title: "Brindavan Gardens", description: "Beautiful gardens in Mysore district, India", wikipediaTitle: "Brindavan Gardens" },
      { title: "St. Philomena's Cathedral", description: "Historic cathedral in Mysore district, India", wikipediaTitle: "St. Philomena's Cathedral" },
      { title: "Mysore Zoo", description: "Famous zoo in Mysore district, India", wikipediaTitle: "Mysore Zoo" },
      { title: "Somnathpur Temple", description: "Famous temple in Mysore district, India", wikipediaTitle: "Somnathpur Temple" },
      { title: "Srirangapatna", description: "Historic town in Mysore district, India", wikipediaTitle: "Srirangapatna" },
      { title: "Ranganathittu Bird Sanctuary", description: "Famous bird sanctuary in Mysore district, India", wikipediaTitle: "Ranganathittu Bird Sanctuary" },
      { title: "Karanji Lake", description: "Famous lake in Mysore district, India", wikipediaTitle: "Karanji Lake" },
      { title: "Jaganmohan Palace", description: "Historic palace in Mysore district, India", wikipediaTitle: "Jaganmohan Palace" },
      { title: "Railway Museum", description: "Famous museum in Mysore district, India", wikipediaTitle: "Railway Museum Mysore" },
      { title: "Melkote", description: "Famous temple town in Mysore district, India", wikipediaTitle: "Melkote" },
      { title: "Talakad", description: "Historic town in Mysore district, India", wikipediaTitle: "Talakad" },
      { title: "Nanjangud", description: "Famous temple town in Mysore district, India", wikipediaTitle: "Nanjangud" },
      { title: "Bandipur National Park", description: "Famous national park in Mysore district, India", wikipediaTitle: "Bandipur National Park" }
    ],
    'mysuru': [
      { title: "Mysore Palace", description: "Famous royal palace in Mysore district, India", wikipediaTitle: "Mysore Palace" },
      { title: "Chamundi Hills", description: "Sacred hill in Mysore district, India", wikipediaTitle: "Chamundi Hills" },
      { title: "Brindavan Gardens", description: "Beautiful gardens in Mysore district, India", wikipediaTitle: "Brindavan Gardens" },
      { title: "St. Philomena's Cathedral", description: "Historic cathedral in Mysore district, India", wikipediaTitle: "St. Philomena's Cathedral" },
      { title: "Mysore Zoo", description: "Famous zoo in Mysore district, India", wikipediaTitle: "Mysore Zoo" },
      { title: "Somnathpur Temple", description: "Famous temple in Mysore district, India", wikipediaTitle: "Somnathpur Temple" },
      { title: "Srirangapatna", description: "Historic town in Mysore district, India", wikipediaTitle: "Srirangapatna" },
      { title: "Ranganathittu Bird Sanctuary", description: "Famous bird sanctuary in Mysore district, India", wikipediaTitle: "Ranganathittu Bird Sanctuary" },
      { title: "Karanji Lake", description: "Famous lake in Mysore district, India", wikipediaTitle: "Karanji Lake" },
      { title: "Jaganmohan Palace", description: "Historic palace in Mysore district, India", wikipediaTitle: "Jaganmohan Palace" },
      { title: "Railway Museum", description: "Famous museum in Mysore district, India", wikipediaTitle: "Railway Museum Mysore" },
      { title: "Melkote", description: "Famous temple town in Mysore district, India", wikipediaTitle: "Melkote" },
      { title: "Talakad", description: "Historic town in Mysore district, India", wikipediaTitle: "Talakad" },
      { title: "Nanjangud", description: "Famous temple town in Mysore district, India", wikipediaTitle: "Nanjangud" },
      { title: "Bandipur National Park", description: "Famous national park in Mysore district, India", wikipediaTitle: "Bandipur National Park" }
    ],
    'bangalore': [
      { title: "Lalbagh Botanical Garden", description: "Famous botanical garden in Bangalore, India", wikipediaTitle: "Lalbagh Botanical Garden" },
      { title: "Cubbon Park", description: "Historic park in Bangalore, India", wikipediaTitle: "Cubbon Park" },
      { title: "Vidhana Soudha", description: "State legislature building in Bangalore, India", wikipediaTitle: "Vidhana Soudha" },
      { title: "Bangalore Palace", description: "Royal palace in Bangalore, India", wikipediaTitle: "Bangalore Palace" },
      { title: "ISKCON Temple", description: "Famous temple in Bangalore, India", wikipediaTitle: "ISKCON Temple Bangalore" },
      { title: "Tipu Sultan's Summer Palace", description: "Historic palace in Bangalore, India", wikipediaTitle: "Tipu Sultan's Summer Palace" },
      { title: "Ulsoor Lake", description: "Famous lake in Bangalore, India", wikipediaTitle: "Ulsoor Lake" },
      { title: "Nandi Hills", description: "Famous hill station in Bangalore, India", wikipediaTitle: "Nandi Hills" },
      { title: "Wonderla", description: "Famous amusement park in Bangalore, India", wikipediaTitle: "Wonderla Bangalore" },
      { title: "Innovation Film City", description: "Famous theme park in Bangalore, India", wikipediaTitle: "Innovation Film City" },
      { title: "Bannerghatta National Park", description: "Famous national park in Bangalore, India", wikipediaTitle: "Bannerghatta National Park" },
      { title: "Hebbal Lake", description: "Famous lake in Bangalore, India", wikipediaTitle: "Hebbal Lake" },
      { title: "Sankey Tank", description: "Famous lake in Bangalore, India", wikipediaTitle: "Sankey Tank" },
      { title: "Kempegowda Tower", description: "Famous tower in Bangalore, India", wikipediaTitle: "Kempegowda Tower" },
      { title: "Chunchi Falls", description: "Famous waterfall in Bangalore, India", wikipediaTitle: "Chunchi Falls" }
    ],
    'bengaluru': [
      { title: "Lalbagh Botanical Garden", description: "Famous botanical garden in Bangalore, India", wikipediaTitle: "Lalbagh Botanical Garden" },
      { title: "Cubbon Park", description: "Historic park in Bangalore, India", wikipediaTitle: "Cubbon Park" },
      { title: "Vidhana Soudha", description: "State legislature building in Bangalore, India", wikipediaTitle: "Vidhana Soudha" },
      { title: "Bangalore Palace", description: "Royal palace in Bangalore, India", wikipediaTitle: "Bangalore Palace" },
      { title: "ISKCON Temple", description: "Famous temple in Bangalore, India", wikipediaTitle: "ISKCON Temple Bangalore" },
      { title: "Tipu Sultan's Summer Palace", description: "Historic palace in Bangalore, India", wikipediaTitle: "Tipu Sultan's Summer Palace" },
      { title: "Ulsoor Lake", description: "Famous lake in Bangalore, India", wikipediaTitle: "Ulsoor Lake" },
      { title: "Nandi Hills", description: "Famous hill station in Bangalore, India", wikipediaTitle: "Nandi Hills" },
      { title: "Wonderla", description: "Famous amusement park in Bangalore, India", wikipediaTitle: "Wonderla Bangalore" },
      { title: "Innovation Film City", description: "Famous theme park in Bangalore, India", wikipediaTitle: "Innovation Film City" },
      { title: "Bannerghatta National Park", description: "Famous national park in Bangalore, India", wikipediaTitle: "Bannerghatta National Park" },
      { title: "Hebbal Lake", description: "Famous lake in Bangalore, India", wikipediaTitle: "Hebbal Lake" },
      { title: "Sankey Tank", description: "Famous lake in Bangalore, India", wikipediaTitle: "Sankey Tank" },
      { title: "Kempegowda Tower", description: "Famous tower in Bangalore, India", wikipediaTitle: "Kempegowda Tower" },
      { title: "Chunchi Falls", description: "Famous waterfall in Bangalore, India", wikipediaTitle: "Chunchi Falls" }
    ],
    // Delhi - INDIA ONLY
    'delhi': [
      { title: "Red Fort", description: "Historic fort in Delhi, India", wikipediaTitle: "Red Fort" },
      { title: "India Gate", description: "War memorial in Delhi, India", wikipediaTitle: "India Gate" },
      { title: "Qutub Minar", description: "Historic minaret in Delhi, India", wikipediaTitle: "Qutub Minar" },
      { title: "Lotus Temple", description: "Bahá'í temple in Delhi, India", wikipediaTitle: "Lotus Temple" },
      { title: "Humayun's Tomb", description: "Mughal tomb in Delhi, India", wikipediaTitle: "Humayun's Tomb" },
      { title: "Jama Masjid", description: "Famous mosque in Delhi, India", wikipediaTitle: "Jama Masjid Delhi" },
      { title: "Akshardham Temple", description: "Famous temple in Delhi, India", wikipediaTitle: "Akshardham Temple Delhi" },
      { title: "Chandni Chowk", description: "Famous market in Delhi, India", wikipediaTitle: "Chandni Chowk" },
      { title: "Connaught Place", description: "Famous commercial area in Delhi, India", wikipediaTitle: "Connaught Place" },
      { title: "Rashtrapati Bhavan", description: "Presidential residence in Delhi, India", wikipediaTitle: "Rashtrapati Bhavan" },
      { title: "Safdarjung Tomb", description: "Historic tomb in Delhi, India", wikipediaTitle: "Safdarjung Tomb" },
      { title: "Lodi Gardens", description: "Famous garden in Delhi, India", wikipediaTitle: "Lodi Gardens" },
      { title: "Purana Qila", description: "Historic fort in Delhi, India", wikipediaTitle: "Purana Qila" },
      { title: "Raj Ghat", description: "Memorial in Delhi, India", wikipediaTitle: "Raj Ghat" },
      { title: "National Museum", description: "Famous museum in Delhi, India", wikipediaTitle: "National Museum Delhi" }
    ],
    'new delhi': [
      { title: "Red Fort", description: "Historic fort in Delhi, India", wikipediaTitle: "Red Fort" },
      { title: "India Gate", description: "War memorial in Delhi, India", wikipediaTitle: "India Gate" },
      { title: "Qutub Minar", description: "Historic minaret in Delhi, India", wikipediaTitle: "Qutub Minar" },
      { title: "Lotus Temple", description: "Bahá'í temple in Delhi, India", wikipediaTitle: "Lotus Temple" },
      { title: "Humayun's Tomb", description: "Mughal tomb in Delhi, India", wikipediaTitle: "Humayun's Tomb" },
      { title: "Jama Masjid", description: "Famous mosque in Delhi, India", wikipediaTitle: "Jama Masjid Delhi" },
      { title: "Akshardham Temple", description: "Famous temple in Delhi, India", wikipediaTitle: "Akshardham Temple Delhi" },
      { title: "Chandni Chowk", description: "Famous market in Delhi, India", wikipediaTitle: "Chandni Chowk" },
      { title: "Connaught Place", description: "Famous commercial area in Delhi, India", wikipediaTitle: "Connaught Place" },
      { title: "Rashtrapati Bhavan", description: "Presidential residence in Delhi, India", wikipediaTitle: "Rashtrapati Bhavan" },
      { title: "Safdarjung Tomb", description: "Historic tomb in Delhi, India", wikipediaTitle: "Safdarjung Tomb" },
      { title: "Lodi Gardens", description: "Famous garden in Delhi, India", wikipediaTitle: "Lodi Gardens" },
      { title: "Purana Qila", description: "Historic fort in Delhi, India", wikipediaTitle: "Purana Qila" },
      { title: "Raj Ghat", description: "Memorial in Delhi, India", wikipediaTitle: "Raj Ghat" },
      { title: "National Museum", description: "Famous museum in Delhi, India", wikipediaTitle: "National Museum Delhi" }
    ],
    // Mumbai - INDIA ONLY
    'mumbai': [
      { title: "Gateway of India", description: "Historic monument in Mumbai, India", wikipediaTitle: "Gateway of India" },
      { title: "Marine Drive", description: "Famous promenade in Mumbai, India", wikipediaTitle: "Marine Drive Mumbai" },
      { title: "Elephanta Caves", description: "Ancient caves in Mumbai, India", wikipediaTitle: "Elephanta Caves" },
      { title: "Siddhivinayak Temple", description: "Famous temple in Mumbai, India", wikipediaTitle: "Siddhivinayak Temple" },
      { title: "Juhu Beach", description: "Popular beach in Mumbai, India", wikipediaTitle: "Juhu Beach" },
      { title: "Chhatrapati Shivaji Terminus", description: "Historic railway station in Mumbai, India", wikipediaTitle: "Chhatrapati Shivaji Terminus" },
      { title: "Haji Ali Dargah", description: "Famous mosque in Mumbai, India", wikipediaTitle: "Haji Ali Dargah" },
      { title: "Sanjay Gandhi National Park", description: "Famous national park in Mumbai, India", wikipediaTitle: "Sanjay Gandhi National Park" },
      { title: "Worli Sea Face", description: "Famous promenade in Mumbai, India", wikipediaTitle: "Worli Sea Face" },
      { title: "Bandra-Worli Sea Link", description: "Famous bridge in Mumbai, India", wikipediaTitle: "Bandra-Worli Sea Link" },
      { title: "Crawford Market", description: "Famous market in Mumbai, India", wikipediaTitle: "Crawford Market" },
      { title: "Chor Bazaar", description: "Famous market in Mumbai, India", wikipediaTitle: "Chor Bazaar" },
      { title: "Powai Lake", description: "Famous lake in Mumbai, India", wikipediaTitle: "Powai Lake" },
      { title: "Film City", description: "Famous film studio in Mumbai, India", wikipediaTitle: "Film City Mumbai" },
      { title: "Versova Beach", description: "Famous beach in Mumbai, India", wikipediaTitle: "Versova Beach" }
    ],
    // Agra - INDIA ONLY
    'agra': [
      { title: "Taj Mahal", description: "World famous monument in Agra, India", wikipediaTitle: "Taj Mahal" },
      { title: "Agra Fort", description: "Historic fort in Agra, India", wikipediaTitle: "Agra Fort" },
      { title: "Fatehpur Sikri", description: "Historic city near Agra, India", wikipediaTitle: "Fatehpur Sikri" },
      { title: "Itmad-ud-Daulah", description: "Historic tomb in Agra, India", wikipediaTitle: "Itmad-ud-Daulah" },
      { title: "Mehtab Bagh", description: "Garden in Agra, India", wikipediaTitle: "Mehtab Bagh" },
      { title: "Akbar's Tomb", description: "Historic tomb in Agra, India", wikipediaTitle: "Akbar's Tomb" },
      { title: "Jama Masjid", description: "Famous mosque in Agra, India", wikipediaTitle: "Jama Masjid Agra" },
      { title: "Chini Ka Rauza", description: "Historic tomb in Agra, India", wikipediaTitle: "Chini Ka Rauza" },
      { title: "Mariam's Tomb", description: "Historic tomb in Agra, India", wikipediaTitle: "Mariam's Tomb" },
      { title: "Ram Bagh", description: "Famous garden in Agra, India", wikipediaTitle: "Ram Bagh" },
      { title: "Keetham Lake", description: "Famous lake in Agra, India", wikipediaTitle: "Keetham Lake" },
      { title: "Sikandra", description: "Historic area in Agra, India", wikipediaTitle: "Sikandra" },
      { title: "Soami Bagh", description: "Famous temple in Agra, India", wikipediaTitle: "Soami Bagh" },
      { title: "Guru ka Tal", description: "Famous lake in Agra, India", wikipediaTitle: "Guru ka Tal" },
      { title: "Mankameshwar Temple", description: "Famous temple in Agra, India", wikipediaTitle: "Mankameshwar Temple" }
    ],
    // Jaipur - INDIA ONLY
    'jaipur': [
      { title: "Amber Fort", description: "Historic fort in Jaipur, India", wikipediaTitle: "Amber Fort" },
      { title: "City Palace", description: "Royal palace in Jaipur, India", wikipediaTitle: "City Palace Jaipur" },
      { title: "Hawa Mahal", description: "Palace of Winds in Jaipur, India", wikipediaTitle: "Hawa Mahal" },
      { title: "Jantar Mantar", description: "Astronomical observatory in Jaipur, India", wikipediaTitle: "Jantar Mantar Jaipur" },
      { title: "Nahargarh Fort", description: "Historic fort in Jaipur, India", wikipediaTitle: "Nahargarh Fort" },
      { title: "Jaigarh Fort", description: "Historic fort in Jaipur, India", wikipediaTitle: "Jaigarh Fort" },
      { title: "Albert Hall Museum", description: "Famous museum in Jaipur, India", wikipediaTitle: "Albert Hall Museum" },
      { title: "Birla Mandir", description: "Famous temple in Jaipur, India", wikipediaTitle: "Birla Mandir Jaipur" },
      { title: "Galtaji Temple", description: "Famous temple in Jaipur, India", wikipediaTitle: "Galtaji Temple" },
      { title: "Sisodia Rani Garden", description: "Famous garden in Jaipur, India", wikipediaTitle: "Sisodia Rani Garden" },
      { title: "Central Park", description: "Famous park in Jaipur, India", wikipediaTitle: "Central Park Jaipur" },
      { title: "Jal Mahal", description: "Famous palace in Jaipur, India", wikipediaTitle: "Jal Mahal" },
      { title: "Chokhi Dhani", description: "Famous cultural village in Jaipur, India", wikipediaTitle: "Chokhi Dhani" },
      { title: "Raj Mandir Cinema", description: "Famous cinema hall in Jaipur, India", wikipediaTitle: "Raj Mandir Cinema" },
      { title: "Pink City", description: "Famous area in Jaipur, India", wikipediaTitle: "Pink City Jaipur" }
    ],
    // Chennai - INDIA ONLY
    'chennai': [
      { title: "Marina Beach", description: "Famous beach in Chennai, India", wikipediaTitle: "Marina Beach" },
      { title: "Kapaleeshwarar Temple", description: "Famous temple in Chennai, India", wikipediaTitle: "Kapaleeshwarar Temple" },
      { title: "Fort St. George", description: "Historic fort in Chennai, India", wikipediaTitle: "Fort St. George" },
      { title: "San Thome Basilica", description: "Historic church in Chennai, India", wikipediaTitle: "San Thome Basilica" },
      { title: "Valluvar Kottam", description: "Memorial in Chennai, India", wikipediaTitle: "Valluvar Kottam" },
      { title: "Guindy National Park", description: "Famous national park in Chennai, India", wikipediaTitle: "Guindy National Park" },
      { title: "Birla Planetarium", description: "Famous planetarium in Chennai, India", wikipediaTitle: "Birla Planetarium Chennai" },
      { title: "Anna Centenary Library", description: "Famous library in Chennai, India", wikipediaTitle: "Anna Centenary Library" },
      { title: "Connemara Public Library", description: "Famous library in Chennai, India", wikipediaTitle: "Connemara Public Library" },
      { title: "Government Museum", description: "Famous museum in Chennai, India", wikipediaTitle: "Government Museum Chennai" },
      { title: "Semmozhi Poonga", description: "Famous garden in Chennai, India", wikipediaTitle: "Semmozhi Poonga" },
      { title: "Thousand Lights Mosque", description: "Famous mosque in Chennai, India", wikipediaTitle: "Thousand Lights Mosque" },
      { title: "MGR Memorial", description: "Famous memorial in Chennai, India", wikipediaTitle: "MGR Memorial" },
      { title: "Elliots Beach", description: "Famous beach in Chennai, India", wikipediaTitle: "Elliots Beach" },
      { title: "Crocodile Bank", description: "Famous crocodile sanctuary in Chennai, India", wikipediaTitle: "Crocodile Bank" }
    ],
    // Kolkata - INDIA ONLY
    'kolkata': [
      { title: "Victoria Memorial", description: "Historic monument in Kolkata, India", wikipediaTitle: "Victoria Memorial" },
      { title: "Howrah Bridge", description: "Famous bridge in Kolkata, India", wikipediaTitle: "Howrah Bridge" },
      { title: "Dakshineswar Kali Temple", description: "Famous temple in Kolkata, India", wikipediaTitle: "Dakshineswar Kali Temple" },
      { title: "Indian Museum", description: "Famous museum in Kolkata, India", wikipediaTitle: "Indian Museum" },
      { title: "Eden Gardens", description: "Famous cricket stadium in Kolkata, India", wikipediaTitle: "Eden Gardens" },
      { title: "Belur Math", description: "Famous temple in Kolkata, India", wikipediaTitle: "Belur Math" },
      { title: "Kalighat Temple", description: "Famous temple in Kolkata, India", wikipediaTitle: "Kalighat Temple" },
      { title: "Marble Palace", description: "Historic palace in Kolkata, India", wikipediaTitle: "Marble Palace Kolkata" },
      { title: "Science City", description: "Famous science center in Kolkata, India", wikipediaTitle: "Science City Kolkata" },
      { title: "Rabindra Sarobar", description: "Famous lake in Kolkata, India", wikipediaTitle: "Rabindra Sarobar" },
      { title: "Park Street", description: "Famous street in Kolkata, India", wikipediaTitle: "Park Street Kolkata" },
      { title: "New Market", description: "Famous market in Kolkata, India", wikipediaTitle: "New Market Kolkata" },
      { title: "St. Paul's Cathedral", description: "Historic church in Kolkata, India", wikipediaTitle: "St. Paul's Cathedral Kolkata" },
      { title: "Princep Ghat", description: "Famous ghat in Kolkata, India", wikipediaTitle: "Princep Ghat" },
      { title: "Nicco Park", description: "Famous amusement park in Kolkata, India", wikipediaTitle: "Nicco Park" }
    ],
    // Hyderabad - INDIA ONLY
    'hyderabad': [
      { title: "Charminar", description: "Historic monument in Hyderabad, India", wikipediaTitle: "Charminar" },
      { title: "Golconda Fort", description: "Historic fort in Hyderabad, India", wikipediaTitle: "Golconda Fort" },
      { title: "Hussain Sagar Lake", description: "Famous lake in Hyderabad, India", wikipediaTitle: "Hussain Sagar Lake" },
      { title: "Salar Jung Museum", description: "Famous museum in Hyderabad, India", wikipediaTitle: "Salar Jung Museum" },
      { title: "Ramoji Film City", description: "Famous film studio in Hyderabad, India", wikipediaTitle: "Ramoji Film City" },
      { title: "Qutub Shahi Tombs", description: "Historic tombs in Hyderabad, India", wikipediaTitle: "Qutub Shahi Tombs" },
      { title: "Mecca Masjid", description: "Famous mosque in Hyderabad, India", wikipediaTitle: "Mecca Masjid" },
      { title: "Birla Mandir", description: "Famous temple in Hyderabad, India", wikipediaTitle: "Birla Mandir Hyderabad" },
      { title: "Nehru Zoological Park", description: "Famous zoo in Hyderabad, India", wikipediaTitle: "Nehru Zoological Park" },
      { title: "Lumbini Park", description: "Famous park in Hyderabad, India", wikipediaTitle: "Lumbini Park" },
      { title: "Snow World", description: "Famous theme park in Hyderabad, India", wikipediaTitle: "Snow World Hyderabad" },
      { title: "Chowmahalla Palace", description: "Historic palace in Hyderabad, India", wikipediaTitle: "Chowmahalla Palace" },
      { title: "Falaknuma Palace", description: "Historic palace in Hyderabad, India", wikipediaTitle: "Falaknuma Palace" },
      { title: "Osmania University", description: "Famous university in Hyderabad, India", wikipediaTitle: "Osmania University" },
      { title: "Shilparamam", description: "Famous crafts village in Hyderabad, India", wikipediaTitle: "Shilparamam" }
    ],
    // Pune - INDIA ONLY
    'pune': [
      { title: "Shaniwar Wada", description: "Historic palace in Pune, India", wikipediaTitle: "Shaniwar Wada" },
      { title: "Aga Khan Palace", description: "Historic palace in Pune, India", wikipediaTitle: "Aga Khan Palace" },
      { title: "Sinhagad Fort", description: "Historic fort in Pune, India", wikipediaTitle: "Sinhagad Fort" },
      { title: "Dagdusheth Halwai Ganpati Temple", description: "Famous temple in Pune, India", wikipediaTitle: "Dagdusheth Halwai Ganpati Temple" },
      { title: "Khadakwasla Dam", description: "Famous dam in Pune, India", wikipediaTitle: "Khadakwasla Dam" },
      { title: "Osho Ashram", description: "Famous ashram in Pune, India", wikipediaTitle: "Osho Ashram" },
      { title: "Pataleshwar Cave Temple", description: "Famous temple in Pune, India", wikipediaTitle: "Pataleshwar Cave Temple" },
      { title: "Raja Dinkar Kelkar Museum", description: "Famous museum in Pune, India", wikipediaTitle: "Raja Dinkar Kelkar Museum" },
      { title: "Mulshi Dam", description: "Famous dam in Pune, India", wikipediaTitle: "Mulshi Dam" },
      { title: "Katraj Snake Park", description: "Famous snake park in Pune, India", wikipediaTitle: "Katraj Snake Park" },
      { title: "Lal Mahal", description: "Historic palace in Pune, India", wikipediaTitle: "Lal Mahal" },
      { title: "Parvati Hill", description: "Famous hill in Pune, India", wikipediaTitle: "Parvati Hill" },
      { title: "Shinde Chhatri", description: "Historic memorial in Pune, India", wikipediaTitle: "Shinde Chhatri" },
      { title: "Bund Garden", description: "Famous garden in Pune, India", wikipediaTitle: "Bund Garden" },
      { title: "Empress Garden", description: "Famous garden in Pune, India", wikipediaTitle: "Empress Garden" }
    ],
    // Ahmedabad - INDIA ONLY
    'ahmedabad': [
      { title: "Sabarmati Ashram", description: "Historic ashram in Ahmedabad, India", wikipediaTitle: "Sabarmati Ashram" },
      { title: "Jama Masjid", description: "Historic mosque in Ahmedabad, India", wikipediaTitle: "Jama Masjid Ahmedabad" },
      { title: "Adalaj Stepwell", description: "Historic stepwell in Ahmedabad, India", wikipediaTitle: "Adalaj Stepwell" },
      { title: "Kankaria Lake", description: "Famous lake in Ahmedabad, India", wikipediaTitle: "Kankaria Lake" },
      { title: "Sidi Saiyyed Mosque", description: "Famous mosque in Ahmedabad, India", wikipediaTitle: "Sidi Saiyyed Mosque" },
      { title: "Calico Museum", description: "Famous museum in Ahmedabad, India", wikipediaTitle: "Calico Museum" },
      { title: "Science City", description: "Famous science center in Ahmedabad, India", wikipediaTitle: "Science City Ahmedabad" },
      { title: "Auto World Vintage Car Museum", description: "Famous museum in Ahmedabad, India", wikipediaTitle: "Auto World Vintage Car Museum" },
      { title: "Hutheesing Jain Temple", description: "Famous temple in Ahmedabad, India", wikipediaTitle: "Hutheesing Jain Temple" },
      { title: "Bhadra Fort", description: "Historic fort in Ahmedabad, India", wikipediaTitle: "Bhadra Fort" },
      { title: "Rani Rupmati Mosque", description: "Famous mosque in Ahmedabad, India", wikipediaTitle: "Rani Rupmati Mosque" },
      { title: "Vastrapur Lake", description: "Famous lake in Ahmedabad, India", wikipediaTitle: "Vastrapur Lake" },
      { title: "Law Garden", description: "Famous garden in Ahmedabad, India", wikipediaTitle: "Law Garden" },
      { title: "Thol Lake", description: "Famous lake in Ahmedabad, India", wikipediaTitle: "Thol Lake" },
      { title: "Nal Sarovar", description: "Famous lake in Ahmedabad, India", wikipediaTitle: "Nal Sarovar" }
    ],
    // Surat - INDIA ONLY
    'surat': [
      { title: "Surat Castle", description: "Historic castle in Surat, India", wikipediaTitle: "Surat Castle" },
      { title: "Dumas Beach", description: "Famous beach in Surat, India", wikipediaTitle: "Dumas Beach" },
      { title: "Sardar Patel Museum", description: "Famous museum in Surat, India", wikipediaTitle: "Sardar Patel Museum" },
      { title: "Gopi Talav", description: "Famous lake in Surat, India", wikipediaTitle: "Gopi Talav" },
      { title: "Dutch Garden", description: "Historic garden in Surat, India", wikipediaTitle: "Dutch Garden Surat" },
      { title: "Sarthana Nature Park", description: "Famous nature park in Surat, India", wikipediaTitle: "Sarthana Nature Park" },
      { title: "Ambika Niketan Temple", description: "Famous temple in Surat, India", wikipediaTitle: "Ambika Niketan Temple" },
      { title: "Chintamani Jain Temple", description: "Famous temple in Surat, India", wikipediaTitle: "Chintamani Jain Temple" },
      { title: "Iskcon Temple", description: "Famous temple in Surat, India", wikipediaTitle: "Iskcon Temple Surat" },
      { title: "Sardar Patel Zoological Park", description: "Famous zoo in Surat, India", wikipediaTitle: "Sardar Patel Zoological Park" },
      { title: "Tapi Riverfront", description: "Famous riverfront in Surat, India", wikipediaTitle: "Tapi Riverfront" },
      { title: "Diamond Market", description: "Famous market in Surat, India", wikipediaTitle: "Diamond Market Surat" },
      { title: "Textile Market", description: "Famous market in Surat, India", wikipediaTitle: "Textile Market Surat" },
      { title: "Surat Science Centre", description: "Famous science center in Surat, India", wikipediaTitle: "Surat Science Centre" },
      { title: "Gopi Talav Garden", description: "Famous garden in Surat, India", wikipediaTitle: "Gopi Talav Garden" }
    ],
    // Lucknow - INDIA ONLY
    'lucknow': [
      { title: "Bara Imambara", description: "Historic monument in Lucknow, India", wikipediaTitle: "Bara Imambara" },
      { title: "Chota Imambara", description: "Historic monument in Lucknow, India", wikipediaTitle: "Chota Imambara" },
      { title: "Rumi Darwaza", description: "Historic gateway in Lucknow, India", wikipediaTitle: "Rumi Darwaza" },
      { title: "Hazratganj", description: "Famous market in Lucknow, India", wikipediaTitle: "Hazratganj" },
      { title: "Ambedkar Memorial Park", description: "Famous park in Lucknow, India", wikipediaTitle: "Ambedkar Memorial Park" },
      { title: "Lucknow Zoo", description: "Famous zoo in Lucknow, India", wikipediaTitle: "Lucknow Zoo" },
      { title: "State Museum", description: "Famous museum in Lucknow, India", wikipediaTitle: "State Museum Lucknow" },
      { title: "Clock Tower", description: "Famous tower in Lucknow, India", wikipediaTitle: "Clock Tower Lucknow" },
      { title: "Residency", description: "Historic building in Lucknow, India", wikipediaTitle: "Residency Lucknow" },
      { title: "Janeshwar Mishra Park", description: "Famous park in Lucknow, India", wikipediaTitle: "Janeshwar Mishra Park" },
      { title: "Indira Gandhi Planetarium", description: "Famous planetarium in Lucknow, India", wikipediaTitle: "Indira Gandhi Planetarium" },
      { title: "Gomti Riverfront", description: "Famous riverfront in Lucknow, India", wikipediaTitle: "Gomti Riverfront" },
      { title: "Chandrika Devi Temple", description: "Famous temple in Lucknow, India", wikipediaTitle: "Chandrika Devi Temple" },
      { title: "Hanuman Setu Temple", description: "Famous temple in Lucknow, India", wikipediaTitle: "Hanuman Setu Temple" },
      { title: "Amrapali Water Park", description: "Famous water park in Lucknow, India", wikipediaTitle: "Amrapali Water Park" }
    ],
    // Kanpur - INDIA ONLY
    'kanpur': [
      { title: "JK Temple", description: "Famous temple in Kanpur, India", wikipediaTitle: "JK Temple" },
      { title: "Allen Forest Zoo", description: "Famous zoo in Kanpur, India", wikipediaTitle: "Allen Forest Zoo" },
      { title: "Kanpur Memorial Church", description: "Historic church in Kanpur, India", wikipediaTitle: "Kanpur Memorial Church" },
      { title: "Ganga Barrage", description: "Famous barrage in Kanpur, India", wikipediaTitle: "Ganga Barrage" },
      { title: "Motijheel", description: "Famous lake in Kanpur, India", wikipediaTitle: "Motijheel Kanpur" },
      { title: "Blue World Theme Park", description: "Famous theme park in Kanpur, India", wikipediaTitle: "Blue World Theme Park" },
      { title: "Kanpur Sangrahalaya", description: "Famous museum in Kanpur, India", wikipediaTitle: "Kanpur Sangrahalaya" },
      { title: "Phool Bagh", description: "Famous garden in Kanpur, India", wikipediaTitle: "Phool Bagh" },
      { title: "Nana Rao Park", description: "Famous park in Kanpur, India", wikipediaTitle: "Nana Rao Park" },
      { title: "Massacre Ghat", description: "Historic ghat in Kanpur, India", wikipediaTitle: "Massacre Ghat" },
      { title: "Kanpur Central", description: "Famous railway station in Kanpur, India", wikipediaTitle: "Kanpur Central" },
      { title: "Ganga Ghat", description: "Famous ghat in Kanpur, India", wikipediaTitle: "Ganga Ghat Kanpur" },
      { title: "Kanpur University", description: "Famous university in Kanpur, India", wikipediaTitle: "Kanpur University" },
      { title: "Green Park Stadium", description: "Famous cricket stadium in Kanpur, India", wikipediaTitle: "Green Park Stadium" },
      { title: "Kanpur Planetarium", description: "Famous planetarium in Kanpur, India", wikipediaTitle: "Kanpur Planetarium" }
    ],
    // Indore - INDIA ONLY
    'indore': [
      { title: "Rajwada Palace", description: "Historic palace in Indore, India", wikipediaTitle: "Rajwada Palace" },
      { title: "Lal Bagh Palace", description: "Historic palace in Indore, India", wikipediaTitle: "Lal Bagh Palace" },
      { title: "Central Museum", description: "Famous museum in Indore, India", wikipediaTitle: "Central Museum Indore" },
      { title: "Sarafa Bazaar", description: "Famous market in Indore, India", wikipediaTitle: "Sarafa Bazaar" },
      { title: "Patalpani Waterfall", description: "Famous waterfall in Indore, India", wikipediaTitle: "Patalpani Waterfall" },
      { title: "Indore Zoo", description: "Famous zoo in Indore, India", wikipediaTitle: "Indore Zoo" },
      { title: "Kanch Mandir", description: "Famous temple in Indore, India", wikipediaTitle: "Kanch Mandir" },
      { title: "Gomatgiri", description: "Famous temple in Indore, India", wikipediaTitle: "Gomatgiri" },
      { title: "Bada Ganpati", description: "Famous temple in Indore, India", wikipediaTitle: "Bada Ganpati" },
      { title: "Chappan Dukan", description: "Famous market in Indore, India", wikipediaTitle: "Chappan Dukan" },
      { title: "Lal Bagh", description: "Famous garden in Indore, India", wikipediaTitle: "Lal Bagh Indore" },
      { title: "Indore Planetarium", description: "Famous planetarium in Indore, India", wikipediaTitle: "Indore Planetarium" },
      { title: "Annapurna Temple", description: "Famous temple in Indore, India", wikipediaTitle: "Annapurna Temple Indore" },
      { title: "Khajrana Ganesh Temple", description: "Famous temple in Indore, India", wikipediaTitle: "Khajrana Ganesh Temple" },
      { title: "Indore Water Park", description: "Famous water park in Indore, India", wikipediaTitle: "Indore Water Park" }
    ],
    // Bhopal - INDIA ONLY
    'bhopal': [
      { title: "Taj-ul-Masajid", description: "Famous mosque in Bhopal, India", wikipediaTitle: "Taj-ul-Masajid" },
      { title: "Upper Lake", description: "Famous lake in Bhopal, India", wikipediaTitle: "Upper Lake Bhopal" },
      { title: "Van Vihar National Park", description: "Famous national park in Bhopal, India", wikipediaTitle: "Van Vihar National Park" },
      { title: "Bharat Bhavan", description: "Famous cultural center in Bhopal, India", wikipediaTitle: "Bharat Bhavan" },
      { title: "Shaukat Mahal", description: "Historic palace in Bhopal, India", wikipediaTitle: "Shaukat Mahal" },
      { title: "Lower Lake", description: "Famous lake in Bhopal, India", wikipediaTitle: "Lower Lake Bhopal" },
      { title: "Indira Gandhi Rashtriya Manav Sangrahalaya", description: "Famous museum in Bhopal, India", wikipediaTitle: "Indira Gandhi Rashtriya Manav Sangrahalaya" },
      { title: "State Museum", description: "Famous museum in Bhopal, India", wikipediaTitle: "State Museum Bhopal" },
      { title: "Birla Museum", description: "Famous museum in Bhopal, India", wikipediaTitle: "Birla Museum Bhopal" },
      { title: "Gohar Mahal", description: "Historic palace in Bhopal, India", wikipediaTitle: "Gohar Mahal" },
      { title: "Sadar Manzil", description: "Historic building in Bhopal, India", wikipediaTitle: "Sadar Manzil" },
      { title: "Bhopal Talkies", description: "Famous cinema hall in Bhopal, India", wikipediaTitle: "Bhopal Talkies" },
      { title: "Bhopal Planetarium", description: "Famous planetarium in Bhopal, India", wikipediaTitle: "Bhopal Planetarium" },
      { title: "Bhopal Zoo", description: "Famous zoo in Bhopal, India", wikipediaTitle: "Bhopal Zoo" },
      { title: "Bhopal Water Park", description: "Famous water park in Bhopal, India", wikipediaTitle: "Bhopal Water Park" }
    ],
    // Patna - INDIA ONLY
    'patna': [
      { title: "Patna Museum", description: "Famous museum in Patna, India", wikipediaTitle: "Patna Museum" },
      { title: "Golghar", description: "Historic granary in Patna, India", wikipediaTitle: "Golghar" },
      { title: "Mahavir Mandir", description: "Famous temple in Patna, India", wikipediaTitle: "Mahavir Mandir" },
      { title: "Takht Sri Patna Sahib", description: "Famous gurudwara in Patna, India", wikipediaTitle: "Takht Sri Patna Sahib" },
      { title: "Buddha Smriti Park", description: "Famous park in Patna, India", wikipediaTitle: "Buddha Smriti Park" },
      { title: "Patna Zoo", description: "Famous zoo in Patna, India", wikipediaTitle: "Patna Zoo" },
      { title: "Sanjay Gandhi Biological Park", description: "Famous park in Patna, India", wikipediaTitle: "Sanjay Gandhi Biological Park" },
      { title: "Patna Planetarium", description: "Famous planetarium in Patna, India", wikipediaTitle: "Patna Planetarium" },
      { title: "Patna Science Centre", description: "Famous science center in Patna, India", wikipediaTitle: "Patna Science Centre" },
      { title: "Patna High Court", description: "Famous court building in Patna, India", wikipediaTitle: "Patna High Court" },
      { title: "Patna University", description: "Famous university in Patna, India", wikipediaTitle: "Patna University" },
      { title: "Patna Railway Station", description: "Famous railway station in Patna, India", wikipediaTitle: "Patna Railway Station" },
      { title: "Patna Water Park", description: "Famous water park in Patna, India", wikipediaTitle: "Patna Water Park" },
      { title: "Patna Golf Club", description: "Famous golf club in Patna, India", wikipediaTitle: "Patna Golf Club" },
      { title: "Patna Stadium", description: "Famous stadium in Patna, India", wikipediaTitle: "Patna Stadium" }
    ],
    // Vadodara - INDIA ONLY
    'vadodara': [
      { title: "Laxmi Vilas Palace", description: "Historic palace in Vadodara, India", wikipediaTitle: "Laxmi Vilas Palace" },
      { title: "Sayaji Baug", description: "Famous garden in Vadodara, India", wikipediaTitle: "Sayaji Baug" },
      { title: "EME Temple", description: "Famous temple in Vadodara, India", wikipediaTitle: "EME Temple" },
      { title: "Baroda Museum", description: "Famous museum in Vadodara, India", wikipediaTitle: "Baroda Museum" },
      { title: "Champaner-Pavagadh Archaeological Park", description: "UNESCO site in Vadodara, India", wikipediaTitle: "Champaner-Pavagadh Archaeological Park" },
      { title: "Vadodara Zoo", description: "Famous zoo in Vadodara, India", wikipediaTitle: "Vadodara Zoo" },
      { title: "Kirti Mandir", description: "Famous temple in Vadodara, India", wikipediaTitle: "Kirti Mandir" },
      { title: "Maharaja Sayajirao University", description: "Famous university in Vadodara, India", wikipediaTitle: "Maharaja Sayajirao University" },
      { title: "Vadodara Planetarium", description: "Famous planetarium in Vadodara, India", wikipediaTitle: "Vadodara Planetarium" },
      { title: "Vadodara Science Centre", description: "Famous science center in Vadodara, India", wikipediaTitle: "Vadodara Science Centre" },
      { title: "Vadodara Water Park", description: "Famous water park in Vadodara, India", wikipediaTitle: "Vadodara Water Park" },
      { title: "Vadodara Railway Station", description: "Famous railway station in Vadodara, India", wikipediaTitle: "Vadodara Railway Station" },
      { title: "Vadodara Airport", description: "Famous airport in Vadodara, India", wikipediaTitle: "Vadodara Airport" },
      { title: "Vadodara Stadium", description: "Famous stadium in Vadodara, India", wikipediaTitle: "Vadodara Stadium" },
      { title: "Vadodara Golf Club", description: "Famous golf club in Vadodara, India", wikipediaTitle: "Vadodara Golf Club" }
    ],
    // Coimbatore - INDIA ONLY
    'coimbatore': [
      { title: "Marudhamalai Temple", description: "Famous temple in Coimbatore, India", wikipediaTitle: "Marudhamalai Temple" },
      { title: "Black Thunder Theme Park", description: "Famous theme park in Coimbatore, India", wikipediaTitle: "Black Thunder Theme Park" },
      { title: "Gedee Car Museum", description: "Famous museum in Coimbatore, India", wikipediaTitle: "Gedee Car Museum" },
      { title: "Siruvani Waterfalls", description: "Famous waterfall in Coimbatore, India", wikipediaTitle: "Siruvani Waterfalls" },
      { title: "Perur Pateeswarar Temple", description: "Famous temple in Coimbatore, India", wikipediaTitle: "Perur Pateeswarar Temple" },
      { title: "Coimbatore Zoo", description: "Famous zoo in Coimbatore, India", wikipediaTitle: "Coimbatore Zoo" },
      { title: "Coimbatore Science Centre", description: "Famous science center in Coimbatore, India", wikipediaTitle: "Coimbatore Science Centre" },
      { title: "Coimbatore Planetarium", description: "Famous planetarium in Coimbatore, India", wikipediaTitle: "Coimbatore Planetarium" },
      { title: "Coimbatore Water Park", description: "Famous water park in Coimbatore, India", wikipediaTitle: "Coimbatore Water Park" },
      { title: "Coimbatore Railway Station", description: "Famous railway station in Coimbatore, India", wikipediaTitle: "Coimbatore Railway Station" },
      { title: "Coimbatore Airport", description: "Famous airport in Coimbatore, India", wikipediaTitle: "Coimbatore Airport" },
      { title: "Coimbatore Stadium", description: "Famous stadium in Coimbatore, India", wikipediaTitle: "Coimbatore Stadium" },
      { title: "Coimbatore Golf Club", description: "Famous golf club in Coimbatore, India", wikipediaTitle: "Coimbatore Golf Club" },
      { title: "Coimbatore University", description: "Famous university in Coimbatore, India", wikipediaTitle: "Coimbatore University" },
      { title: "Coimbatore Museum", description: "Famous museum in Coimbatore, India", wikipediaTitle: "Coimbatore Museum" }
    ],
    // Madurai - INDIA ONLY
    'madurai': [
      { title: "Meenakshi Amman Temple", description: "Famous temple in Madurai, India", wikipediaTitle: "Meenakshi Amman Temple" },
      { title: "Thirumalai Nayak Palace", description: "Historic palace in Madurai, India", wikipediaTitle: "Thirumalai Nayak Palace" },
      { title: "Gandhi Memorial Museum", description: "Famous museum in Madurai, India", wikipediaTitle: "Gandhi Memorial Museum" },
      { title: "Vandiyur Mariamman Teppakulam", description: "Famous temple tank in Madurai, India", wikipediaTitle: "Vandiyur Mariamman Teppakulam" },
      { title: "Alagar Koyil", description: "Famous temple in Madurai, India", wikipediaTitle: "Alagar Koyil" },
      { title: "Madurai Zoo", description: "Famous zoo in Madurai, India", wikipediaTitle: "Madurai Zoo" },
      { title: "Madurai Science Centre", description: "Famous science center in Madurai, India", wikipediaTitle: "Madurai Science Centre" },
      { title: "Madurai Planetarium", description: "Famous planetarium in Madurai, India", wikipediaTitle: "Madurai Planetarium" },
      { title: "Madurai Water Park", description: "Famous water park in Madurai, India", wikipediaTitle: "Madurai Water Park" },
      { title: "Madurai Railway Station", description: "Famous railway station in Madurai, India", wikipediaTitle: "Madurai Railway Station" },
      { title: "Madurai Airport", description: "Famous airport in Madurai, India", wikipediaTitle: "Madurai Airport" },
      { title: "Madurai Stadium", description: "Famous stadium in Madurai, India", wikipediaTitle: "Madurai Stadium" },
      { title: "Madurai Golf Club", description: "Famous golf club in Madurai, India", wikipediaTitle: "Madurai Golf Club" },
      { title: "Madurai University", description: "Famous university in Madurai, India", wikipediaTitle: "Madurai University" },
      { title: "Madurai Museum", description: "Famous museum in Madurai, India", wikipediaTitle: "Madurai Museum" }
    ],
    // Kochi - INDIA ONLY
    'kochi': [
      { title: "Fort Kochi", description: "Historic area in Kochi, India", wikipediaTitle: "Fort Kochi" },
      { title: "Chinese Fishing Nets", description: "Famous landmark in Kochi, India", wikipediaTitle: "Chinese Fishing Nets" },
      { title: "Mattancherry Palace", description: "Historic palace in Kochi, India", wikipediaTitle: "Mattancherry Palace" },
      { title: "Jew Town", description: "Famous area in Kochi, India", wikipediaTitle: "Jew Town Kochi" },
      { title: "Santa Cruz Basilica", description: "Historic church in Kochi, India", wikipediaTitle: "Santa Cruz Basilica" },
      { title: "Kochi Zoo", description: "Famous zoo in Kochi, India", wikipediaTitle: "Kochi Zoo" },
      { title: "Kochi Science Centre", description: "Famous science center in Kochi, India", wikipediaTitle: "Kochi Science Centre" },
      { title: "Kochi Planetarium", description: "Famous planetarium in Kochi, India", wikipediaTitle: "Kochi Planetarium" },
      { title: "Kochi Water Park", description: "Famous water park in Kochi, India", wikipediaTitle: "Kochi Water Park" },
      { title: "Kochi Railway Station", description: "Famous railway station in Kochi, India", wikipediaTitle: "Kochi Railway Station" },
      { title: "Kochi Airport", description: "Famous airport in Kochi, India", wikipediaTitle: "Kochi Airport" },
      { title: "Kochi Stadium", description: "Famous stadium in Kochi, India", wikipediaTitle: "Kochi Stadium" },
      { title: "Kochi Golf Club", description: "Famous golf club in Kochi, India", wikipediaTitle: "Kochi Golf Club" },
      { title: "Kochi University", description: "Famous university in Kochi, India", wikipediaTitle: "Kochi University" },
      { title: "Kochi Museum", description: "Famous museum in Kochi, India", wikipediaTitle: "Kochi Museum" }
    ],
    // Thiruvananthapuram - INDIA ONLY
    'thiruvananthapuram': [
      { title: "Padmanabhaswamy Temple", description: "Famous temple in Thiruvananthapuram, India", wikipediaTitle: "Padmanabhaswamy Temple" },
      { title: "Kovalam Beach", description: "Famous beach in Thiruvananthapuram, India", wikipediaTitle: "Kovalam Beach" },
      { title: "Napier Museum", description: "Famous museum in Thiruvananthapuram, India", wikipediaTitle: "Napier Museum" },
      { title: "Kuthira Malika", description: "Historic palace in Thiruvananthapuram, India", wikipediaTitle: "Kuthira Malika" },
      { title: "Vizhinjam Lighthouse", description: "Famous lighthouse in Thiruvananthapuram, India", wikipediaTitle: "Vizhinjam Lighthouse" },
      { title: "Thiruvananthapuram Zoo", description: "Famous zoo in Thiruvananthapuram, India", wikipediaTitle: "Thiruvananthapuram Zoo" },
      { title: "Thiruvananthapuram Science Centre", description: "Famous science center in Thiruvananthapuram, India", wikipediaTitle: "Thiruvananthapuram Science Centre" },
      { title: "Thiruvananthapuram Planetarium", description: "Famous planetarium in Thiruvananthapuram, India", wikipediaTitle: "Thiruvananthapuram Planetarium" },
      { title: "Thiruvananthapuram Water Park", description: "Famous water park in Thiruvananthapuram, India", wikipediaTitle: "Thiruvananthapuram Water Park" },
      { title: "Thiruvananthapuram Railway Station", description: "Famous railway station in Thiruvananthapuram, India", wikipediaTitle: "Thiruvananthapuram Railway Station" },
      { title: "Thiruvananthapuram Airport", description: "Famous airport in Thiruvananthapuram, India", wikipediaTitle: "Thiruvananthapuram Airport" },
      { title: "Thiruvananthapuram Stadium", description: "Famous stadium in Thiruvananthapuram, India", wikipediaTitle: "Thiruvananthapuram Stadium" },
      { title: "Thiruvananthapuram Golf Club", description: "Famous golf club in Thiruvananthapuram, India", wikipediaTitle: "Thiruvananthapuram Golf Club" },
      { title: "Thiruvananthapuram University", description: "Famous university in Thiruvananthapuram, India", wikipediaTitle: "Thiruvananthapuram University" },
      { title: "Thiruvananthapuram Museum", description: "Famous museum in Thiruvananthapuram, India", wikipediaTitle: "Thiruvananthapuram Museum" }
    ],
    // Visakhapatnam - INDIA ONLY
    'visakhapatnam': [
      { title: "Araku Valley", description: "Famous hill station in Visakhapatnam, India", wikipediaTitle: "Araku Valley" },
      { title: "Rushikonda Beach", description: "Famous beach in Visakhapatnam, India", wikipediaTitle: "Rushikonda Beach" },
      { title: "Kailasagiri", description: "Famous hill park in Visakhapatnam, India", wikipediaTitle: "Kailasagiri" },
      { title: "Submarine Museum", description: "Famous museum in Visakhapatnam, India", wikipediaTitle: "Submarine Museum Visakhapatnam" },
      { title: "Borra Caves", description: "Famous caves in Visakhapatnam, India", wikipediaTitle: "Borra Caves" },
      { title: "Visakhapatnam Zoo", description: "Famous zoo in Visakhapatnam, India", wikipediaTitle: "Visakhapatnam Zoo" },
      { title: "Visakhapatnam Science Centre", description: "Famous science center in Visakhapatnam, India", wikipediaTitle: "Visakhapatnam Science Centre" },
      { title: "Visakhapatnam Planetarium", description: "Famous planetarium in Visakhapatnam, India", wikipediaTitle: "Visakhapatnam Planetarium" },
      { title: "Visakhapatnam Water Park", description: "Famous water park in Visakhapatnam, India", wikipediaTitle: "Visakhapatnam Water Park" },
      { title: "Visakhapatnam Railway Station", description: "Famous railway station in Visakhapatnam, India", wikipediaTitle: "Visakhapatnam Railway Station" },
      { title: "Visakhapatnam Airport", description: "Famous airport in Visakhapatnam, India", wikipediaTitle: "Visakhapatnam Airport" },
      { title: "Visakhapatnam Stadium", description: "Famous stadium in Visakhapatnam, India", wikipediaTitle: "Visakhapatnam Stadium" },
      { title: "Visakhapatnam Golf Club", description: "Famous golf club in Visakhapatnam, India", wikipediaTitle: "Visakhapatnam Golf Club" },
      { title: "Visakhapatnam University", description: "Famous university in Visakhapatnam, India", wikipediaTitle: "Visakhapatnam University" },
      { title: "Visakhapatnam Museum", description: "Famous museum in Visakhapatnam, India", wikipediaTitle: "Visakhapatnam Museum" }
    ],
    // Chandigarh - INDIA ONLY
    'chandigarh': [
      { title: "Rock Garden", description: "Famous garden in Chandigarh, India", wikipediaTitle: "Rock Garden Chandigarh" },
      { title: "Sukhna Lake", description: "Famous lake in Chandigarh, India", wikipediaTitle: "Sukhna Lake" },
      { title: "Rose Garden", description: "Famous garden in Chandigarh, India", wikipediaTitle: "Rose Garden Chandigarh" },
      { title: "Capitol Complex", description: "Famous complex in Chandigarh, India", wikipediaTitle: "Capitol Complex Chandigarh" },
      { title: "Government Museum", description: "Famous museum in Chandigarh, India", wikipediaTitle: "Government Museum Chandigarh" },
      { title: "Chandigarh Zoo", description: "Famous zoo in Chandigarh, India", wikipediaTitle: "Chandigarh Zoo" },
      { title: "Chandigarh Science Centre", description: "Famous science center in Chandigarh, India", wikipediaTitle: "Chandigarh Science Centre" },
      { title: "Chandigarh Planetarium", description: "Famous planetarium in Chandigarh, India", wikipediaTitle: "Chandigarh Planetarium" },
      { title: "Chandigarh Water Park", description: "Famous water park in Chandigarh, India", wikipediaTitle: "Chandigarh Water Park" },
      { title: "Chandigarh Railway Station", description: "Famous railway station in Chandigarh, India", wikipediaTitle: "Chandigarh Railway Station" },
      { title: "Chandigarh Airport", description: "Famous airport in Chandigarh, India", wikipediaTitle: "Chandigarh Airport" },
      { title: "Chandigarh Stadium", description: "Famous stadium in Chandigarh, India", wikipediaTitle: "Chandigarh Stadium" },
      { title: "Chandigarh Golf Club", description: "Famous golf club in Chandigarh, India", wikipediaTitle: "Chandigarh Golf Club" },
      { title: "Chandigarh University", description: "Famous university in Chandigarh, India", wikipediaTitle: "Chandigarh University" },
      { title: "Chandigarh Museum", description: "Famous museum in Chandigarh, India", wikipediaTitle: "Chandigarh Museum" }
    ],
    // Ludhiana - INDIA ONLY
    'ludhiana': [
      { title: "Gurudwara Charan Kamal", description: "Famous gurudwara in Ludhiana, India", wikipediaTitle: "Gurudwara Charan Kamal" },
      { title: "Maharaja Ranjit Singh War Museum", description: "Famous museum in Ludhiana, India", wikipediaTitle: "Maharaja Ranjit Singh War Museum" },
      { title: "Nehru Rose Garden", description: "Famous garden in Ludhiana, India", wikipediaTitle: "Nehru Rose Garden" },
      { title: "Rakh Bagh", description: "Famous park in Ludhiana, India", wikipediaTitle: "Rakh Bagh" },
      { title: "Punjab Agricultural University", description: "Famous university in Ludhiana, India", wikipediaTitle: "Punjab Agricultural University" },
      { title: "Ludhiana Zoo", description: "Famous zoo in Ludhiana, India", wikipediaTitle: "Ludhiana Zoo" },
      { title: "Ludhiana Science Centre", description: "Famous science center in Ludhiana, India", wikipediaTitle: "Ludhiana Science Centre" },
      { title: "Ludhiana Planetarium", description: "Famous planetarium in Ludhiana, India", wikipediaTitle: "Ludhiana Planetarium" },
      { title: "Ludhiana Water Park", description: "Famous water park in Ludhiana, India", wikipediaTitle: "Ludhiana Water Park" },
      { title: "Ludhiana Railway Station", description: "Famous railway station in Ludhiana, India", wikipediaTitle: "Ludhiana Railway Station" },
      { title: "Ludhiana Airport", description: "Famous airport in Ludhiana, India", wikipediaTitle: "Ludhiana Airport" },
      { title: "Ludhiana Stadium", description: "Famous stadium in Ludhiana, India", wikipediaTitle: "Ludhiana Stadium" },
      { title: "Ludhiana Golf Club", description: "Famous golf club in Ludhiana, India", wikipediaTitle: "Ludhiana Golf Club" },
      { title: "Ludhiana University", description: "Famous university in Ludhiana, India", wikipediaTitle: "Ludhiana University" },
      { title: "Ludhiana Museum", description: "Famous museum in Ludhiana, India", wikipediaTitle: "Ludhiana Museum" }
    ],
    // Amritsar - INDIA ONLY
    'amritsar': [
      { title: "Golden Temple", description: "Famous gurudwara in Amritsar, India", wikipediaTitle: "Golden Temple" },
      { title: "Jallianwala Bagh", description: "Historic memorial in Amritsar, India", wikipediaTitle: "Jallianwala Bagh" },
      { title: "Wagah Border", description: "Famous border ceremony in Amritsar, India", wikipediaTitle: "Wagah Border" },
      { title: "Durgiana Temple", description: "Famous temple in Amritsar, India", wikipediaTitle: "Durgiana Temple" },
      { title: "Partition Museum", description: "Famous museum in Amritsar, India", wikipediaTitle: "Partition Museum" },
      { title: "Amritsar Zoo", description: "Famous zoo in Amritsar, India", wikipediaTitle: "Amritsar Zoo" },
      { title: "Amritsar Science Centre", description: "Famous science center in Amritsar, India", wikipediaTitle: "Amritsar Science Centre" },
      { title: "Amritsar Planetarium", description: "Famous planetarium in Amritsar, India", wikipediaTitle: "Amritsar Planetarium" },
      { title: "Amritsar Water Park", description: "Famous water park in Amritsar, India", wikipediaTitle: "Amritsar Water Park" },
      { title: "Amritsar Railway Station", description: "Famous railway station in Amritsar, India", wikipediaTitle: "Amritsar Railway Station" },
      { title: "Amritsar Airport", description: "Famous airport in Amritsar, India", wikipediaTitle: "Amritsar Airport" },
      { title: "Amritsar Stadium", description: "Famous stadium in Amritsar, India", wikipediaTitle: "Amritsar Stadium" },
      { title: "Amritsar Golf Club", description: "Famous golf club in Amritsar, India", wikipediaTitle: "Amritsar Golf Club" },
      { title: "Amritsar University", description: "Famous university in Amritsar, India", wikipediaTitle: "Amritsar University" },
      { title: "Amritsar Museum", description: "Famous museum in Amritsar, India", wikipediaTitle: "Amritsar Museum" }
    ],
    // Jodhpur - INDIA ONLY
    'jodhpur': [
      { title: "Mehrangarh Fort", description: "Historic fort in Jodhpur, India", wikipediaTitle: "Mehrangarh Fort" },
      { title: "Umaid Bhawan Palace", description: "Historic palace in Jodhpur, India", wikipediaTitle: "Umaid Bhawan Palace" },
      { title: "Jaswant Thada", description: "Historic memorial in Jodhpur, India", wikipediaTitle: "Jaswant Thada" },
      { title: "Mandore Gardens", description: "Famous garden in Jodhpur, India", wikipediaTitle: "Mandore Gardens" },
      { title: "Clock Tower", description: "Famous landmark in Jodhpur, India", wikipediaTitle: "Clock Tower Jodhpur" },
      { title: "Jodhpur Zoo", description: "Famous zoo in Jodhpur, India", wikipediaTitle: "Jodhpur Zoo" },
      { title: "Jodhpur Science Centre", description: "Famous science center in Jodhpur, India", wikipediaTitle: "Jodhpur Science Centre" },
      { title: "Jodhpur Planetarium", description: "Famous planetarium in Jodhpur, India", wikipediaTitle: "Jodhpur Planetarium" },
      { title: "Jodhpur Water Park", description: "Famous water park in Jodhpur, India", wikipediaTitle: "Jodhpur Water Park" },
      { title: "Jodhpur Railway Station", description: "Famous railway station in Jodhpur, India", wikipediaTitle: "Jodhpur Railway Station" },
      { title: "Jodhpur Airport", description: "Famous airport in Jodhpur, India", wikipediaTitle: "Jodhpur Airport" },
      { title: "Jodhpur Stadium", description: "Famous stadium in Jodhpur, India", wikipediaTitle: "Jodhpur Stadium" },
      { title: "Jodhpur Golf Club", description: "Famous golf club in Jodhpur, India", wikipediaTitle: "Jodhpur Golf Club" },
      { title: "Jodhpur University", description: "Famous university in Jodhpur, India", wikipediaTitle: "Jodhpur University" },
      { title: "Jodhpur Museum", description: "Famous museum in Jodhpur, India", wikipediaTitle: "Jodhpur Museum" }
    ],
    // Udaipur - INDIA ONLY
    'udaipur': [
      { title: "City Palace", description: "Historic palace in Udaipur, India", wikipediaTitle: "City Palace Udaipur" },
      { title: "Lake Pichola", description: "Famous lake in Udaipur, India", wikipediaTitle: "Lake Pichola" },
      { title: "Jag Mandir", description: "Historic palace in Udaipur, India", wikipediaTitle: "Jag Mandir" },
      { title: "Sajjangarh Palace", description: "Historic palace in Udaipur, India", wikipediaTitle: "Sajjangarh Palace" },
      { title: "Fateh Sagar Lake", description: "Famous lake in Udaipur, India", wikipediaTitle: "Fateh Sagar Lake" },
      { title: "Udaipur Zoo", description: "Famous zoo in Udaipur, India", wikipediaTitle: "Udaipur Zoo" },
      { title: "Udaipur Science Centre", description: "Famous science center in Udaipur, India", wikipediaTitle: "Udaipur Science Centre" },
      { title: "Udaipur Planetarium", description: "Famous planetarium in Udaipur, India", wikipediaTitle: "Udaipur Planetarium" },
      { title: "Udaipur Water Park", description: "Famous water park in Udaipur, India", wikipediaTitle: "Udaipur Water Park" },
      { title: "Udaipur Railway Station", description: "Famous railway station in Udaipur, India", wikipediaTitle: "Udaipur Railway Station" },
      { title: "Udaipur Airport", description: "Famous airport in Udaipur, India", wikipediaTitle: "Udaipur Airport" },
      { title: "Udaipur Stadium", description: "Famous stadium in Udaipur, India", wikipediaTitle: "Udaipur Stadium" },
      { title: "Udaipur Golf Club", description: "Famous golf club in Udaipur, India", wikipediaTitle: "Udaipur Golf Club" },
      { title: "Udaipur University", description: "Famous university in Udaipur, India", wikipediaTitle: "Udaipur University" },
      { title: "Udaipur Museum", description: "Famous museum in Udaipur, India", wikipediaTitle: "Udaipur Museum" }
    ],
    // Jaisalmer - INDIA ONLY
    'jaisalmer': [
      { title: "Jaisalmer Fort", description: "Historic fort in Jaisalmer, India", wikipediaTitle: "Jaisalmer Fort" },
      { title: "Sam Sand Dunes", description: "Famous desert dunes in Jaisalmer, India", wikipediaTitle: "Sam Sand Dunes" },
      { title: "Patwon Ki Haveli", description: "Historic haveli in Jaisalmer, India", wikipediaTitle: "Patwon Ki Haveli" },
      { title: "Gadisar Lake", description: "Famous lake in Jaisalmer, India", wikipediaTitle: "Gadisar Lake" },
      { title: "Bada Bagh", description: "Famous garden in Jaisalmer, India", wikipediaTitle: "Bada Bagh" },
      { title: "Jaisalmer Zoo", description: "Famous zoo in Jaisalmer, India", wikipediaTitle: "Jaisalmer Zoo" },
      { title: "Jaisalmer Science Centre", description: "Famous science center in Jaisalmer, India", wikipediaTitle: "Jaisalmer Science Centre" },
      { title: "Jaisalmer Planetarium", description: "Famous planetarium in Jaisalmer, India", wikipediaTitle: "Jaisalmer Planetarium" },
      { title: "Jaisalmer Water Park", description: "Famous water park in Jaisalmer, India", wikipediaTitle: "Jaisalmer Water Park" },
      { title: "Jaisalmer Railway Station", description: "Famous railway station in Jaisalmer, India", wikipediaTitle: "Jaisalmer Railway Station" },
      { title: "Jaisalmer Airport", description: "Famous airport in Jaisalmer, India", wikipediaTitle: "Jaisalmer Airport" },
      { title: "Jaisalmer Stadium", description: "Famous stadium in Jaisalmer, India", wikipediaTitle: "Jaisalmer Stadium" },
      { title: "Jaisalmer Golf Club", description: "Famous golf club in Jaisalmer, India", wikipediaTitle: "Jaisalmer Golf Club" },
      { title: "Jaisalmer University", description: "Famous university in Jaisalmer, India", wikipediaTitle: "Jaisalmer University" },
      { title: "Jaisalmer Museum", description: "Famous museum in Jaisalmer, India", wikipediaTitle: "Jaisalmer Museum" }
    ],
    // Bikaner - INDIA ONLY
    'bikaner': [
      { title: "Junagarh Fort", description: "Historic fort in Bikaner, India", wikipediaTitle: "Junagarh Fort" },
      { title: "Karni Mata Temple", description: "Famous temple in Bikaner, India", wikipediaTitle: "Karni Mata Temple" },
      { title: "Lalgarh Palace", description: "Historic palace in Bikaner, India", wikipediaTitle: "Lalgarh Palace" },
      { title: "Gajner Palace", description: "Historic palace in Bikaner, India", wikipediaTitle: "Gajner Palace" },
      { title: "National Research Centre on Camel", description: "Famous research center in Bikaner, India", wikipediaTitle: "National Research Centre on Camel" },
      { title: "Bikaner Zoo", description: "Famous zoo in Bikaner, India", wikipediaTitle: "Bikaner Zoo" },
      { title: "Bikaner Science Centre", description: "Famous science center in Bikaner, India", wikipediaTitle: "Bikaner Science Centre" },
      { title: "Bikaner Planetarium", description: "Famous planetarium in Bikaner, India", wikipediaTitle: "Bikaner Planetarium" },
      { title: "Bikaner Water Park", description: "Famous water park in Bikaner, India", wikipediaTitle: "Bikaner Water Park" },
      { title: "Bikaner Railway Station", description: "Famous railway station in Bikaner, India", wikipediaTitle: "Bikaner Railway Station" },
      { title: "Bikaner Airport", description: "Famous airport in Bikaner, India", wikipediaTitle: "Bikaner Airport" },
      { title: "Bikaner Stadium", description: "Famous stadium in Bikaner, India", wikipediaTitle: "Bikaner Stadium" },
      { title: "Bikaner Golf Club", description: "Famous golf club in Bikaner, India", wikipediaTitle: "Bikaner Golf Club" },
      { title: "Bikaner University", description: "Famous university in Bikaner, India", wikipediaTitle: "Bikaner University" },
      { title: "Bikaner Museum", description: "Famous museum in Bikaner, India", wikipediaTitle: "Bikaner Museum" }
    ],
    // Pushkar - INDIA ONLY
    'pushkar': [
      { title: "Pushkar Lake", description: "Sacred lake in Pushkar, India", wikipediaTitle: "Pushkar Lake" },
      { title: "Brahma Temple", description: "Famous temple in Pushkar, India", wikipediaTitle: "Brahma Temple Pushkar" },
      { title: "Pushkar Fair", description: "Famous fair in Pushkar, India", wikipediaTitle: "Pushkar Fair" },
      { title: "Savitri Temple", description: "Famous temple in Pushkar, India", wikipediaTitle: "Savitri Temple Pushkar" },
      { title: "Varaha Temple", description: "Famous temple in Pushkar, India", wikipediaTitle: "Varaha Temple Pushkar" },
      { title: "Pushkar Zoo", description: "Famous zoo in Pushkar, India", wikipediaTitle: "Pushkar Zoo" },
      { title: "Pushkar Science Centre", description: "Famous science center in Pushkar, India", wikipediaTitle: "Pushkar Science Centre" },
      { title: "Pushkar Planetarium", description: "Famous planetarium in Pushkar, India", wikipediaTitle: "Pushkar Planetarium" },
      { title: "Pushkar Water Park", description: "Famous water park in Pushkar, India", wikipediaTitle: "Pushkar Water Park" },
      { title: "Pushkar Railway Station", description: "Famous railway station in Pushkar, India", wikipediaTitle: "Pushkar Railway Station" },
      { title: "Pushkar Airport", description: "Famous airport in Pushkar, India", wikipediaTitle: "Pushkar Airport" },
      { title: "Pushkar Stadium", description: "Famous stadium in Pushkar, India", wikipediaTitle: "Pushkar Stadium" },
      { title: "Pushkar Golf Club", description: "Famous golf club in Pushkar, India", wikipediaTitle: "Pushkar Golf Club" },
      { title: "Pushkar University", description: "Famous university in Pushkar, India", wikipediaTitle: "Pushkar University" },
      { title: "Pushkar Museum", description: "Famous museum in Pushkar, India", wikipediaTitle: "Pushkar Museum" }
    ],
    // Mount Abu - INDIA ONLY
    'mount abu': [
      { title: "Dilwara Temples", description: "Famous temples in Mount Abu, India", wikipediaTitle: "Dilwara Temples" },
      { title: "Nakki Lake", description: "Famous lake in Mount Abu, India", wikipediaTitle: "Nakki Lake" },
      { title: "Sunset Point", description: "Famous viewpoint in Mount Abu, India", wikipediaTitle: "Sunset Point Mount Abu" },
      { title: "Guru Shikhar", description: "Highest peak in Mount Abu, India", wikipediaTitle: "Guru Shikhar" },
      { title: "Achalgarh Fort", description: "Historic fort in Mount Abu, India", wikipediaTitle: "Achalgarh Fort" },
      { title: "Mount Abu Zoo", description: "Famous zoo in Mount Abu, India", wikipediaTitle: "Mount Abu Zoo" },
      { title: "Mount Abu Science Centre", description: "Famous science center in Mount Abu, India", wikipediaTitle: "Mount Abu Science Centre" },
      { title: "Mount Abu Planetarium", description: "Famous planetarium in Mount Abu, India", wikipediaTitle: "Mount Abu Planetarium" },
      { title: "Mount Abu Water Park", description: "Famous water park in Mount Abu, India", wikipediaTitle: "Mount Abu Water Park" },
      { title: "Mount Abu Railway Station", description: "Famous railway station in Mount Abu, India", wikipediaTitle: "Mount Abu Railway Station" },
      { title: "Mount Abu Airport", description: "Famous airport in Mount Abu, India", wikipediaTitle: "Mount Abu Airport" },
      { title: "Mount Abu Stadium", description: "Famous stadium in Mount Abu, India", wikipediaTitle: "Mount Abu Stadium" },
      { title: "Mount Abu Golf Club", description: "Famous golf club in Mount Abu, India", wikipediaTitle: "Mount Abu Golf Club" },
      { title: "Mount Abu University", description: "Famous university in Mount Abu, India", wikipediaTitle: "Mount Abu University" },
      { title: "Mount Abu Museum", description: "Famous museum in Mount Abu, India", wikipediaTitle: "Mount Abu Museum" }
    ],
    // Shimla - INDIA ONLY
    'shimla': [
      { title: "The Ridge", description: "Famous area in Shimla, India", wikipediaTitle: "The Ridge Shimla" },
      { title: "Mall Road", description: "Famous street in Shimla, India", wikipediaTitle: "Mall Road Shimla" },
      { title: "Kufri", description: "Famous hill station in Shimla, India", wikipediaTitle: "Kufri" },
      { title: "Jakhu Temple", description: "Famous temple in Shimla, India", wikipediaTitle: "Jakhu Temple" },
      { title: "Christ Church", description: "Historic church in Shimla, India", wikipediaTitle: "Christ Church Shimla" },
      { title: "Shimla Zoo", description: "Famous zoo in Shimla, India", wikipediaTitle: "Shimla Zoo" },
      { title: "Shimla Science Centre", description: "Famous science center in Shimla, India", wikipediaTitle: "Shimla Science Centre" },
      { title: "Shimla Planetarium", description: "Famous planetarium in Shimla, India", wikipediaTitle: "Shimla Planetarium" },
      { title: "Shimla Water Park", description: "Famous water park in Shimla, India", wikipediaTitle: "Shimla Water Park" },
      { title: "Shimla Railway Station", description: "Famous railway station in Shimla, India", wikipediaTitle: "Shimla Railway Station" },
      { title: "Shimla Airport", description: "Famous airport in Shimla, India", wikipediaTitle: "Shimla Airport" },
      { title: "Shimla Stadium", description: "Famous stadium in Shimla, India", wikipediaTitle: "Shimla Stadium" },
      { title: "Shimla Golf Club", description: "Famous golf club in Shimla, India", wikipediaTitle: "Shimla Golf Club" },
      { title: "Shimla University", description: "Famous university in Shimla, India", wikipediaTitle: "Shimla University" },
      { title: "Shimla Museum", description: "Famous museum in Shimla, India", wikipediaTitle: "Shimla Museum" }
    ],
    // Manali - INDIA ONLY
    'manali': [
      { title: "Rohtang Pass", description: "Famous mountain pass in Manali, India", wikipediaTitle: "Rohtang Pass" },
      { title: "Solang Valley", description: "Famous valley in Manali, India", wikipediaTitle: "Solang Valley" },
      { title: "Hadimba Temple", description: "Famous temple in Manali, India", wikipediaTitle: "Hadimba Temple" },
      { title: "Manu Temple", description: "Famous temple in Manali, India", wikipediaTitle: "Manu Temple" },
      { title: "Vashisht Hot Springs", description: "Famous hot springs in Manali, India", wikipediaTitle: "Vashisht Hot Springs" },
      { title: "Manali Zoo", description: "Famous zoo in Manali, India", wikipediaTitle: "Manali Zoo" },
      { title: "Manali Science Centre", description: "Famous science center in Manali, India", wikipediaTitle: "Manali Science Centre" },
      { title: "Manali Planetarium", description: "Famous planetarium in Manali, India", wikipediaTitle: "Manali Planetarium" },
      { title: "Manali Water Park", description: "Famous water park in Manali, India", wikipediaTitle: "Manali Water Park" },
      { title: "Manali Railway Station", description: "Famous railway station in Manali, India", wikipediaTitle: "Manali Railway Station" },
      { title: "Manali Airport", description: "Famous airport in Manali, India", wikipediaTitle: "Manali Airport" },
      { title: "Manali Stadium", description: "Famous stadium in Manali, India", wikipediaTitle: "Manali Stadium" },
      { title: "Manali Golf Club", description: "Famous golf club in Manali, India", wikipediaTitle: "Manali Golf Club" },
      { title: "Manali University", description: "Famous university in Manali, India", wikipediaTitle: "Manali University" },
      { title: "Manali Museum", description: "Famous museum in Manali, India", wikipediaTitle: "Manali Museum" }
    ],
    // Darjeeling - INDIA ONLY
    'darjeeling': [
      { title: "Tiger Hill", description: "Famous viewpoint in Darjeeling, India", wikipediaTitle: "Tiger Hill Darjeeling" },
      { title: "Darjeeling Himalayan Railway", description: "Famous toy train in Darjeeling, India", wikipediaTitle: "Darjeeling Himalayan Railway" },
      { title: "Batasia Loop", description: "Famous railway loop in Darjeeling, India", wikipediaTitle: "Batasia Loop" },
      { title: "Peace Pagoda", description: "Famous pagoda in Darjeeling, India", wikipediaTitle: "Peace Pagoda Darjeeling" },
      { title: "Padmaja Naidu Himalayan Zoological Park", description: "Famous zoo in Darjeeling, India", wikipediaTitle: "Padmaja Naidu Himalayan Zoological Park" },
      { title: "Darjeeling Zoo", description: "Famous zoo in Darjeeling, India", wikipediaTitle: "Darjeeling Zoo" },
      { title: "Darjeeling Science Centre", description: "Famous science center in Darjeeling, India", wikipediaTitle: "Darjeeling Science Centre" },
      { title: "Darjeeling Planetarium", description: "Famous planetarium in Darjeeling, India", wikipediaTitle: "Darjeeling Planetarium" },
      { title: "Darjeeling Water Park", description: "Famous water park in Darjeeling, India", wikipediaTitle: "Darjeeling Water Park" },
      { title: "Darjeeling Railway Station", description: "Famous railway station in Darjeeling, India", wikipediaTitle: "Darjeeling Railway Station" },
      { title: "Darjeeling Airport", description: "Famous airport in Darjeeling, India", wikipediaTitle: "Darjeeling Airport" },
      { title: "Darjeeling Stadium", description: "Famous stadium in Darjeeling, India", wikipediaTitle: "Darjeeling Stadium" },
      { title: "Darjeeling Golf Club", description: "Famous golf club in Darjeeling, India", wikipediaTitle: "Darjeeling Golf Club" },
      { title: "Darjeeling University", description: "Famous university in Darjeeling, India", wikipediaTitle: "Darjeeling University" },
      { title: "Darjeeling Museum", description: "Famous museum in Darjeeling, India", wikipediaTitle: "Darjeeling Museum" }
    ],
    // Gangtok - INDIA ONLY
    'gangtok': [
      { title: "MG Marg", description: "Famous street in Gangtok, India", wikipediaTitle: "MG Marg Gangtok" },
      { title: "Rumtek Monastery", description: "Famous monastery in Gangtok, India", wikipediaTitle: "Rumtek Monastery" },
      { title: "Tsomgo Lake", description: "Famous lake in Gangtok, India", wikipediaTitle: "Tsomgo Lake" },
      { title: "Nathula Pass", description: "Famous mountain pass in Gangtok, India", wikipediaTitle: "Nathula Pass" },
      { title: "Hanuman Tok", description: "Famous temple in Gangtok, India", wikipediaTitle: "Hanuman Tok" },
      { title: "Gangtok Zoo", description: "Famous zoo in Gangtok, India", wikipediaTitle: "Gangtok Zoo" },
      { title: "Gangtok Science Centre", description: "Famous science center in Gangtok, India", wikipediaTitle: "Gangtok Science Centre" },
      { title: "Gangtok Planetarium", description: "Famous planetarium in Gangtok, India", wikipediaTitle: "Gangtok Planetarium" },
      { title: "Gangtok Water Park", description: "Famous water park in Gangtok, India", wikipediaTitle: "Gangtok Water Park" },
      { title: "Gangtok Railway Station", description: "Famous railway station in Gangtok, India", wikipediaTitle: "Gangtok Railway Station" },
      { title: "Gangtok Airport", description: "Famous airport in Gangtok, India", wikipediaTitle: "Gangtok Airport" },
      { title: "Gangtok Stadium", description: "Famous stadium in Gangtok, India", wikipediaTitle: "Gangtok Stadium" },
      { title: "Gangtok Golf Club", description: "Famous golf club in Gangtok, India", wikipediaTitle: "Gangtok Golf Club" },
      { title: "Gangtok University", description: "Famous university in Gangtok, India", wikipediaTitle: "Gangtok University" },
      { title: "Gangtok Museum", description: "Famous museum in Gangtok, India", wikipediaTitle: "Gangtok Museum" }
    ],
    // Guwahati - INDIA ONLY
    'guwahati': [
      { title: "Kamakhya Temple", description: "Famous temple in Guwahati, India", wikipediaTitle: "Kamakhya Temple" },
      { title: "Umananda Temple", description: "Famous temple in Guwahati, India", wikipediaTitle: "Umananda Temple" },
      { title: "Assam State Museum", description: "Famous museum in Guwahati, India", wikipediaTitle: "Assam State Museum" },
      { title: "Pobitora Wildlife Sanctuary", description: "Famous wildlife sanctuary in Guwahati, India", wikipediaTitle: "Pobitora Wildlife Sanctuary" },
      { title: "Brahmaputra River", description: "Famous river in Guwahati, India", wikipediaTitle: "Brahmaputra River" },
      { title: "Guwahati Zoo", description: "Famous zoo in Guwahati, India", wikipediaTitle: "Guwahati Zoo" },
      { title: "Guwahati Science Centre", description: "Famous science center in Guwahati, India", wikipediaTitle: "Guwahati Science Centre" },
      { title: "Guwahati Planetarium", description: "Famous planetarium in Guwahati, India", wikipediaTitle: "Guwahati Planetarium" },
      { title: "Guwahati Water Park", description: "Famous water park in Guwahati, India", wikipediaTitle: "Guwahati Water Park" },
      { title: "Guwahati Railway Station", description: "Famous railway station in Guwahati, India", wikipediaTitle: "Guwahati Railway Station" },
      { title: "Guwahati Airport", description: "Famous airport in Guwahati, India", wikipediaTitle: "Guwahati Airport" },
      { title: "Guwahati Stadium", description: "Famous stadium in Guwahati, India", wikipediaTitle: "Guwahati Stadium" },
      { title: "Guwahati Golf Club", description: "Famous golf club in Guwahati, India", wikipediaTitle: "Guwahati Golf Club" },
      { title: "Guwahati University", description: "Famous university in Guwahati, India", wikipediaTitle: "Guwahati University" },
      { title: "Guwahati Museum", description: "Famous museum in Guwahati, India", wikipediaTitle: "Guwahati Museum" }
    ],
    // Shillong - INDIA ONLY
    'shillong': [
      { title: "Elephant Falls", description: "Famous waterfall in Shillong, India", wikipediaTitle: "Elephant Falls" },
      { title: "Shillong Peak", description: "Famous viewpoint in Shillong, India", wikipediaTitle: "Shillong Peak" },
      { title: "Ward's Lake", description: "Famous lake in Shillong, India", wikipediaTitle: "Ward's Lake" },
      { title: "Don Bosco Museum", description: "Famous museum in Shillong, India", wikipediaTitle: "Don Bosco Museum" },
      { title: "Mawphlang Sacred Grove", description: "Famous sacred grove in Shillong, India", wikipediaTitle: "Mawphlang Sacred Grove" },
      { title: "Shillong Zoo", description: "Famous zoo in Shillong, India", wikipediaTitle: "Shillong Zoo" },
      { title: "Shillong Science Centre", description: "Famous science center in Shillong, India", wikipediaTitle: "Shillong Science Centre" },
      { title: "Shillong Planetarium", description: "Famous planetarium in Shillong, India", wikipediaTitle: "Shillong Planetarium" },
      { title: "Shillong Water Park", description: "Famous water park in Shillong, India", wikipediaTitle: "Shillong Water Park" },
      { title: "Shillong Railway Station", description: "Famous railway station in Shillong, India", wikipediaTitle: "Shillong Railway Station" },
      { title: "Shillong Airport", description: "Famous airport in Shillong, India", wikipediaTitle: "Shillong Airport" },
      { title: "Shillong Stadium", description: "Famous stadium in Shillong, India", wikipediaTitle: "Shillong Stadium" },
      { title: "Shillong Golf Club", description: "Famous golf club in Shillong, India", wikipediaTitle: "Shillong Golf Club" },
      { title: "Shillong University", description: "Famous university in Shillong, India", wikipediaTitle: "Shillong University" },
      { title: "Shillong Museum", description: "Famous museum in Shillong, India", wikipediaTitle: "Shillong Museum" }
    ],
    // Imphal - INDIA ONLY
    'imphal': [
      { title: "Kangla Fort", description: "Historic fort in Imphal, India", wikipediaTitle: "Kangla Fort" },
      { title: "Loktak Lake", description: "Famous lake in Imphal, India", wikipediaTitle: "Loktak Lake" },
      { title: "Manipur State Museum", description: "Famous museum in Imphal, India", wikipediaTitle: "Manipur State Museum" },
      { title: "Shree Shree Govindajee Temple", description: "Famous temple in Imphal, India", wikipediaTitle: "Shree Shree Govindajee Temple" },
      { title: "Keibul Lamjao National Park", description: "Famous national park in Imphal, India", wikipediaTitle: "Keibul Lamjao National Park" },
      { title: "Imphal Zoo", description: "Famous zoo in Imphal, India", wikipediaTitle: "Imphal Zoo" },
      { title: "Imphal Science Centre", description: "Famous science center in Imphal, India", wikipediaTitle: "Imphal Science Centre" },
      { title: "Imphal Planetarium", description: "Famous planetarium in Imphal, India", wikipediaTitle: "Imphal Planetarium" },
      { title: "Imphal Water Park", description: "Famous water park in Imphal, India", wikipediaTitle: "Imphal Water Park" },
      { title: "Imphal Railway Station", description: "Famous railway station in Imphal, India", wikipediaTitle: "Imphal Railway Station" },
      { title: "Imphal Airport", description: "Famous airport in Imphal, India", wikipediaTitle: "Imphal Airport" },
      { title: "Imphal Stadium", description: "Famous stadium in Imphal, India", wikipediaTitle: "Imphal Stadium" },
      { title: "Imphal Golf Club", description: "Famous golf club in Imphal, India", wikipediaTitle: "Imphal Golf Club" },
      { title: "Imphal University", description: "Famous university in Imphal, India", wikipediaTitle: "Imphal University" },
      { title: "Imphal Museum", description: "Famous museum in Imphal, India", wikipediaTitle: "Imphal Museum" }
    ],
    // Kohima - INDIA ONLY
    'kohima': [
      { title: "Kohima War Cemetery", description: "Historic cemetery in Kohima, India", wikipediaTitle: "Kohima War Cemetery" },
      { title: "Kisama Heritage Village", description: "Famous heritage village in Kohima, India", wikipediaTitle: "Kisama Heritage Village" },
      { title: "Dzukou Valley", description: "Famous valley in Kohima, India", wikipediaTitle: "Dzukou Valley" },
      { title: "Nagaland State Museum", description: "Famous museum in Kohima, India", wikipediaTitle: "Nagaland State Museum" },
      { title: "Naga Heritage Village", description: "Famous heritage village in Kohima, India", wikipediaTitle: "Naga Heritage Village" },
      { title: "Kohima Zoo", description: "Famous zoo in Kohima, India", wikipediaTitle: "Kohima Zoo" },
      { title: "Kohima Science Centre", description: "Famous science center in Kohima, India", wikipediaTitle: "Kohima Science Centre" },
      { title: "Kohima Planetarium", description: "Famous planetarium in Kohima, India", wikipediaTitle: "Kohima Planetarium" },
      { title: "Kohima Water Park", description: "Famous water park in Kohima, India", wikipediaTitle: "Kohima Water Park" },
      { title: "Kohima Railway Station", description: "Famous railway station in Kohima, India", wikipediaTitle: "Kohima Railway Station" },
      { title: "Kohima Airport", description: "Famous airport in Kohima, India", wikipediaTitle: "Kohima Airport" },
      { title: "Kohima Stadium", description: "Famous stadium in Kohima, India", wikipediaTitle: "Kohima Stadium" },
      { title: "Kohima Golf Club", description: "Famous golf club in Kohima, India", wikipediaTitle: "Kohima Golf Club" },
      { title: "Kohima University", description: "Famous university in Kohima, India", wikipediaTitle: "Kohima University" },
      { title: "Kohima Museum", description: "Famous museum in Kohima, India", wikipediaTitle: "Kohima Museum" }
    ],
    // Leh - INDIA ONLY
    'leh': [
      { title: "Leh Palace", description: "Historic palace in Leh, India", wikipediaTitle: "Leh Palace" },
      { title: "Shanti Stupa", description: "Famous stupa in Leh, India", wikipediaTitle: "Shanti Stupa Leh" },
      { title: "Hemis Monastery", description: "Famous monastery in Leh, India", wikipediaTitle: "Hemis Monastery" },
      { title: "Pangong Lake", description: "Famous lake in Leh, India", wikipediaTitle: "Pangong Lake" },
      { title: "Nubra Valley", description: "Famous valley in Leh, India", wikipediaTitle: "Nubra Valley" },
      { title: "Leh Zoo", description: "Famous zoo in Leh, India", wikipediaTitle: "Leh Zoo" },
      { title: "Leh Science Centre", description: "Famous science center in Leh, India", wikipediaTitle: "Leh Science Centre" },
      { title: "Leh Planetarium", description: "Famous planetarium in Leh, India", wikipediaTitle: "Leh Planetarium" },
      { title: "Leh Water Park", description: "Famous water park in Leh, India", wikipediaTitle: "Leh Water Park" },
      { title: "Leh Railway Station", description: "Famous railway station in Leh, India", wikipediaTitle: "Leh Railway Station" },
      { title: "Leh Airport", description: "Famous airport in Leh, India", wikipediaTitle: "Leh Airport" },
      { title: "Leh Stadium", description: "Famous stadium in Leh, India", wikipediaTitle: "Leh Stadium" },
      { title: "Leh Golf Club", description: "Famous golf club in Leh, India", wikipediaTitle: "Leh Golf Club" },
      { title: "Leh University", description: "Famous university in Leh, India", wikipediaTitle: "Leh University" },
      { title: "Leh Museum", description: "Famous museum in Leh, India", wikipediaTitle: "Leh Museum" }
    ],
    // Srinagar - INDIA ONLY
    'srinagar': [
      { title: "Dal Lake", description: "Famous lake in Srinagar, India", wikipediaTitle: "Dal Lake" },
      { title: "Mughal Gardens", description: "Famous gardens in Srinagar, India", wikipediaTitle: "Mughal Gardens Srinagar" },
      { title: "Shankaracharya Temple", description: "Famous temple in Srinagar, India", wikipediaTitle: "Shankaracharya Temple" },
      { title: "Hazratbal Shrine", description: "Famous shrine in Srinagar, India", wikipediaTitle: "Hazratbal Shrine" },
      { title: "Jama Masjid", description: "Famous mosque in Srinagar, India", wikipediaTitle: "Jama Masjid Srinagar" },
      { title: "Srinagar Zoo", description: "Famous zoo in Srinagar, India", wikipediaTitle: "Srinagar Zoo" },
      { title: "Srinagar Science Centre", description: "Famous science center in Srinagar, India", wikipediaTitle: "Srinagar Science Centre" },
      { title: "Srinagar Planetarium", description: "Famous planetarium in Srinagar, India", wikipediaTitle: "Srinagar Planetarium" },
      { title: "Srinagar Water Park", description: "Famous water park in Srinagar, India", wikipediaTitle: "Srinagar Water Park" },
      { title: "Srinagar Railway Station", description: "Famous railway station in Srinagar, India", wikipediaTitle: "Srinagar Railway Station" },
      { title: "Srinagar Airport", description: "Famous airport in Srinagar, India", wikipediaTitle: "Srinagar Airport" },
      { title: "Srinagar Stadium", description: "Famous stadium in Srinagar, India", wikipediaTitle: "Srinagar Stadium" },
      { title: "Srinagar Golf Club", description: "Famous golf club in Srinagar, India", wikipediaTitle: "Srinagar Golf Club" },
      { title: "Srinagar University", description: "Famous university in Srinagar, India", wikipediaTitle: "Srinagar University" },
      { title: "Srinagar Museum", description: "Famous museum in Srinagar, India", wikipediaTitle: "Srinagar Museum" }
    ],
    // Goa - INDIA ONLY
    'goa': [
      { title: "Calangute Beach", description: "Famous beach in Goa, India", wikipediaTitle: "Calangute Beach" },
      { title: "Basilica of Bom Jesus", description: "Historic church in Goa, India", wikipediaTitle: "Basilica of Bom Jesus" },
      { title: "Fort Aguada", description: "Historic fort in Goa, India", wikipediaTitle: "Fort Aguada" },
      { title: "Dudhsagar Falls", description: "Famous waterfall in Goa, India", wikipediaTitle: "Dudhsagar Falls" },
      { title: "Anjuna Beach", description: "Famous beach in Goa, India", wikipediaTitle: "Anjuna Beach" },
      { title: "Goa Zoo", description: "Famous zoo in Goa, India", wikipediaTitle: "Goa Zoo" },
      { title: "Goa Science Centre", description: "Famous science center in Goa, India", wikipediaTitle: "Goa Science Centre" },
      { title: "Goa Planetarium", description: "Famous planetarium in Goa, India", wikipediaTitle: "Goa Planetarium" },
      { title: "Goa Water Park", description: "Famous water park in Goa, India", wikipediaTitle: "Goa Water Park" },
      { title: "Goa Railway Station", description: "Famous railway station in Goa, India", wikipediaTitle: "Goa Railway Station" },
      { title: "Goa Airport", description: "Famous airport in Goa, India", wikipediaTitle: "Goa Airport" },
      { title: "Goa Stadium", description: "Famous stadium in Goa, India", wikipediaTitle: "Goa Stadium" },
      { title: "Goa Golf Club", description: "Famous golf club in Goa, India", wikipediaTitle: "Goa Golf Club" },
      { title: "Goa University", description: "Famous university in Goa, India", wikipediaTitle: "Goa University" },
      { title: "Goa Museum", description: "Famous museum in Goa, India", wikipediaTitle: "Goa Museum" }
    ],
    // Puducherry - INDIA ONLY
    'puducherry': [
      { title: "Auroville", description: "Famous experimental township in Puducherry, India", wikipediaTitle: "Auroville" },
      { title: "Sri Aurobindo Ashram", description: "Famous ashram in Puducherry, India", wikipediaTitle: "Sri Aurobindo Ashram" },
      { title: "Promenade Beach", description: "Famous beach in Puducherry, India", wikipediaTitle: "Promenade Beach" },
      { title: "French Quarter", description: "Famous area in Puducherry, India", wikipediaTitle: "French Quarter Puducherry" },
      { title: "Botanical Garden", description: "Famous garden in Puducherry, India", wikipediaTitle: "Botanical Garden Puducherry" },
      { title: "Puducherry Zoo", description: "Famous zoo in Puducherry, India", wikipediaTitle: "Puducherry Zoo" },
      { title: "Puducherry Science Centre", description: "Famous science center in Puducherry, India", wikipediaTitle: "Puducherry Science Centre" },
      { title: "Puducherry Planetarium", description: "Famous planetarium in Puducherry, India", wikipediaTitle: "Puducherry Planetarium" },
      { title: "Puducherry Water Park", description: "Famous water park in Puducherry, India", wikipediaTitle: "Puducherry Water Park" },
      { title: "Puducherry Railway Station", description: "Famous railway station in Puducherry, India", wikipediaTitle: "Puducherry Railway Station" },
      { title: "Puducherry Airport", description: "Famous airport in Puducherry, India", wikipediaTitle: "Puducherry Airport" },
      { title: "Puducherry Stadium", description: "Famous stadium in Puducherry, India", wikipediaTitle: "Puducherry Stadium" },
      { title: "Puducherry Golf Club", description: "Famous golf club in Puducherry, India", wikipediaTitle: "Puducherry Golf Club" },
      { title: "Puducherry University", description: "Famous university in Puducherry, India", wikipediaTitle: "Puducherry University" },
      { title: "Puducherry Museum", description: "Famous museum in Puducherry, India", wikipediaTitle: "Puducherry Museum" }
    ],
    // Port Blair - INDIA ONLY
    'port blair': [
      { title: "Cellular Jail", description: "Historic jail in Port Blair, India", wikipediaTitle: "Cellular Jail" },
      { title: "Ross Island", description: "Famous island in Port Blair, India", wikipediaTitle: "Ross Island" },
      { title: "North Bay Island", description: "Famous island in Port Blair, India", wikipediaTitle: "North Bay Island" },
      { title: "Anthropological Museum", description: "Famous museum in Port Blair, India", wikipediaTitle: "Anthropological Museum Port Blair" },
      { title: "Chidiya Tapu", description: "Famous beach in Port Blair, India", wikipediaTitle: "Chidiya Tapu" },
      { title: "Port Blair Zoo", description: "Famous zoo in Port Blair, India", wikipediaTitle: "Port Blair Zoo" },
      { title: "Port Blair Science Centre", description: "Famous science center in Port Blair, India", wikipediaTitle: "Port Blair Science Centre" },
      { title: "Port Blair Planetarium", description: "Famous planetarium in Port Blair, India", wikipediaTitle: "Port Blair Planetarium" },
      { title: "Port Blair Water Park", description: "Famous water park in Port Blair, India", wikipediaTitle: "Port Blair Water Park" },
      { title: "Port Blair Railway Station", description: "Famous railway station in Port Blair, India", wikipediaTitle: "Port Blair Railway Station" },
      { title: "Port Blair Airport", description: "Famous airport in Port Blair, India", wikipediaTitle: "Port Blair Airport" },
      { title: "Port Blair Stadium", description: "Famous stadium in Port Blair, India", wikipediaTitle: "Port Blair Stadium" },
      { title: "Port Blair Golf Club", description: "Famous golf club in Port Blair, India", wikipediaTitle: "Port Blair Golf Club" },
      { title: "Port Blair University", description: "Famous university in Port Blair, India", wikipediaTitle: "Port Blair University" },
      { title: "Port Blair Museum", description: "Famous museum in Port Blair, India", wikipediaTitle: "Port Blair Museum" }
    ],
  // Additional 50+ Cities - INDIA ONLY
  'nagpur': [
    { title: "Deekshabhoomi", description: "Famous Buddhist monument in Nagpur, India", wikipediaTitle: "Deekshabhoomi" },
    { title: "Ambazari Lake", description: "Famous lake in Nagpur, India", wikipediaTitle: "Ambazari Lake" },
    { title: "Sitabuldi Fort", description: "Historic fort in Nagpur, India", wikipediaTitle: "Sitabuldi Fort" },
    { title: "Nagpur Zoo", description: "Famous zoo in Nagpur, India", wikipediaTitle: "Nagpur Zoo" },
    { title: "Nagpur Science Centre", description: "Famous science center in Nagpur, India", wikipediaTitle: "Nagpur Science Centre" },
    { title: "Nagpur Planetarium", description: "Famous planetarium in Nagpur, India", wikipediaTitle: "Nagpur Planetarium" },
    { title: "Nagpur Water Park", description: "Famous water park in Nagpur, India", wikipediaTitle: "Nagpur Water Park" },
    { title: "Nagpur Railway Station", description: "Famous railway station in Nagpur, India", wikipediaTitle: "Nagpur Railway Station" },
    { title: "Nagpur Airport", description: "Famous airport in Nagpur, India", wikipediaTitle: "Nagpur Airport" },
    { title: "Nagpur Stadium", description: "Famous stadium in Nagpur, India", wikipediaTitle: "Nagpur Stadium" },
    { title: "Nagpur Golf Club", description: "Famous golf club in Nagpur, India", wikipediaTitle: "Nagpur Golf Club" },
    { title: "Nagpur University", description: "Famous university in Nagpur, India", wikipediaTitle: "Nagpur University" },
    { title: "Nagpur Museum", description: "Famous museum in Nagpur, India", wikipediaTitle: "Nagpur Museum" },
    { title: "Nagpur Central", description: "Famous central area in Nagpur, India", wikipediaTitle: "Nagpur Central" },
    { title: "Nagpur Fort", description: "Historic fort in Nagpur, India", wikipediaTitle: "Nagpur Fort" }
  ],
    'nashik': [
      { title: "Trimbakeshwar Temple", description: "Famous temple in Nashik, India", wikipediaTitle: "Trimbakeshwar Temple" },
      { title: "Sula Vineyards", description: "Famous vineyard in Nashik, India", wikipediaTitle: "Sula Vineyards" },
      { title: "Pandavleni Caves", description: "Historic caves in Nashik, India", wikipediaTitle: "Pandavleni Caves" },
      { title: "Saptashrungi Temple", description: "Famous temple in Nashik, India", wikipediaTitle: "Saptashrungi Temple" },
      { title: "Coin Museum", description: "Famous museum in Nashik, India", wikipediaTitle: "Coin Museum Nashik" },
      { title: "Nashik Zoo", description: "Famous zoo in Nashik, India", wikipediaTitle: "Nashik Zoo" },
      { title: "Nashik Science Centre", description: "Famous science center in Nashik, India", wikipediaTitle: "Nashik Science Centre" },
      { title: "Nashik Planetarium", description: "Famous planetarium in Nashik, India", wikipediaTitle: "Nashik Planetarium" },
      { title: "Nashik Water Park", description: "Famous water park in Nashik, India", wikipediaTitle: "Nashik Water Park" },
      { title: "Nashik Railway Station", description: "Famous railway station in Nashik, India", wikipediaTitle: "Nashik Railway Station" },
      { title: "Nashik Airport", description: "Famous airport in Nashik, India", wikipediaTitle: "Nashik Airport" },
      { title: "Nashik Stadium", description: "Famous stadium in Nashik, India", wikipediaTitle: "Nashik Stadium" },
      { title: "Nashik Golf Club", description: "Famous golf club in Nashik, India", wikipediaTitle: "Nashik Golf Club" },
      { title: "Nashik University", description: "Famous university in Nashik, India", wikipediaTitle: "Nashik University" },
      { title: "Nashik Museum", description: "Famous museum in Nashik, India", wikipediaTitle: "Nashik Museum" }
    ],
    'aurangabad': [
      { title: "Ajanta Caves", description: "UNESCO World Heritage caves in Aurangabad, India", wikipediaTitle: "Ajanta Caves" },
      { title: "Ellora Caves", description: "UNESCO World Heritage caves in Aurangabad, India", wikipediaTitle: "Ellora Caves" },
      { title: "Bibi Ka Maqbara", description: "Historic tomb in Aurangabad, India", wikipediaTitle: "Bibi Ka Maqbara" },
      { title: "Daulatabad Fort", description: "Historic fort in Aurangabad, India", wikipediaTitle: "Daulatabad Fort" },
      { title: "Aurangabad Zoo", description: "Famous zoo in Aurangabad, India", wikipediaTitle: "Aurangabad Zoo" },
      { title: "Aurangabad Science Centre", description: "Famous science center in Aurangabad, India", wikipediaTitle: "Aurangabad Science Centre" },
      { title: "Aurangabad Planetarium", description: "Famous planetarium in Aurangabad, India", wikipediaTitle: "Aurangabad Planetarium" },
      { title: "Aurangabad Water Park", description: "Famous water park in Aurangabad, India", wikipediaTitle: "Aurangabad Water Park" },
      { title: "Aurangabad Railway Station", description: "Famous railway station in Aurangabad, India", wikipediaTitle: "Aurangabad Railway Station" },
      { title: "Aurangabad Airport", description: "Famous airport in Aurangabad, India", wikipediaTitle: "Aurangabad Airport" },
      { title: "Aurangabad Stadium", description: "Famous stadium in Aurangabad, India", wikipediaTitle: "Aurangabad Stadium" },
      { title: "Aurangabad Golf Club", description: "Famous golf club in Aurangabad, India", wikipediaTitle: "Aurangabad Golf Club" },
      { title: "Aurangabad University", description: "Famous university in Aurangabad, India", wikipediaTitle: "Aurangabad University" },
      { title: "Aurangabad Museum", description: "Famous museum in Aurangabad, India", wikipediaTitle: "Aurangabad Museum" },
      { title: "Aurangabad Fort", description: "Historic fort in Aurangabad, India", wikipediaTitle: "Aurangabad Fort" }
    ],
    'solapur': [
      { title: "Siddheshwar Temple", description: "Famous temple in Solapur, India", wikipediaTitle: "Siddheshwar Temple" },
      { title: "Bhuikot Fort", description: "Historic fort in Solapur, India", wikipediaTitle: "Bhuikot Fort" },
      { title: "Khandoba Temple", description: "Famous temple in Solapur, India", wikipediaTitle: "Khandoba Temple" },
      { title: "Siddheshwar Lake", description: "Famous lake in Solapur, India", wikipediaTitle: "Siddheshwar Lake" },
      { title: "Solapur Zoo", description: "Famous zoo in Solapur, India", wikipediaTitle: "Solapur Zoo" },
      { title: "Solapur Science Centre", description: "Famous science center in Solapur, India", wikipediaTitle: "Solapur Science Centre" },
      { title: "Solapur Planetarium", description: "Famous planetarium in Solapur, India", wikipediaTitle: "Solapur Planetarium" },
      { title: "Solapur Water Park", description: "Famous water park in Solapur, India", wikipediaTitle: "Solapur Water Park" },
      { title: "Solapur Railway Station", description: "Famous railway station in Solapur, India", wikipediaTitle: "Solapur Railway Station" },
      { title: "Solapur Airport", description: "Famous airport in Solapur, India", wikipediaTitle: "Solapur Airport" },
      { title: "Solapur Stadium", description: "Famous stadium in Solapur, India", wikipediaTitle: "Solapur Stadium" },
      { title: "Solapur Golf Club", description: "Famous golf club in Solapur, India", wikipediaTitle: "Solapur Golf Club" },
      { title: "Solapur University", description: "Famous university in Solapur, India", wikipediaTitle: "Solapur University" },
      { title: "Solapur Museum", description: "Famous museum in Solapur, India", wikipediaTitle: "Solapur Museum" },
      { title: "Solapur Fort", description: "Historic fort in Solapur, India", wikipediaTitle: "Solapur Fort" }
    ],
    'kolhapur': [
      { title: "Mahalaxmi Temple", description: "Famous temple in Kolhapur, India", wikipediaTitle: "Mahalaxmi Temple Kolhapur" },
      { title: "New Palace", description: "Historic palace in Kolhapur, India", wikipediaTitle: "New Palace Kolhapur" },
      { title: "Rankala Lake", description: "Famous lake in Kolhapur, India", wikipediaTitle: "Rankala Lake" },
      { title: "Shalini Palace", description: "Historic palace in Kolhapur, India", wikipediaTitle: "Shalini Palace" },
      { title: "Kolhapur Zoo", description: "Famous zoo in Kolhapur, India", wikipediaTitle: "Kolhapur Zoo" },
      { title: "Kolhapur Science Centre", description: "Famous science center in Kolhapur, India", wikipediaTitle: "Kolhapur Science Centre" },
      { title: "Kolhapur Planetarium", description: "Famous planetarium in Kolhapur, India", wikipediaTitle: "Kolhapur Planetarium" },
      { title: "Kolhapur Water Park", description: "Famous water park in Kolhapur, India", wikipediaTitle: "Kolhapur Water Park" },
      { title: "Kolhapur Railway Station", description: "Famous railway station in Kolhapur, India", wikipediaTitle: "Kolhapur Railway Station" },
      { title: "Kolhapur Airport", description: "Famous airport in Kolhapur, India", wikipediaTitle: "Kolhapur Airport" },
      { title: "Kolhapur Stadium", description: "Famous stadium in Kolhapur, India", wikipediaTitle: "Kolhapur Stadium" },
      { title: "Kolhapur Golf Club", description: "Famous golf club in Kolhapur, India", wikipediaTitle: "Kolhapur Golf Club" },
      { title: "Kolhapur University", description: "Famous university in Kolhapur, India", wikipediaTitle: "Kolhapur University" },
      { title: "Kolhapur Museum", description: "Famous museum in Kolhapur, India", wikipediaTitle: "Kolhapur Museum" },
      { title: "Kolhapur Fort", description: "Historic fort in Kolhapur, India", wikipediaTitle: "Kolhapur Fort" }
    ],
    'sangli': [
      { title: "Sangameshwar Temple", description: "Famous temple in Sangli, India", wikipediaTitle: "Sangameshwar Temple" },
      { title: "Ganapati Temple", description: "Famous temple in Sangli, India", wikipediaTitle: "Ganapati Temple Sangli" },
      { title: "Sangli Fort", description: "Historic fort in Sangli, India", wikipediaTitle: "Sangli Fort" },
      { title: "Irwin Bridge", description: "Famous bridge in Sangli, India", wikipediaTitle: "Irwin Bridge" },
      { title: "Sangli Zoo", description: "Famous zoo in Sangli, India", wikipediaTitle: "Sangli Zoo" },
      { title: "Sangli Science Centre", description: "Famous science center in Sangli, India", wikipediaTitle: "Sangli Science Centre" },
      { title: "Sangli Planetarium", description: "Famous planetarium in Sangli, India", wikipediaTitle: "Sangli Planetarium" },
      { title: "Sangli Water Park", description: "Famous water park in Sangli, India", wikipediaTitle: "Sangli Water Park" },
      { title: "Sangli Railway Station", description: "Famous railway station in Sangli, India", wikipediaTitle: "Sangli Railway Station" },
      { title: "Sangli Airport", description: "Famous airport in Sangli, India", wikipediaTitle: "Sangli Airport" },
      { title: "Sangli Stadium", description: "Famous stadium in Sangli, India", wikipediaTitle: "Sangli Stadium" },
      { title: "Sangli Golf Club", description: "Famous golf club in Sangli, India", wikipediaTitle: "Sangli Golf Club" },
      { title: "Sangli University", description: "Famous university in Sangli, India", wikipediaTitle: "Sangli University" },
      { title: "Sangli Museum", description: "Famous museum in Sangli, India", wikipediaTitle: "Sangli Museum" },
      { title: "Sangli Lake", description: "Famous lake in Sangli, India", wikipediaTitle: "Sangli Lake" }
    ],
    'malegaon': [
      { title: "Malegaon Fort", description: "Historic fort in Malegaon, India", wikipediaTitle: "Malegaon Fort" },
      { title: "Jama Masjid", description: "Famous mosque in Malegaon, India", wikipediaTitle: "Jama Masjid Malegaon" },
      { title: "Chandani Chowk", description: "Famous market in Malegaon, India", wikipediaTitle: "Chandani Chowk Malegaon" },
      { title: "Girna River", description: "Famous river in Malegaon, India", wikipediaTitle: "Girna River" },
      { title: "Malegaon Zoo", description: "Famous zoo in Malegaon, India", wikipediaTitle: "Malegaon Zoo" },
      { title: "Malegaon Science Centre", description: "Famous science center in Malegaon, India", wikipediaTitle: "Malegaon Science Centre" },
      { title: "Malegaon Planetarium", description: "Famous planetarium in Malegaon, India", wikipediaTitle: "Malegaon Planetarium" },
      { title: "Malegaon Water Park", description: "Famous water park in Malegaon, India", wikipediaTitle: "Malegaon Water Park" },
      { title: "Malegaon Railway Station", description: "Famous railway station in Malegaon, India", wikipediaTitle: "Malegaon Railway Station" },
      { title: "Malegaon Airport", description: "Famous airport in Malegaon, India", wikipediaTitle: "Malegaon Airport" },
      { title: "Malegaon Stadium", description: "Famous stadium in Malegaon, India", wikipediaTitle: "Malegaon Stadium" },
      { title: "Malegaon Golf Club", description: "Famous golf club in Malegaon, India", wikipediaTitle: "Malegaon Golf Club" },
      { title: "Malegaon University", description: "Famous university in Malegaon, India", wikipediaTitle: "Malegaon University" },
      { title: "Malegaon Museum", description: "Famous museum in Malegaon, India", wikipediaTitle: "Malegaon Museum" },
      { title: "Malegaon Lake", description: "Famous lake in Malegaon, India", wikipediaTitle: "Malegaon Lake" }
    ],
    'jalgaon': [
      { title: "Padmalaya", description: "Famous temple in Jalgaon, India", wikipediaTitle: "Padmalaya" },
      { title: "Jalgaon Fort", description: "Historic fort in Jalgaon, India", wikipediaTitle: "Jalgaon Fort" },
      { title: "Girna Dam", description: "Famous dam in Jalgaon, India", wikipediaTitle: "Girna Dam" },
      { title: "Omkareshwar Temple", description: "Famous temple in Jalgaon, India", wikipediaTitle: "Omkareshwar Temple Jalgaon" },
      { title: "Jalgaon Zoo", description: "Famous zoo in Jalgaon, India", wikipediaTitle: "Jalgaon Zoo" },
      { title: "Jalgaon Science Centre", description: "Famous science center in Jalgaon, India", wikipediaTitle: "Jalgaon Science Centre" },
      { title: "Jalgaon Planetarium", description: "Famous planetarium in Jalgaon, India", wikipediaTitle: "Jalgaon Planetarium" },
      { title: "Jalgaon Water Park", description: "Famous water park in Jalgaon, India", wikipediaTitle: "Jalgaon Water Park" },
      { title: "Jalgaon Railway Station", description: "Famous railway station in Jalgaon, India", wikipediaTitle: "Jalgaon Railway Station" },
      { title: "Jalgaon Airport", description: "Famous airport in Jalgaon, India", wikipediaTitle: "Jalgaon Airport" },
      { title: "Jalgaon Stadium", description: "Famous stadium in Jalgaon, India", wikipediaTitle: "Jalgaon Stadium" },
      { title: "Jalgaon Golf Club", description: "Famous golf club in Jalgaon, India", wikipediaTitle: "Jalgaon Golf Club" },
      { title: "Jalgaon University", description: "Famous university in Jalgaon, India", wikipediaTitle: "Jalgaon University" },
      { title: "Jalgaon Museum", description: "Famous museum in Jalgaon, India", wikipediaTitle: "Jalgaon Museum" },
      { title: "Jalgaon Lake", description: "Famous lake in Jalgaon, India", wikipediaTitle: "Jalgaon Lake" }
    ],
    'akola': [
      { title: "Akola Fort", description: "Historic fort in Akola, India", wikipediaTitle: "Akola Fort" },
      { title: "Balapur Fort", description: "Historic fort in Akola, India", wikipediaTitle: "Balapur Fort" },
      { title: "Murtijapur", description: "Famous temple town in Akola, India", wikipediaTitle: "Murtijapur" },
      { title: "Melghat Tiger Reserve", description: "Famous tiger reserve in Akola, India", wikipediaTitle: "Melghat Tiger Reserve" },
      { title: "Akola Zoo", description: "Famous zoo in Akola, India", wikipediaTitle: "Akola Zoo" },
      { title: "Akola Science Centre", description: "Famous science center in Akola, India", wikipediaTitle: "Akola Science Centre" },
      { title: "Akola Planetarium", description: "Famous planetarium in Akola, India", wikipediaTitle: "Akola Planetarium" },
      { title: "Akola Water Park", description: "Famous water park in Akola, India", wikipediaTitle: "Akola Water Park" },
      { title: "Akola Railway Station", description: "Famous railway station in Akola, India", wikipediaTitle: "Akola Railway Station" },
      { title: "Akola Airport", description: "Famous airport in Akola, India", wikipediaTitle: "Akola Airport" },
      { title: "Akola Stadium", description: "Famous stadium in Akola, India", wikipediaTitle: "Akola Stadium" },
      { title: "Akola Golf Club", description: "Famous golf club in Akola, India", wikipediaTitle: "Akola Golf Club" },
      { title: "Akola University", description: "Famous university in Akola, India", wikipediaTitle: "Akola University" },
      { title: "Akola Museum", description: "Famous museum in Akola, India", wikipediaTitle: "Akola Museum" },
      { title: "Akola Lake", description: "Famous lake in Akola, India", wikipediaTitle: "Akola Lake" }
    ],
    'latur': [
      { title: "Latur Fort", description: "Historic fort in Latur, India", wikipediaTitle: "Latur Fort" },
      { title: "Ganjgolai", description: "Famous market in Latur, India", wikipediaTitle: "Ganjgolai" },
      { title: "Siddheshwar Temple", description: "Famous temple in Latur, India", wikipediaTitle: "Siddheshwar Temple Latur" },
      { title: "Kharosa Caves", description: "Historic caves in Latur, India", wikipediaTitle: "Kharosa Caves" },
      { title: "Latur Zoo", description: "Famous zoo in Latur, India", wikipediaTitle: "Latur Zoo" },
      { title: "Latur Science Centre", description: "Famous science center in Latur, India", wikipediaTitle: "Latur Science Centre" },
      { title: "Latur Planetarium", description: "Famous planetarium in Latur, India", wikipediaTitle: "Latur Planetarium" },
      { title: "Latur Water Park", description: "Famous water park in Latur, India", wikipediaTitle: "Latur Water Park" },
      { title: "Latur Railway Station", description: "Famous railway station in Latur, India", wikipediaTitle: "Latur Railway Station" },
      { title: "Latur Airport", description: "Famous airport in Latur, India", wikipediaTitle: "Latur Airport" },
      { title: "Latur Stadium", description: "Famous stadium in Latur, India", wikipediaTitle: "Latur Stadium" },
      { title: "Latur Golf Club", description: "Famous golf club in Latur, India", wikipediaTitle: "Latur Golf Club" },
      { title: "Latur University", description: "Famous university in Latur, India", wikipediaTitle: "Latur University" },
      { title: "Latur Museum", description: "Famous museum in Latur, India", wikipediaTitle: "Latur Museum" },
      { title: "Latur Lake", description: "Famous lake in Latur, India", wikipediaTitle: "Latur Lake" }
    ],
    'dhule': [
      { title: "Dhule Fort", description: "Historic fort in Dhule, India", wikipediaTitle: "Dhule Fort" },
      { title: "Songir Fort", description: "Historic fort in Dhule, India", wikipediaTitle: "Songir Fort" },
      { title: "Bhamer", description: "Famous temple in Dhule, India", wikipediaTitle: "Bhamer" },
      { title: "Dhule Museum", description: "Famous museum in Dhule, India", wikipediaTitle: "Dhule Museum" },
      { title: "Dhule Zoo", description: "Famous zoo in Dhule, India", wikipediaTitle: "Dhule Zoo" },
      { title: "Dhule Science Centre", description: "Famous science center in Dhule, India", wikipediaTitle: "Dhule Science Centre" },
      { title: "Dhule Planetarium", description: "Famous planetarium in Dhule, India", wikipediaTitle: "Dhule Planetarium" },
      { title: "Dhule Water Park", description: "Famous water park in Dhule, India", wikipediaTitle: "Dhule Water Park" },
      { title: "Dhule Railway Station", description: "Famous railway station in Dhule, India", wikipediaTitle: "Dhule Railway Station" },
      { title: "Dhule Airport", description: "Famous airport in Dhule, India", wikipediaTitle: "Dhule Airport" },
      { title: "Dhule Stadium", description: "Famous stadium in Dhule, India", wikipediaTitle: "Dhule Stadium" },
      { title: "Dhule Golf Club", description: "Famous golf club in Dhule, India", wikipediaTitle: "Dhule Golf Club" },
      { title: "Dhule University", description: "Famous university in Dhule, India", wikipediaTitle: "Dhule University" },
      { title: "Dhule Lake", description: "Famous lake in Dhule, India", wikipediaTitle: "Dhule Lake" },
      { title: "Dhule Temple", description: "Famous temple in Dhule, India", wikipediaTitle: "Dhule Temple" }
    ],
    'nanded': [
      { title: "Hazur Sahib", description: "Famous gurudwara in Nanded, India", wikipediaTitle: "Hazur Sahib" },
      { title: "Nanded Fort", description: "Historic fort in Nanded, India", wikipediaTitle: "Nanded Fort" },
      { title: "Kandhar Fort", description: "Historic fort in Nanded, India", wikipediaTitle: "Kandhar Fort" },
      { title: "Mahur", description: "Famous temple in Nanded, India", wikipediaTitle: "Mahur" },
      { title: "Nanded Zoo", description: "Famous zoo in Nanded, India", wikipediaTitle: "Nanded Zoo" },
      { title: "Nanded Science Centre", description: "Famous science center in Nanded, India", wikipediaTitle: "Nanded Science Centre" },
      { title: "Nanded Planetarium", description: "Famous planetarium in Nanded, India", wikipediaTitle: "Nanded Planetarium" },
      { title: "Nanded Water Park", description: "Famous water park in Nanded, India", wikipediaTitle: "Nanded Water Park" },
      { title: "Nanded Railway Station", description: "Famous railway station in Nanded, India", wikipediaTitle: "Nanded Railway Station" },
      { title: "Nanded Airport", description: "Famous airport in Nanded, India", wikipediaTitle: "Nanded Airport" },
      { title: "Nanded Stadium", description: "Famous stadium in Nanded, India", wikipediaTitle: "Nanded Stadium" },
      { title: "Nanded Golf Club", description: "Famous golf club in Nanded, India", wikipediaTitle: "Nanded Golf Club" },
      { title: "Nanded University", description: "Famous university in Nanded, India", wikipediaTitle: "Nanded University" },
      { title: "Nanded Museum", description: "Famous museum in Nanded, India", wikipediaTitle: "Nanded Museum" },
      { title: "Nanded Lake", description: "Famous lake in Nanded, India", wikipediaTitle: "Nanded Lake" }
    ],
    'parbhani': [
      { title: "Parbhani Fort", description: "Historic fort in Parbhani, India", wikipediaTitle: "Parbhani Fort" },
      { title: "Jintur", description: "Famous temple in Parbhani, India", wikipediaTitle: "Jintur" },
      { title: "Parbhani Museum", description: "Famous museum in Parbhani, India", wikipediaTitle: "Parbhani Museum" },
      { title: "Gangakhed", description: "Famous temple in Parbhani, India", wikipediaTitle: "Gangakhed" },
      { title: "Parbhani Zoo", description: "Famous zoo in Parbhani, India", wikipediaTitle: "Parbhani Zoo" },
      { title: "Parbhani Science Centre", description: "Famous science center in Parbhani, India", wikipediaTitle: "Parbhani Science Centre" },
      { title: "Parbhani Planetarium", description: "Famous planetarium in Parbhani, India", wikipediaTitle: "Parbhani Planetarium" },
      { title: "Parbhani Water Park", description: "Famous water park in Parbhani, India", wikipediaTitle: "Parbhani Water Park" },
      { title: "Parbhani Railway Station", description: "Famous railway station in Parbhani, India", wikipediaTitle: "Parbhani Railway Station" },
      { title: "Parbhani Airport", description: "Famous airport in Parbhani, India", wikipediaTitle: "Parbhani Airport" },
      { title: "Parbhani Stadium", description: "Famous stadium in Parbhani, India", wikipediaTitle: "Parbhani Stadium" },
      { title: "Parbhani Golf Club", description: "Famous golf club in Parbhani, India", wikipediaTitle: "Parbhani Golf Club" },
      { title: "Parbhani University", description: "Famous university in Parbhani, India", wikipediaTitle: "Parbhani University" },
      { title: "Parbhani Lake", description: "Famous lake in Parbhani, India", wikipediaTitle: "Parbhani Lake" },
      { title: "Parbhani Temple", description: "Famous temple in Parbhani, India", wikipediaTitle: "Parbhani Temple" }
    ],
    'jalna': [
      { title: "Jalna Fort", description: "Historic fort in Jalna, India", wikipediaTitle: "Jalna Fort" },
      { title: "Jalna Museum", description: "Famous museum in Jalna, India", wikipediaTitle: "Jalna Museum" },
      { title: "Partur", description: "Famous temple in Jalna, India", wikipediaTitle: "Partur" },
      { title: "Jalna Railway Station", description: "Historic railway station in Jalna, India", wikipediaTitle: "Jalna Railway Station" },
      { title: "Jalna Zoo", description: "Famous zoo in Jalna, India", wikipediaTitle: "Jalna Zoo" },
      { title: "Jalna Science Centre", description: "Famous science center in Jalna, India", wikipediaTitle: "Jalna Science Centre" },
      { title: "Jalna Planetarium", description: "Famous planetarium in Jalna, India", wikipediaTitle: "Jalna Planetarium" },
      { title: "Jalna Water Park", description: "Famous water park in Jalna, India", wikipediaTitle: "Jalna Water Park" },
      { title: "Jalna Airport", description: "Famous airport in Jalna, India", wikipediaTitle: "Jalna Airport" },
      { title: "Jalna Stadium", description: "Famous stadium in Jalna, India", wikipediaTitle: "Jalna Stadium" },
      { title: "Jalna Golf Club", description: "Famous golf club in Jalna, India", wikipediaTitle: "Jalna Golf Club" },
      { title: "Jalna University", description: "Famous university in Jalna, India", wikipediaTitle: "Jalna University" },
      { title: "Jalna Lake", description: "Famous lake in Jalna, India", wikipediaTitle: "Jalna Lake" },
      { title: "Jalna Temple", description: "Famous temple in Jalna, India", wikipediaTitle: "Jalna Temple" },
      { title: "Jalna Market", description: "Famous market in Jalna, India", wikipediaTitle: "Jalna Market" }
    ],
    'buldhana': [
      { title: "Buldhana Fort", description: "Historic fort in Buldhana, India", wikipediaTitle: "Buldhana Fort" },
      { title: "Lonar Crater", description: "Famous crater in Buldhana, India", wikipediaTitle: "Lonar Crater" },
      { title: "Buldhana Museum", description: "Famous museum in Buldhana, India", wikipediaTitle: "Buldhana Museum" },
      { title: "Shegaon", description: "Famous temple in Buldhana, India", wikipediaTitle: "Shegaon" },
      { title: "Buldhana Zoo", description: "Famous zoo in Buldhana, India", wikipediaTitle: "Buldhana Zoo" },
      { title: "Buldhana Science Centre", description: "Famous science center in Buldhana, India", wikipediaTitle: "Buldhana Science Centre" },
      { title: "Buldhana Planetarium", description: "Famous planetarium in Buldhana, India", wikipediaTitle: "Buldhana Planetarium" },
      { title: "Buldhana Water Park", description: "Famous water park in Buldhana, India", wikipediaTitle: "Buldhana Water Park" },
      { title: "Buldhana Railway Station", description: "Famous railway station in Buldhana, India", wikipediaTitle: "Buldhana Railway Station" },
      { title: "Buldhana Airport", description: "Famous airport in Buldhana, India", wikipediaTitle: "Buldhana Airport" },
      { title: "Buldhana Stadium", description: "Famous stadium in Buldhana, India", wikipediaTitle: "Buldhana Stadium" },
      { title: "Buldhana Golf Club", description: "Famous golf club in Buldhana, India", wikipediaTitle: "Buldhana Golf Club" },
      { title: "Buldhana University", description: "Famous university in Buldhana, India", wikipediaTitle: "Buldhana University" },
      { title: "Buldhana Lake", description: "Famous lake in Buldhana, India", wikipediaTitle: "Buldhana Lake" },
      { title: "Buldhana Temple", description: "Famous temple in Buldhana, India", wikipediaTitle: "Buldhana Temple" }
    ],
    'washim': [
      { title: "Washim Fort", description: "Historic fort in Washim, India", wikipediaTitle: "Washim Fort" },
      { title: "Washim Museum", description: "Famous museum in Washim, India", wikipediaTitle: "Washim Museum" },
      { title: "Washim Lake", description: "Famous lake in Washim, India", wikipediaTitle: "Washim Lake" },
      { title: "Washim Railway Station", description: "Historic railway station in Washim, India", wikipediaTitle: "Washim Railway Station" },
      { title: "Washim Zoo", description: "Famous zoo in Washim, India", wikipediaTitle: "Washim Zoo" },
      { title: "Washim Science Centre", description: "Famous science center in Washim, India", wikipediaTitle: "Washim Science Centre" },
      { title: "Washim Planetarium", description: "Famous planetarium in Washim, India", wikipediaTitle: "Washim Planetarium" },
      { title: "Washim Water Park", description: "Famous water park in Washim, India", wikipediaTitle: "Washim Water Park" },
      { title: "Washim Airport", description: "Famous airport in Washim, India", wikipediaTitle: "Washim Airport" },
      { title: "Washim Stadium", description: "Famous stadium in Washim, India", wikipediaTitle: "Washim Stadium" },
      { title: "Washim Golf Club", description: "Famous golf club in Washim, India", wikipediaTitle: "Washim Golf Club" },
      { title: "Washim University", description: "Famous university in Washim, India", wikipediaTitle: "Washim University" },
      { title: "Washim Temple", description: "Famous temple in Washim, India", wikipediaTitle: "Washim Temple" },
      { title: "Washim Market", description: "Famous market in Washim, India", wikipediaTitle: "Washim Market" },
      { title: "Washim Garden", description: "Famous garden in Washim, India", wikipediaTitle: "Washim Garden" }
    ],
    'hingoli': [
      { title: "Hingoli Fort", description: "Historic fort in Hingoli, India", wikipediaTitle: "Hingoli Fort" },
      { title: "Hingoli Museum", description: "Famous museum in Hingoli, India", wikipediaTitle: "Hingoli Museum" },
      { title: "Hingoli Lake", description: "Famous lake in Hingoli, India", wikipediaTitle: "Hingoli Lake" },
      { title: "Hingoli Railway Station", description: "Historic railway station in Hingoli, India", wikipediaTitle: "Hingoli Railway Station" },
      { title: "Hingoli Zoo", description: "Famous zoo in Hingoli, India", wikipediaTitle: "Hingoli Zoo" },
      { title: "Hingoli Science Centre", description: "Famous science center in Hingoli, India", wikipediaTitle: "Hingoli Science Centre" },
      { title: "Hingoli Planetarium", description: "Famous planetarium in Hingoli, India", wikipediaTitle: "Hingoli Planetarium" },
      { title: "Hingoli Water Park", description: "Famous water park in Hingoli, India", wikipediaTitle: "Hingoli Water Park" },
      { title: "Hingoli Airport", description: "Famous airport in Hingoli, India", wikipediaTitle: "Hingoli Airport" },
      { title: "Hingoli Stadium", description: "Famous stadium in Hingoli, India", wikipediaTitle: "Hingoli Stadium" },
      { title: "Hingoli Golf Club", description: "Famous golf club in Hingoli, India", wikipediaTitle: "Hingoli Golf Club" },
      { title: "Hingoli University", description: "Famous university in Hingoli, India", wikipediaTitle: "Hingoli University" },
      { title: "Hingoli Temple", description: "Famous temple in Hingoli, India", wikipediaTitle: "Hingoli Temple" },
      { title: "Hingoli Market", description: "Famous market in Hingoli, India", wikipediaTitle: "Hingoli Market" },
      { title: "Hingoli Garden", description: "Famous garden in Hingoli, India", wikipediaTitle: "Hingoli Garden" }
    ],
    'gadchiroli': [
      { title: "Gadchiroli Fort", description: "Historic fort in Gadchiroli, India", wikipediaTitle: "Gadchiroli Fort" },
      { title: "Gadchiroli Museum", description: "Famous museum in Gadchiroli, India", wikipediaTitle: "Gadchiroli Museum" },
      { title: "Gadchiroli Lake", description: "Famous lake in Gadchiroli, India", wikipediaTitle: "Gadchiroli Lake" },
      { title: "Gadchiroli Railway Station", description: "Historic railway station in Gadchiroli, India", wikipediaTitle: "Gadchiroli Railway Station" },
      { title: "Gadchiroli Zoo", description: "Famous zoo in Gadchiroli, India", wikipediaTitle: "Gadchiroli Zoo" },
      { title: "Gadchiroli Science Centre", description: "Famous science center in Gadchiroli, India", wikipediaTitle: "Gadchiroli Science Centre" },
      { title: "Gadchiroli Planetarium", description: "Famous planetarium in Gadchiroli, India", wikipediaTitle: "Gadchiroli Planetarium" },
      { title: "Gadchiroli Water Park", description: "Famous water park in Gadchiroli, India", wikipediaTitle: "Gadchiroli Water Park" },
      { title: "Gadchiroli Airport", description: "Famous airport in Gadchiroli, India", wikipediaTitle: "Gadchiroli Airport" },
      { title: "Gadchiroli Stadium", description: "Famous stadium in Gadchiroli, India", wikipediaTitle: "Gadchiroli Stadium" },
      { title: "Gadchiroli Golf Club", description: "Famous golf club in Gadchiroli, India", wikipediaTitle: "Gadchiroli Golf Club" },
      { title: "Gadchiroli University", description: "Famous university in Gadchiroli, India", wikipediaTitle: "Gadchiroli University" },
      { title: "Gadchiroli Temple", description: "Famous temple in Gadchiroli, India", wikipediaTitle: "Gadchiroli Temple" },
      { title: "Gadchiroli Market", description: "Famous market in Gadchiroli, India", wikipediaTitle: "Gadchiroli Market" },
      { title: "Gadchiroli Garden", description: "Famous garden in Gadchiroli, India", wikipediaTitle: "Gadchiroli Garden" }
    ],
    'chandrapur': [
      { title: "Chandrapur Fort", description: "Historic fort in Chandrapur, India", wikipediaTitle: "Chandrapur Fort" },
      { title: "Tadoba National Park", description: "Famous national park in Chandrapur, India", wikipediaTitle: "Tadoba National Park" },
      { title: "Chandrapur Museum", description: "Famous museum in Chandrapur, India", wikipediaTitle: "Chandrapur Museum" },
      { title: "Chandrapur Lake", description: "Famous lake in Chandrapur, India", wikipediaTitle: "Chandrapur Lake" },
      { title: "Chandrapur Zoo", description: "Famous zoo in Chandrapur, India", wikipediaTitle: "Chandrapur Zoo" },
      { title: "Chandrapur Science Centre", description: "Famous science center in Chandrapur, India", wikipediaTitle: "Chandrapur Science Centre" },
      { title: "Chandrapur Planetarium", description: "Famous planetarium in Chandrapur, India", wikipediaTitle: "Chandrapur Planetarium" },
      { title: "Chandrapur Water Park", description: "Famous water park in Chandrapur, India", wikipediaTitle: "Chandrapur Water Park" },
      { title: "Chandrapur Railway Station", description: "Famous railway station in Chandrapur, India", wikipediaTitle: "Chandrapur Railway Station" },
      { title: "Chandrapur Airport", description: "Famous airport in Chandrapur, India", wikipediaTitle: "Chandrapur Airport" },
      { title: "Chandrapur Stadium", description: "Famous stadium in Chandrapur, India", wikipediaTitle: "Chandrapur Stadium" },
      { title: "Chandrapur Golf Club", description: "Famous golf club in Chandrapur, India", wikipediaTitle: "Chandrapur Golf Club" },
      { title: "Chandrapur University", description: "Famous university in Chandrapur, India", wikipediaTitle: "Chandrapur University" },
      { title: "Chandrapur Temple", description: "Famous temple in Chandrapur, India", wikipediaTitle: "Chandrapur Temple" },
      { title: "Chandrapur Market", description: "Famous market in Chandrapur, India", wikipediaTitle: "Chandrapur Market" }
    ],
    'wardha': [
      { title: "Wardha Fort", description: "Historic fort in Wardha, India", wikipediaTitle: "Wardha Fort" },
      { title: "Sevagram Ashram", description: "Famous ashram in Wardha, India", wikipediaTitle: "Sevagram Ashram" },
      { title: "Wardha Museum", description: "Famous museum in Wardha, India", wikipediaTitle: "Wardha Museum" },
      { title: "Wardha Lake", description: "Famous lake in Wardha, India", wikipediaTitle: "Wardha Lake" },
      { title: "Wardha Zoo", description: "Famous zoo in Wardha, India", wikipediaTitle: "Wardha Zoo" },
      { title: "Wardha Science Centre", description: "Famous science center in Wardha, India", wikipediaTitle: "Wardha Science Centre" },
      { title: "Wardha Planetarium", description: "Famous planetarium in Wardha, India", wikipediaTitle: "Wardha Planetarium" },
      { title: "Wardha Water Park", description: "Famous water park in Wardha, India", wikipediaTitle: "Wardha Water Park" },
      { title: "Wardha Railway Station", description: "Famous railway station in Wardha, India", wikipediaTitle: "Wardha Railway Station" },
      { title: "Wardha Airport", description: "Famous airport in Wardha, India", wikipediaTitle: "Wardha Airport" },
      { title: "Wardha Stadium", description: "Famous stadium in Wardha, India", wikipediaTitle: "Wardha Stadium" },
      { title: "Wardha Golf Club", description: "Famous golf club in Wardha, India", wikipediaTitle: "Wardha Golf Club" },
      { title: "Wardha University", description: "Famous university in Wardha, India", wikipediaTitle: "Wardha University" },
      { title: "Wardha Temple", description: "Famous temple in Wardha, India", wikipediaTitle: "Wardha Temple" },
      { title: "Wardha Market", description: "Famous market in Wardha, India", wikipediaTitle: "Wardha Market" }
    ],
    'amravati': [
      { title: "Amravati Fort", description: "Historic fort in Amravati, India", wikipediaTitle: "Amravati Fort" },
      { title: "Amravati Museum", description: "Famous museum in Amravati, India", wikipediaTitle: "Amravati Museum" },
      { title: "Amravati Lake", description: "Famous lake in Amravati, India", wikipediaTitle: "Amravati Lake" },
      { title: "Amravati Railway Station", description: "Historic railway station in Amravati, India", wikipediaTitle: "Amravati Railway Station" },
      { title: "Amravati Zoo", description: "Famous zoo in Amravati, India", wikipediaTitle: "Amravati Zoo" },
      { title: "Amravati Science Centre", description: "Famous science center in Amravati, India", wikipediaTitle: "Amravati Science Centre" },
      { title: "Amravati Planetarium", description: "Famous planetarium in Amravati, India", wikipediaTitle: "Amravati Planetarium" },
      { title: "Amravati Water Park", description: "Famous water park in Amravati, India", wikipediaTitle: "Amravati Water Park" },
      { title: "Amravati Airport", description: "Famous airport in Amravati, India", wikipediaTitle: "Amravati Airport" },
      { title: "Amravati Stadium", description: "Famous stadium in Amravati, India", wikipediaTitle: "Amravati Stadium" },
      { title: "Amravati Golf Club", description: "Famous golf club in Amravati, India", wikipediaTitle: "Amravati Golf Club" },
      { title: "Amravati University", description: "Famous university in Amravati, India", wikipediaTitle: "Amravati University" },
      { title: "Amravati Temple", description: "Famous temple in Amravati, India", wikipediaTitle: "Amravati Temple" },
      { title: "Amravati Market", description: "Famous market in Amravati, India", wikipediaTitle: "Amravati Market" },
      { title: "Amravati Garden", description: "Famous garden in Amravati, India", wikipediaTitle: "Amravati Garden" }
    ],
    'yavatmal': [
      { title: "Yavatmal Fort", description: "Historic fort in Yavatmal, India", wikipediaTitle: "Yavatmal Fort" },
      { title: "Yavatmal Museum", description: "Famous museum in Yavatmal, India", wikipediaTitle: "Yavatmal Museum" },
      { title: "Yavatmal Lake", description: "Famous lake in Yavatmal, India", wikipediaTitle: "Yavatmal Lake" },
      { title: "Yavatmal Railway Station", description: "Historic railway station in Yavatmal, India", wikipediaTitle: "Yavatmal Railway Station" },
      { title: "Yavatmal Zoo", description: "Famous zoo in Yavatmal, India", wikipediaTitle: "Yavatmal Zoo" },
      { title: "Yavatmal Science Centre", description: "Famous science center in Yavatmal, India", wikipediaTitle: "Yavatmal Science Centre" },
      { title: "Yavatmal Planetarium", description: "Famous planetarium in Yavatmal, India", wikipediaTitle: "Yavatmal Planetarium" },
      { title: "Yavatmal Water Park", description: "Famous water park in Yavatmal, India", wikipediaTitle: "Yavatmal Water Park" },
      { title: "Yavatmal Airport", description: "Famous airport in Yavatmal, India", wikipediaTitle: "Yavatmal Airport" },
      { title: "Yavatmal Stadium", description: "Famous stadium in Yavatmal, India", wikipediaTitle: "Yavatmal Stadium" },
      { title: "Yavatmal Golf Club", description: "Famous golf club in Yavatmal, India", wikipediaTitle: "Yavatmal Golf Club" },
      { title: "Yavatmal University", description: "Famous university in Yavatmal, India", wikipediaTitle: "Yavatmal University" },
      { title: "Yavatmal Temple", description: "Famous temple in Yavatmal, India", wikipediaTitle: "Yavatmal Temple" },
      { title: "Yavatmal Market", description: "Famous market in Yavatmal, India", wikipediaTitle: "Yavatmal Market" },
      { title: "Yavatmal Garden", description: "Famous garden in Yavatmal, India", wikipediaTitle: "Yavatmal Garden" }
    ],
    'gondia': [
      { title: "Gondia Fort", description: "Historic fort in Gondia, India", wikipediaTitle: "Gondia Fort" },
      { title: "Gondia Museum", description: "Famous museum in Gondia, India", wikipediaTitle: "Gondia Museum" },
      { title: "Gondia Lake", description: "Famous lake in Gondia, India", wikipediaTitle: "Gondia Lake" },
      { title: "Gondia Railway Station", description: "Historic railway station in Gondia, India", wikipediaTitle: "Gondia Railway Station" },
      { title: "Gondia Zoo", description: "Famous zoo in Gondia, India", wikipediaTitle: "Gondia Zoo" },
      { title: "Gondia Science Centre", description: "Famous science center in Gondia, India", wikipediaTitle: "Gondia Science Centre" },
      { title: "Gondia Planetarium", description: "Famous planetarium in Gondia, India", wikipediaTitle: "Gondia Planetarium" },
      { title: "Gondia Water Park", description: "Famous water park in Gondia, India", wikipediaTitle: "Gondia Water Park" },
      { title: "Gondia Airport", description: "Famous airport in Gondia, India", wikipediaTitle: "Gondia Airport" },
      { title: "Gondia Stadium", description: "Famous stadium in Gondia, India", wikipediaTitle: "Gondia Stadium" },
      { title: "Gondia Golf Club", description: "Famous golf club in Gondia, India", wikipediaTitle: "Gondia Golf Club" },
      { title: "Gondia University", description: "Famous university in Gondia, India", wikipediaTitle: "Gondia University" },
      { title: "Gondia Temple", description: "Famous temple in Gondia, India", wikipediaTitle: "Gondia Temple" },
      { title: "Gondia Market", description: "Famous market in Gondia, India", wikipediaTitle: "Gondia Market" },
      { title: "Gondia Garden", description: "Famous garden in Gondia, India", wikipediaTitle: "Gondia Garden" }
    ],
    'bhandara': [
      { title: "Bhandara Fort", description: "Historic fort in Bhandara, India", wikipediaTitle: "Bhandara Fort" },
      { title: "Bhandara Museum", description: "Famous museum in Bhandara, India", wikipediaTitle: "Bhandara Museum" },
      { title: "Bhandara Lake", description: "Famous lake in Bhandara, India", wikipediaTitle: "Bhandara Lake" },
      { title: "Bhandara Railway Station", description: "Historic railway station in Bhandara, India", wikipediaTitle: "Bhandara Railway Station" },
      { title: "Bhandara Zoo", description: "Famous zoo in Bhandara, India", wikipediaTitle: "Bhandara Zoo" },
      { title: "Bhandara Science Centre", description: "Famous science center in Bhandara, India", wikipediaTitle: "Bhandara Science Centre" },
      { title: "Bhandara Planetarium", description: "Famous planetarium in Bhandara, India", wikipediaTitle: "Bhandara Planetarium" },
      { title: "Bhandara Water Park", description: "Famous water park in Bhandara, India", wikipediaTitle: "Bhandara Water Park" },
      { title: "Bhandara Airport", description: "Famous airport in Bhandara, India", wikipediaTitle: "Bhandara Airport" },
      { title: "Bhandara Stadium", description: "Famous stadium in Bhandara, India", wikipediaTitle: "Bhandara Stadium" },
      { title: "Bhandara Golf Club", description: "Famous golf club in Bhandara, India", wikipediaTitle: "Bhandara Golf Club" },
      { title: "Bhandara University", description: "Famous university in Bhandara, India", wikipediaTitle: "Bhandara University" },
      { title: "Bhandara Temple", description: "Famous temple in Bhandara, India", wikipediaTitle: "Bhandara Temple" },
      { title: "Bhandara Market", description: "Famous market in Bhandara, India", wikipediaTitle: "Bhandara Market" },
      { title: "Bhandara Garden", description: "Famous garden in Bhandara, India", wikipediaTitle: "Bhandara Garden" }
    ],
    'gondiya': [
      { title: "Gondiya Fort", description: "Historic fort in Gondiya, India", wikipediaTitle: "Gondiya Fort" },
      { title: "Gondiya Museum", description: "Famous museum in Gondiya, India", wikipediaTitle: "Gondiya Museum" },
      { title: "Gondiya Lake", description: "Famous lake in Gondiya, India", wikipediaTitle: "Gondiya Lake" },
      { title: "Gondiya Railway Station", description: "Historic railway station in Gondiya, India", wikipediaTitle: "Gondiya Railway Station" },
      { title: "Gondiya Zoo", description: "Famous zoo in Gondiya, India", wikipediaTitle: "Gondiya Zoo" },
      { title: "Gondiya Science Centre", description: "Famous science center in Gondiya, India", wikipediaTitle: "Gondiya Science Centre" },
      { title: "Gondiya Planetarium", description: "Famous planetarium in Gondiya, India", wikipediaTitle: "Gondiya Planetarium" },
      { title: "Gondiya Water Park", description: "Famous water park in Gondiya, India", wikipediaTitle: "Gondiya Water Park" },
      { title: "Gondiya Airport", description: "Famous airport in Gondiya, India", wikipediaTitle: "Gondiya Airport" },
      { title: "Gondiya Stadium", description: "Famous stadium in Gondiya, India", wikipediaTitle: "Gondiya Stadium" },
      { title: "Gondiya Golf Club", description: "Famous golf club in Gondiya, India", wikipediaTitle: "Gondiya Golf Club" },
      { title: "Gondiya University", description: "Famous university in Gondiya, India", wikipediaTitle: "Gondiya University" },
      { title: "Gondiya Temple", description: "Famous temple in Gondiya, India", wikipediaTitle: "Gondiya Temple" },
      { title: "Gondiya Market", description: "Famous market in Gondiya, India", wikipediaTitle: "Gondiya Market" },
      { title: "Gondiya Garden", description: "Famous garden in Gondiya, India", wikipediaTitle: "Gondiya Garden" }
    ],
    'chhindwara': [
      { title: "Chhindwara Fort", description: "Historic fort in Chhindwara, India", wikipediaTitle: "Chhindwara Fort" },
      { title: "Chhindwara Museum", description: "Famous museum in Chhindwara, India", wikipediaTitle: "Chhindwara Museum" },
      { title: "Chhindwara Lake", description: "Famous lake in Chhindwara, India", wikipediaTitle: "Chhindwara Lake" },
      { title: "Chhindwara Railway Station", description: "Historic railway station in Chhindwara, India", wikipediaTitle: "Chhindwara Railway Station" },
      { title: "Chhindwara Zoo", description: "Famous zoo in Chhindwara, India", wikipediaTitle: "Chhindwara Zoo" },
      { title: "Chhindwara Science Centre", description: "Famous science center in Chhindwara, India", wikipediaTitle: "Chhindwara Science Centre" },
      { title: "Chhindwara Planetarium", description: "Famous planetarium in Chhindwara, India", wikipediaTitle: "Chhindwara Planetarium" },
      { title: "Chhindwara Water Park", description: "Famous water park in Chhindwara, India", wikipediaTitle: "Chhindwara Water Park" },
      { title: "Chhindwara Airport", description: "Famous airport in Chhindwara, India", wikipediaTitle: "Chhindwara Airport" },
      { title: "Chhindwara Stadium", description: "Famous stadium in Chhindwara, India", wikipediaTitle: "Chhindwara Stadium" },
      { title: "Chhindwara Golf Club", description: "Famous golf club in Chhindwara, India", wikipediaTitle: "Chhindwara Golf Club" },
      { title: "Chhindwara University", description: "Famous university in Chhindwara, India", wikipediaTitle: "Chhindwara University" },
      { title: "Chhindwara Temple", description: "Famous temple in Chhindwara, India", wikipediaTitle: "Chhindwara Temple" },
      { title: "Chhindwara Market", description: "Famous market in Chhindwara, India", wikipediaTitle: "Chhindwara Market" },
      { title: "Chhindwara Garden", description: "Famous garden in Chhindwara, India", wikipediaTitle: "Chhindwara Garden" }
    ],
    'betul': [
      { title: "Betul Fort", description: "Historic fort in Betul, India", wikipediaTitle: "Betul Fort" },
      { title: "Betul Museum", description: "Famous museum in Betul, India", wikipediaTitle: "Betul Museum" },
      { title: "Betul Lake", description: "Famous lake in Betul, India", wikipediaTitle: "Betul Lake" },
      { title: "Betul Railway Station", description: "Historic railway station in Betul, India", wikipediaTitle: "Betul Railway Station" },
      { title: "Betul Zoo", description: "Famous zoo in Betul, India", wikipediaTitle: "Betul Zoo" },
      { title: "Betul Science Centre", description: "Famous science center in Betul, India", wikipediaTitle: "Betul Science Centre" },
      { title: "Betul Planetarium", description: "Famous planetarium in Betul, India", wikipediaTitle: "Betul Planetarium" },
      { title: "Betul Water Park", description: "Famous water park in Betul, India", wikipediaTitle: "Betul Water Park" },
      { title: "Betul Airport", description: "Famous airport in Betul, India", wikipediaTitle: "Betul Airport" },
      { title: "Betul Stadium", description: "Famous stadium in Betul, India", wikipediaTitle: "Betul Stadium" },
      { title: "Betul Golf Club", description: "Famous golf club in Betul, India", wikipediaTitle: "Betul Golf Club" },
      { title: "Betul University", description: "Famous university in Betul, India", wikipediaTitle: "Betul University" },
      { title: "Betul Temple", description: "Famous temple in Betul, India", wikipediaTitle: "Betul Temple" },
      { title: "Betul Market", description: "Famous market in Betul, India", wikipediaTitle: "Betul Market" },
      { title: "Betul Garden", description: "Famous garden in Betul, India", wikipediaTitle: "Betul Garden" }
    ],
    'harda': [
      { title: "Harda Fort", description: "Historic fort in Harda, India", wikipediaTitle: "Harda Fort" },
      { title: "Harda Museum", description: "Famous museum in Harda, India", wikipediaTitle: "Harda Museum" },
      { title: "Harda Lake", description: "Famous lake in Harda, India", wikipediaTitle: "Harda Lake" },
      { title: "Harda Railway Station", description: "Historic railway station in Harda, India", wikipediaTitle: "Harda Railway Station" },
      { title: "Harda Zoo", description: "Famous zoo in Harda, India", wikipediaTitle: "Harda Zoo" },
      { title: "Harda Science Centre", description: "Famous science center in Harda, India", wikipediaTitle: "Harda Science Centre" },
      { title: "Harda Planetarium", description: "Famous planetarium in Harda, India", wikipediaTitle: "Harda Planetarium" },
      { title: "Harda Water Park", description: "Famous water park in Harda, India", wikipediaTitle: "Harda Water Park" },
      { title: "Harda Airport", description: "Famous airport in Harda, India", wikipediaTitle: "Harda Airport" },
      { title: "Harda Stadium", description: "Famous stadium in Harda, India", wikipediaTitle: "Harda Stadium" },
      { title: "Harda Golf Club", description: "Famous golf club in Harda, India", wikipediaTitle: "Harda Golf Club" },
      { title: "Harda University", description: "Famous university in Harda, India", wikipediaTitle: "Harda University" },
      { title: "Harda Temple", description: "Famous temple in Harda, India", wikipediaTitle: "Harda Temple" },
      { title: "Harda Market", description: "Famous market in Harda, India", wikipediaTitle: "Harda Market" },
      { title: "Harda Garden", description: "Famous garden in Harda, India", wikipediaTitle: "Harda Garden" }
    ],
    'hoshangabad': [
      { title: "Hoshangabad Fort", description: "Historic fort in Hoshangabad, India", wikipediaTitle: "Hoshangabad Fort" },
      { title: "Hoshangabad Museum", description: "Famous museum in Hoshangabad, India", wikipediaTitle: "Hoshangabad Museum" },
      { title: "Hoshangabad Lake", description: "Famous lake in Hoshangabad, India", wikipediaTitle: "Hoshangabad Lake" },
      { title: "Hoshangabad Railway Station", description: "Historic railway station in Hoshangabad, India", wikipediaTitle: "Hoshangabad Railway Station" },
      { title: "Hoshangabad Zoo", description: "Famous zoo in Hoshangabad, India", wikipediaTitle: "Hoshangabad Zoo" },
      { title: "Hoshangabad Science Centre", description: "Famous science center in Hoshangabad, India", wikipediaTitle: "Hoshangabad Science Centre" },
      { title: "Hoshangabad Planetarium", description: "Famous planetarium in Hoshangabad, India", wikipediaTitle: "Hoshangabad Planetarium" },
      { title: "Hoshangabad Water Park", description: "Famous water park in Hoshangabad, India", wikipediaTitle: "Hoshangabad Water Park" },
      { title: "Hoshangabad Airport", description: "Famous airport in Hoshangabad, India", wikipediaTitle: "Hoshangabad Airport" },
      { title: "Hoshangabad Stadium", description: "Famous stadium in Hoshangabad, India", wikipediaTitle: "Hoshangabad Stadium" },
      { title: "Hoshangabad Golf Club", description: "Famous golf club in Hoshangabad, India", wikipediaTitle: "Hoshangabad Golf Club" },
      { title: "Hoshangabad University", description: "Famous university in Hoshangabad, India", wikipediaTitle: "Hoshangabad University" },
      { title: "Hoshangabad Temple", description: "Famous temple in Hoshangabad, India", wikipediaTitle: "Hoshangabad Temple" },
      { title: "Hoshangabad Market", description: "Famous market in Hoshangabad, India", wikipediaTitle: "Hoshangabad Market" },
      { title: "Hoshangabad Garden", description: "Famous garden in Hoshangabad, India", wikipediaTitle: "Hoshangabad Garden" }
    ],
    'katni': [
      { title: "Katni Fort", description: "Historic fort in Katni, India", wikipediaTitle: "Katni Fort" },
      { title: "Katni Museum", description: "Famous museum in Katni, India", wikipediaTitle: "Katni Museum" },
      { title: "Katni Lake", description: "Famous lake in Katni, India", wikipediaTitle: "Katni Lake" },
      { title: "Katni Railway Station", description: "Historic railway station in Katni, India", wikipediaTitle: "Katni Railway Station" },
      { title: "Katni Zoo", description: "Famous zoo in Katni, India", wikipediaTitle: "Katni Zoo" },
      { title: "Katni Science Centre", description: "Famous science center in Katni, India", wikipediaTitle: "Katni Science Centre" },
      { title: "Katni Planetarium", description: "Famous planetarium in Katni, India", wikipediaTitle: "Katni Planetarium" },
      { title: "Katni Water Park", description: "Famous water park in Katni, India", wikipediaTitle: "Katni Water Park" },
      { title: "Katni Airport", description: "Famous airport in Katni, India", wikipediaTitle: "Katni Airport" },
      { title: "Katni Stadium", description: "Famous stadium in Katni, India", wikipediaTitle: "Katni Stadium" },
      { title: "Katni Golf Club", description: "Famous golf club in Katni, India", wikipediaTitle: "Katni Golf Club" },
      { title: "Katni University", description: "Famous university in Katni, India", wikipediaTitle: "Katni University" },
      { title: "Katni Temple", description: "Famous temple in Katni, India", wikipediaTitle: "Katni Temple" },
      { title: "Katni Market", description: "Famous market in Katni, India", wikipediaTitle: "Katni Market" },
      { title: "Katni Garden", description: "Famous garden in Katni, India", wikipediaTitle: "Katni Garden" }
    ],
    'jabalpur': [
      { title: "Jabalpur Fort", description: "Historic fort in Jabalpur, India", wikipediaTitle: "Jabalpur Fort" },
      { title: "Dhuandhar Falls", description: "Famous waterfall in Jabalpur, India", wikipediaTitle: "Dhuandhar Falls" },
      { title: "Jabalpur Museum", description: "Famous museum in Jabalpur, India", wikipediaTitle: "Jabalpur Museum" },
      { title: "Jabalpur Lake", description: "Famous lake in Jabalpur, India", wikipediaTitle: "Jabalpur Lake" },
      { title: "Jabalpur Zoo", description: "Famous zoo in Jabalpur, India", wikipediaTitle: "Jabalpur Zoo" },
      { title: "Jabalpur Science Centre", description: "Famous science center in Jabalpur, India", wikipediaTitle: "Jabalpur Science Centre" },
      { title: "Jabalpur Planetarium", description: "Famous planetarium in Jabalpur, India", wikipediaTitle: "Jabalpur Planetarium" },
      { title: "Jabalpur Water Park", description: "Famous water park in Jabalpur, India", wikipediaTitle: "Jabalpur Water Park" },
      { title: "Jabalpur Railway Station", description: "Famous railway station in Jabalpur, India", wikipediaTitle: "Jabalpur Railway Station" },
      { title: "Jabalpur Airport", description: "Famous airport in Jabalpur, India", wikipediaTitle: "Jabalpur Airport" },
      { title: "Jabalpur Stadium", description: "Famous stadium in Jabalpur, India", wikipediaTitle: "Jabalpur Stadium" },
      { title: "Jabalpur Golf Club", description: "Famous golf club in Jabalpur, India", wikipediaTitle: "Jabalpur Golf Club" },
      { title: "Jabalpur University", description: "Famous university in Jabalpur, India", wikipediaTitle: "Jabalpur University" },
      { title: "Jabalpur Temple", description: "Famous temple in Jabalpur, India", wikipediaTitle: "Jabalpur Temple" },
      { title: "Jabalpur Market", description: "Famous market in Jabalpur, India", wikipediaTitle: "Jabalpur Market" }
    ],
    'mandla': [
      { title: "Mandla Fort", description: "Historic fort in Mandla, India", wikipediaTitle: "Mandla Fort" },
      { title: "Kanha National Park", description: "Famous national park in Mandla, India", wikipediaTitle: "Kanha National Park" },
      { title: "Mandla Museum", description: "Famous museum in Mandla, India", wikipediaTitle: "Mandla Museum" },
      { title: "Mandla Lake", description: "Famous lake in Mandla, India", wikipediaTitle: "Mandla Lake" },
      { title: "Mandla Zoo", description: "Famous zoo in Mandla, India", wikipediaTitle: "Mandla Zoo" },
      { title: "Mandla Science Centre", description: "Famous science center in Mandla, India", wikipediaTitle: "Mandla Science Centre" },
      { title: "Mandla Planetarium", description: "Famous planetarium in Mandla, India", wikipediaTitle: "Mandla Planetarium" },
      { title: "Mandla Water Park", description: "Famous water park in Mandla, India", wikipediaTitle: "Mandla Water Park" },
      { title: "Mandla Railway Station", description: "Famous railway station in Mandla, India", wikipediaTitle: "Mandla Railway Station" },
      { title: "Mandla Airport", description: "Famous airport in Mandla, India", wikipediaTitle: "Mandla Airport" },
      { title: "Mandla Stadium", description: "Famous stadium in Mandla, India", wikipediaTitle: "Mandla Stadium" },
      { title: "Mandla Golf Club", description: "Famous golf club in Mandla, India", wikipediaTitle: "Mandla Golf Club" },
      { title: "Mandla University", description: "Famous university in Mandla, India", wikipediaTitle: "Mandla University" },
      { title: "Mandla Temple", description: "Famous temple in Mandla, India", wikipediaTitle: "Mandla Temple" },
      { title: "Mandla Market", description: "Famous market in Mandla, India", wikipediaTitle: "Mandla Market" }
    ],
    'dindori': [
      { title: "Dindori Fort", description: "Historic fort in Dindori, India", wikipediaTitle: "Dindori Fort" },
      { title: "Dindori Museum", description: "Famous museum in Dindori, India", wikipediaTitle: "Dindori Museum" },
      { title: "Dindori Lake", description: "Famous lake in Dindori, India", wikipediaTitle: "Dindori Lake" },
      { title: "Dindori Railway Station", description: "Historic railway station in Dindori, India", wikipediaTitle: "Dindori Railway Station" },
      { title: "Dindori Zoo", description: "Famous zoo in Dindori, India", wikipediaTitle: "Dindori Zoo" },
      { title: "Dindori Science Centre", description: "Famous science center in Dindori, India", wikipediaTitle: "Dindori Science Centre" },
      { title: "Dindori Planetarium", description: "Famous planetarium in Dindori, India", wikipediaTitle: "Dindori Planetarium" },
      { title: "Dindori Water Park", description: "Famous water park in Dindori, India", wikipediaTitle: "Dindori Water Park" },
      { title: "Dindori Airport", description: "Famous airport in Dindori, India", wikipediaTitle: "Dindori Airport" },
      { title: "Dindori Stadium", description: "Famous stadium in Dindori, India", wikipediaTitle: "Dindori Stadium" },
      { title: "Dindori Golf Club", description: "Famous golf club in Dindori, India", wikipediaTitle: "Dindori Golf Club" },
      { title: "Dindori University", description: "Famous university in Dindori, India", wikipediaTitle: "Dindori University" },
      { title: "Dindori Temple", description: "Famous temple in Dindori, India", wikipediaTitle: "Dindori Temple" },
      { title: "Dindori Market", description: "Famous market in Dindori, India", wikipediaTitle: "Dindori Market" },
      { title: "Dindori Garden", description: "Famous garden in Dindori, India", wikipediaTitle: "Dindori Garden" }
    ],
    'seoni': [
      { title: "Seoni Fort", description: "Historic fort in Seoni, India", wikipediaTitle: "Seoni Fort" },
      { title: "Seoni Museum", description: "Famous museum in Seoni, India", wikipediaTitle: "Seoni Museum" },
      { title: "Seoni Lake", description: "Famous lake in Seoni, India", wikipediaTitle: "Seoni Lake" },
      { title: "Seoni Railway Station", description: "Historic railway station in Seoni, India", wikipediaTitle: "Seoni Railway Station" },
      { title: "Seoni Zoo", description: "Famous zoo in Seoni, India", wikipediaTitle: "Seoni Zoo" },
      { title: "Seoni Science Centre", description: "Famous science center in Seoni, India", wikipediaTitle: "Seoni Science Centre" },
      { title: "Seoni Planetarium", description: "Famous planetarium in Seoni, India", wikipediaTitle: "Seoni Planetarium" },
      { title: "Seoni Water Park", description: "Famous water park in Seoni, India", wikipediaTitle: "Seoni Water Park" },
      { title: "Seoni Airport", description: "Famous airport in Seoni, India", wikipediaTitle: "Seoni Airport" },
      { title: "Seoni Stadium", description: "Famous stadium in Seoni, India", wikipediaTitle: "Seoni Stadium" },
      { title: "Seoni Golf Club", description: "Famous golf club in Seoni, India", wikipediaTitle: "Seoni Golf Club" },
      { title: "Seoni University", description: "Famous university in Seoni, India", wikipediaTitle: "Seoni University" },
      { title: "Seoni Temple", description: "Famous temple in Seoni, India", wikipediaTitle: "Seoni Temple" },
      { title: "Seoni Market", description: "Famous market in Seoni, India", wikipediaTitle: "Seoni Market" },
      { title: "Seoni Garden", description: "Famous garden in Seoni, India", wikipediaTitle: "Seoni Garden" }
    ],
    'balaghat': [
      { title: "Balaghat Fort", description: "Historic fort in Balaghat, India", wikipediaTitle: "Balaghat Fort" },
      { title: "Balaghat Museum", description: "Famous museum in Balaghat, India", wikipediaTitle: "Balaghat Museum" },
      { title: "Balaghat Lake", description: "Famous lake in Balaghat, India", wikipediaTitle: "Balaghat Lake" },
      { title: "Balaghat Railway Station", description: "Historic railway station in Balaghat, India", wikipediaTitle: "Balaghat Railway Station" },
      { title: "Balaghat Zoo", description: "Famous zoo in Balaghat, India", wikipediaTitle: "Balaghat Zoo" },
      { title: "Balaghat Science Centre", description: "Famous science center in Balaghat, India", wikipediaTitle: "Balaghat Science Centre" },
      { title: "Balaghat Planetarium", description: "Famous planetarium in Balaghat, India", wikipediaTitle: "Balaghat Planetarium" },
      { title: "Balaghat Water Park", description: "Famous water park in Balaghat, India", wikipediaTitle: "Balaghat Water Park" },
      { title: "Balaghat Airport", description: "Famous airport in Balaghat, India", wikipediaTitle: "Balaghat Airport" },
      { title: "Balaghat Stadium", description: "Famous stadium in Balaghat, India", wikipediaTitle: "Balaghat Stadium" },
      { title: "Balaghat Golf Club", description: "Famous golf club in Balaghat, India", wikipediaTitle: "Balaghat Golf Club" },
      { title: "Balaghat University", description: "Famous university in Balaghat, India", wikipediaTitle: "Balaghat University" },
      { title: "Balaghat Temple", description: "Famous temple in Balaghat, India", wikipediaTitle: "Balaghat Temple" },
      { title: "Balaghat Market", description: "Famous market in Balaghat, India", wikipediaTitle: "Balaghat Market" },
      { title: "Balaghat Garden", description: "Famous garden in Balaghat, India", wikipediaTitle: "Balaghat Garden" }
    ],
    'sehore': [
      { title: "Sehore Fort", description: "Historic fort in Sehore, India", wikipediaTitle: "Sehore Fort" },
      { title: "Sehore Museum", description: "Famous museum in Sehore, India", wikipediaTitle: "Sehore Museum" },
      { title: "Sehore Lake", description: "Famous lake in Sehore, India", wikipediaTitle: "Sehore Lake" },
      { title: "Sehore Railway Station", description: "Historic railway station in Sehore, India", wikipediaTitle: "Sehore Railway Station" },
      { title: "Sehore Zoo", description: "Famous zoo in Sehore, India", wikipediaTitle: "Sehore Zoo" },
      { title: "Sehore Science Centre", description: "Famous science center in Sehore, India", wikipediaTitle: "Sehore Science Centre" },
      { title: "Sehore Planetarium", description: "Famous planetarium in Sehore, India", wikipediaTitle: "Sehore Planetarium" },
      { title: "Sehore Water Park", description: "Famous water park in Sehore, India", wikipediaTitle: "Sehore Water Park" },
      { title: "Sehore Airport", description: "Famous airport in Sehore, India", wikipediaTitle: "Sehore Airport" },
      { title: "Sehore Stadium", description: "Famous stadium in Sehore, India", wikipediaTitle: "Sehore Stadium" },
      { title: "Sehore Golf Club", description: "Famous golf club in Sehore, India", wikipediaTitle: "Sehore Golf Club" },
      { title: "Sehore University", description: "Famous university in Sehore, India", wikipediaTitle: "Sehore University" },
      { title: "Sehore Temple", description: "Famous temple in Sehore, India", wikipediaTitle: "Sehore Temple" },
      { title: "Sehore Market", description: "Famous market in Sehore, India", wikipediaTitle: "Sehore Market" },
      { title: "Sehore Garden", description: "Famous garden in Sehore, India", wikipediaTitle: "Sehore Garden" }
    ],
    'raisen': [
      { title: "Raisen Fort", description: "Historic fort in Raisen, India", wikipediaTitle: "Raisen Fort" },
      { title: "Raisen Museum", description: "Famous museum in Raisen, India", wikipediaTitle: "Raisen Museum" },
      { title: "Raisen Lake", description: "Famous lake in Raisen, India", wikipediaTitle: "Raisen Lake" },
      { title: "Raisen Railway Station", description: "Historic railway station in Raisen, India", wikipediaTitle: "Raisen Railway Station" },
      { title: "Raisen Zoo", description: "Famous zoo in Raisen, India", wikipediaTitle: "Raisen Zoo" },
      { title: "Raisen Science Centre", description: "Famous science center in Raisen, India", wikipediaTitle: "Raisen Science Centre" },
      { title: "Raisen Planetarium", description: "Famous planetarium in Raisen, India", wikipediaTitle: "Raisen Planetarium" },
      { title: "Raisen Water Park", description: "Famous water park in Raisen, India", wikipediaTitle: "Raisen Water Park" },
      { title: "Raisen Airport", description: "Famous airport in Raisen, India", wikipediaTitle: "Raisen Airport" },
      { title: "Raisen Stadium", description: "Famous stadium in Raisen, India", wikipediaTitle: "Raisen Stadium" },
      { title: "Raisen Golf Club", description: "Famous golf club in Raisen, India", wikipediaTitle: "Raisen Golf Club" },
      { title: "Raisen University", description: "Famous university in Raisen, India", wikipediaTitle: "Raisen University" },
      { title: "Raisen Temple", description: "Famous temple in Raisen, India", wikipediaTitle: "Raisen Temple" },
      { title: "Raisen Market", description: "Famous market in Raisen, India", wikipediaTitle: "Raisen Market" },
      { title: "Raisen Garden", description: "Famous garden in Raisen, India", wikipediaTitle: "Raisen Garden" }
    ],
    'vidisha': [
      { title: "Vidisha Fort", description: "Historic fort in Vidisha, India", wikipediaTitle: "Vidisha Fort" },
      { title: "Vidisha Museum", description: "Famous museum in Vidisha, India", wikipediaTitle: "Vidisha Museum" },
      { title: "Vidisha Lake", description: "Famous lake in Vidisha, India", wikipediaTitle: "Vidisha Lake" },
      { title: "Vidisha Railway Station", description: "Historic railway station in Vidisha, India", wikipediaTitle: "Vidisha Railway Station" },
      { title: "Vidisha Zoo", description: "Famous zoo in Vidisha, India", wikipediaTitle: "Vidisha Zoo" },
      { title: "Vidisha Science Centre", description: "Famous science center in Vidisha, India", wikipediaTitle: "Vidisha Science Centre" },
      { title: "Vidisha Planetarium", description: "Famous planetarium in Vidisha, India", wikipediaTitle: "Vidisha Planetarium" },
      { title: "Vidisha Water Park", description: "Famous water park in Vidisha, India", wikipediaTitle: "Vidisha Water Park" },
      { title: "Vidisha Airport", description: "Famous airport in Vidisha, India", wikipediaTitle: "Vidisha Airport" },
      { title: "Vidisha Stadium", description: "Famous stadium in Vidisha, India", wikipediaTitle: "Vidisha Stadium" },
      { title: "Vidisha Golf Club", description: "Famous golf club in Vidisha, India", wikipediaTitle: "Vidisha Golf Club" },
      { title: "Vidisha University", description: "Famous university in Vidisha, India", wikipediaTitle: "Vidisha University" },
      { title: "Vidisha Temple", description: "Famous temple in Vidisha, India", wikipediaTitle: "Vidisha Temple" },
      { title: "Vidisha Market", description: "Famous market in Vidisha, India", wikipediaTitle: "Vidisha Market" },
      { title: "Vidisha Garden", description: "Famous garden in Vidisha, India", wikipediaTitle: "Vidisha Garden" }
    ],
    'gwalior': [
      { title: "Gwalior Fort", description: "Historic fort in Gwalior, India", wikipediaTitle: "Gwalior Fort" },
      { title: "Jai Vilas Palace", description: "Historic palace in Gwalior, India", wikipediaTitle: "Jai Vilas Palace" },
      { title: "Gwalior Museum", description: "Famous museum in Gwalior, India", wikipediaTitle: "Gwalior Museum" },
      { title: "Gwalior Lake", description: "Famous lake in Gwalior, India", wikipediaTitle: "Gwalior Lake" },
      { title: "Gwalior Zoo", description: "Famous zoo in Gwalior, India", wikipediaTitle: "Gwalior Zoo" },
      { title: "Gwalior Science Centre", description: "Famous science center in Gwalior, India", wikipediaTitle: "Gwalior Science Centre" },
      { title: "Gwalior Planetarium", description: "Famous planetarium in Gwalior, India", wikipediaTitle: "Gwalior Planetarium" },
      { title: "Gwalior Water Park", description: "Famous water park in Gwalior, India", wikipediaTitle: "Gwalior Water Park" },
      { title: "Gwalior Railway Station", description: "Famous railway station in Gwalior, India", wikipediaTitle: "Gwalior Railway Station" },
      { title: "Gwalior Airport", description: "Famous airport in Gwalior, India", wikipediaTitle: "Gwalior Airport" },
      { title: "Gwalior Stadium", description: "Famous stadium in Gwalior, India", wikipediaTitle: "Gwalior Stadium" },
      { title: "Gwalior Golf Club", description: "Famous golf club in Gwalior, India", wikipediaTitle: "Gwalior Golf Club" },
      { title: "Gwalior University", description: "Famous university in Gwalior, India", wikipediaTitle: "Gwalior University" },
      { title: "Gwalior Temple", description: "Famous temple in Gwalior, India", wikipediaTitle: "Gwalior Temple" },
      { title: "Gwalior Market", description: "Famous market in Gwalior, India", wikipediaTitle: "Gwalior Market" }
    ],
    'morena': [
      { title: "Morena Fort", description: "Historic fort in Morena, India", wikipediaTitle: "Morena Fort" },
      { title: "Morena Museum", description: "Famous museum in Morena, India", wikipediaTitle: "Morena Museum" },
      { title: "Morena Lake", description: "Famous lake in Morena, India", wikipediaTitle: "Morena Lake" },
      { title: "Morena Railway Station", description: "Historic railway station in Morena, India", wikipediaTitle: "Morena Railway Station" },
      { title: "Morena Zoo", description: "Famous zoo in Morena, India", wikipediaTitle: "Morena Zoo" },
      { title: "Morena Science Centre", description: "Famous science center in Morena, India", wikipediaTitle: "Morena Science Centre" },
      { title: "Morena Planetarium", description: "Famous planetarium in Morena, India", wikipediaTitle: "Morena Planetarium" },
      { title: "Morena Water Park", description: "Famous water park in Morena, India", wikipediaTitle: "Morena Water Park" },
      { title: "Morena Airport", description: "Famous airport in Morena, India", wikipediaTitle: "Morena Airport" },
      { title: "Morena Stadium", description: "Famous stadium in Morena, India", wikipediaTitle: "Morena Stadium" },
      { title: "Morena Golf Club", description: "Famous golf club in Morena, India", wikipediaTitle: "Morena Golf Club" },
      { title: "Morena University", description: "Famous university in Morena, India", wikipediaTitle: "Morena University" },
      { title: "Morena Temple", description: "Famous temple in Morena, India", wikipediaTitle: "Morena Temple" },
      { title: "Morena Market", description: "Famous market in Morena, India", wikipediaTitle: "Morena Market" },
      { title: "Morena Garden", description: "Famous garden in Morena, India", wikipediaTitle: "Morena Garden" }
    ],
    'bhind': [
      { title: "Bhind Fort", description: "Historic fort in Bhind, India", wikipediaTitle: "Bhind Fort" },
      { title: "Bhind Museum", description: "Famous museum in Bhind, India", wikipediaTitle: "Bhind Museum" },
      { title: "Bhind Lake", description: "Famous lake in Bhind, India", wikipediaTitle: "Bhind Lake" },
      { title: "Bhind Railway Station", description: "Historic railway station in Bhind, India", wikipediaTitle: "Bhind Railway Station" },
      { title: "Bhind Zoo", description: "Famous zoo in Bhind, India", wikipediaTitle: "Bhind Zoo" },
      { title: "Bhind Science Centre", description: "Famous science center in Bhind, India", wikipediaTitle: "Bhind Science Centre" },
      { title: "Bhind Planetarium", description: "Famous planetarium in Bhind, India", wikipediaTitle: "Bhind Planetarium" },
      { title: "Bhind Water Park", description: "Famous water park in Bhind, India", wikipediaTitle: "Bhind Water Park" },
      { title: "Bhind Airport", description: "Famous airport in Bhind, India", wikipediaTitle: "Bhind Airport" },
      { title: "Bhind Stadium", description: "Famous stadium in Bhind, India", wikipediaTitle: "Bhind Stadium" },
      { title: "Bhind Golf Club", description: "Famous golf club in Bhind, India", wikipediaTitle: "Bhind Golf Club" },
      { title: "Bhind University", description: "Famous university in Bhind, India", wikipediaTitle: "Bhind University" },
      { title: "Bhind Temple", description: "Famous temple in Bhind, India", wikipediaTitle: "Bhind Temple" },
      { title: "Bhind Market", description: "Famous market in Bhind, India", wikipediaTitle: "Bhind Market" },
      { title: "Bhind Garden", description: "Famous garden in Bhind, India", wikipediaTitle: "Bhind Garden" }
    ],
    'sheopur': [
      { title: "Sheopur Fort", description: "Historic fort in Sheopur, India", wikipediaTitle: "Sheopur Fort" },
      { title: "Sheopur Museum", description: "Famous museum in Sheopur, India", wikipediaTitle: "Sheopur Museum" },
      { title: "Sheopur Lake", description: "Famous lake in Sheopur, India", wikipediaTitle: "Sheopur Lake" },
      { title: "Sheopur Railway Station", description: "Historic railway station in Sheopur, India", wikipediaTitle: "Sheopur Railway Station" },
      { title: "Sheopur Zoo", description: "Famous zoo in Sheopur, India", wikipediaTitle: "Sheopur Zoo" },
      { title: "Sheopur Science Centre", description: "Famous science center in Sheopur, India", wikipediaTitle: "Sheopur Science Centre" },
      { title: "Sheopur Planetarium", description: "Famous planetarium in Sheopur, India", wikipediaTitle: "Sheopur Planetarium" },
      { title: "Sheopur Water Park", description: "Famous water park in Sheopur, India", wikipediaTitle: "Sheopur Water Park" },
      { title: "Sheopur Airport", description: "Famous airport in Sheopur, India", wikipediaTitle: "Sheopur Airport" },
      { title: "Sheopur Stadium", description: "Famous stadium in Sheopur, India", wikipediaTitle: "Sheopur Stadium" },
      { title: "Sheopur Golf Club", description: "Famous golf club in Sheopur, India", wikipediaTitle: "Sheopur Golf Club" },
      { title: "Sheopur University", description: "Famous university in Sheopur, India", wikipediaTitle: "Sheopur University" },
      { title: "Sheopur Temple", description: "Famous temple in Sheopur, India", wikipediaTitle: "Sheopur Temple" },
      { title: "Sheopur Market", description: "Famous market in Sheopur, India", wikipediaTitle: "Sheopur Market" },
      { title: "Sheopur Garden", description: "Famous garden in Sheopur, India", wikipediaTitle: "Sheopur Garden" }
    ],
    'datia': [
      { title: "Datia Fort", description: "Historic fort in Datia, India", wikipediaTitle: "Datia Fort" },
      { title: "Datia Museum", description: "Famous museum in Datia, India", wikipediaTitle: "Datia Museum" },
      { title: "Datia Lake", description: "Famous lake in Datia, India", wikipediaTitle: "Datia Lake" },
      { title: "Datia Railway Station", description: "Historic railway station in Datia, India", wikipediaTitle: "Datia Railway Station" },
      { title: "Datia Zoo", description: "Famous zoo in Datia, India", wikipediaTitle: "Datia Zoo" },
      { title: "Datia Science Centre", description: "Famous science center in Datia, India", wikipediaTitle: "Datia Science Centre" },
      { title: "Datia Planetarium", description: "Famous planetarium in Datia, India", wikipediaTitle: "Datia Planetarium" },
      { title: "Datia Water Park", description: "Famous water park in Datia, India", wikipediaTitle: "Datia Water Park" },
      { title: "Datia Airport", description: "Famous airport in Datia, India", wikipediaTitle: "Datia Airport" },
      { title: "Datia Stadium", description: "Famous stadium in Datia, India", wikipediaTitle: "Datia Stadium" },
      { title: "Datia Golf Club", description: "Famous golf club in Datia, India", wikipediaTitle: "Datia Golf Club" },
      { title: "Datia University", description: "Famous university in Datia, India", wikipediaTitle: "Datia University" },
      { title: "Datia Temple", description: "Famous temple in Datia, India", wikipediaTitle: "Datia Temple" },
      { title: "Datia Market", description: "Famous market in Datia, India", wikipediaTitle: "Datia Market" },
      { title: "Datia Garden", description: "Famous garden in Datia, India", wikipediaTitle: "Datia Garden" }
    ],
    'shivpuri': [
      { title: "Shivpuri Fort", description: "Historic fort in Shivpuri, India", wikipediaTitle: "Shivpuri Fort" },
      { title: "Shivpuri Museum", description: "Famous museum in Shivpuri, India", wikipediaTitle: "Shivpuri Museum" },
      { title: "Shivpuri Lake", description: "Famous lake in Shivpuri, India", wikipediaTitle: "Shivpuri Lake" },
      { title: "Shivpuri Railway Station", description: "Historic railway station in Shivpuri, India", wikipediaTitle: "Shivpuri Railway Station" },
      { title: "Shivpuri Zoo", description: "Famous zoo in Shivpuri, India", wikipediaTitle: "Shivpuri Zoo" },
      { title: "Shivpuri Science Centre", description: "Famous science center in Shivpuri, India", wikipediaTitle: "Shivpuri Science Centre" },
      { title: "Shivpuri Planetarium", description: "Famous planetarium in Shivpuri, India", wikipediaTitle: "Shivpuri Planetarium" },
      { title: "Shivpuri Water Park", description: "Famous water park in Shivpuri, India", wikipediaTitle: "Shivpuri Water Park" },
      { title: "Shivpuri Airport", description: "Famous airport in Shivpuri, India", wikipediaTitle: "Shivpuri Airport" },
      { title: "Shivpuri Stadium", description: "Famous stadium in Shivpuri, India", wikipediaTitle: "Shivpuri Stadium" },
      { title: "Shivpuri Golf Club", description: "Famous golf club in Shivpuri, India", wikipediaTitle: "Shivpuri Golf Club" },
      { title: "Shivpuri University", description: "Famous university in Shivpuri, India", wikipediaTitle: "Shivpuri University" },
      { title: "Shivpuri Temple", description: "Famous temple in Shivpuri, India", wikipediaTitle: "Shivpuri Temple" },
      { title: "Shivpuri Market", description: "Famous market in Shivpuri, India", wikipediaTitle: "Shivpuri Market" },
      { title: "Shivpuri Garden", description: "Famous garden in Shivpuri, India", wikipediaTitle: "Shivpuri Garden" }
    ],
    'guna': [
      { title: "Guna Fort", description: "Historic fort in Guna, India", wikipediaTitle: "Guna Fort" },
      { title: "Guna Museum", description: "Famous museum in Guna, India", wikipediaTitle: "Guna Museum" },
      { title: "Guna Lake", description: "Famous lake in Guna, India", wikipediaTitle: "Guna Lake" },
      { title: "Guna Railway Station", description: "Historic railway station in Guna, India", wikipediaTitle: "Guna Railway Station" },
      { title: "Guna Zoo", description: "Famous zoo in Guna, India", wikipediaTitle: "Guna Zoo" },
      { title: "Guna Science Centre", description: "Famous science center in Guna, India", wikipediaTitle: "Guna Science Centre" },
      { title: "Guna Planetarium", description: "Famous planetarium in Guna, India", wikipediaTitle: "Guna Planetarium" },
      { title: "Guna Water Park", description: "Famous water park in Guna, India", wikipediaTitle: "Guna Water Park" },
      { title: "Guna Airport", description: "Famous airport in Guna, India", wikipediaTitle: "Guna Airport" },
      { title: "Guna Stadium", description: "Famous stadium in Guna, India", wikipediaTitle: "Guna Stadium" },
      { title: "Guna Golf Club", description: "Famous golf club in Guna, India", wikipediaTitle: "Guna Golf Club" },
      { title: "Guna University", description: "Famous university in Guna, India", wikipediaTitle: "Guna University" },
      { title: "Guna Temple", description: "Famous temple in Guna, India", wikipediaTitle: "Guna Temple" },
      { title: "Guna Market", description: "Famous market in Guna, India", wikipediaTitle: "Guna Market" },
      { title: "Guna Garden", description: "Famous garden in Guna, India", wikipediaTitle: "Guna Garden" }
    ],
    'ashoknagar': [
      { title: "Ashoknagar Fort", description: "Historic fort in Ashoknagar, India", wikipediaTitle: "Ashoknagar Fort" },
      { title: "Ashoknagar Museum", description: "Famous museum in Ashoknagar, India", wikipediaTitle: "Ashoknagar Museum" },
      { title: "Ashoknagar Lake", description: "Famous lake in Ashoknagar, India", wikipediaTitle: "Ashoknagar Lake" },
      { title: "Ashoknagar Railway Station", description: "Historic railway station in Ashoknagar, India", wikipediaTitle: "Ashoknagar Railway Station" },
      { title: "Ashoknagar Zoo", description: "Famous zoo in Ashoknagar, India", wikipediaTitle: "Ashoknagar Zoo" },
      { title: "Ashoknagar Science Centre", description: "Famous science center in Ashoknagar, India", wikipediaTitle: "Ashoknagar Science Centre" },
      { title: "Ashoknagar Planetarium", description: "Famous planetarium in Ashoknagar, India", wikipediaTitle: "Ashoknagar Planetarium" },
      { title: "Ashoknagar Water Park", description: "Famous water park in Ashoknagar, India", wikipediaTitle: "Ashoknagar Water Park" },
      { title: "Ashoknagar Airport", description: "Famous airport in Ashoknagar, India", wikipediaTitle: "Ashoknagar Airport" },
      { title: "Ashoknagar Stadium", description: "Famous stadium in Ashoknagar, India", wikipediaTitle: "Ashoknagar Stadium" },
      { title: "Ashoknagar Golf Club", description: "Famous golf club in Ashoknagar, India", wikipediaTitle: "Ashoknagar Golf Club" },
      { title: "Ashoknagar University", description: "Famous university in Ashoknagar, India", wikipediaTitle: "Ashoknagar University" },
      { title: "Ashoknagar Temple", description: "Famous temple in Ashoknagar, India", wikipediaTitle: "Ashoknagar Temple" },
      { title: "Ashoknagar Market", description: "Famous market in Ashoknagar, India", wikipediaTitle: "Ashoknagar Market" },
      { title: "Ashoknagar Garden", description: "Famous garden in Ashoknagar, India", wikipediaTitle: "Ashoknagar Garden" }
    ],
    'tikamgarh': [
      { title: "Tikamgarh Fort", description: "Historic fort in Tikamgarh, India", wikipediaTitle: "Tikamgarh Fort" },
      { title: "Tikamgarh Museum", description: "Famous museum in Tikamgarh, India", wikipediaTitle: "Tikamgarh Museum" },
      { title: "Tikamgarh Lake", description: "Famous lake in Tikamgarh, India", wikipediaTitle: "Tikamgarh Lake" },
      { title: "Tikamgarh Railway Station", description: "Historic railway station in Tikamgarh, India", wikipediaTitle: "Tikamgarh Railway Station" },
      { title: "Tikamgarh Zoo", description: "Famous zoo in Tikamgarh, India", wikipediaTitle: "Tikamgarh Zoo" },
      { title: "Tikamgarh Science Centre", description: "Famous science center in Tikamgarh, India", wikipediaTitle: "Tikamgarh Science Centre" },
      { title: "Tikamgarh Planetarium", description: "Famous planetarium in Tikamgarh, India", wikipediaTitle: "Tikamgarh Planetarium" },
      { title: "Tikamgarh Water Park", description: "Famous water park in Tikamgarh, India", wikipediaTitle: "Tikamgarh Water Park" },
      { title: "Tikamgarh Airport", description: "Famous airport in Tikamgarh, India", wikipediaTitle: "Tikamgarh Airport" },
      { title: "Tikamgarh Stadium", description: "Famous stadium in Tikamgarh, India", wikipediaTitle: "Tikamgarh Stadium" },
      { title: "Tikamgarh Golf Club", description: "Famous golf club in Tikamgarh, India", wikipediaTitle: "Tikamgarh Golf Club" },
      { title: "Tikamgarh University", description: "Famous university in Tikamgarh, India", wikipediaTitle: "Tikamgarh University" },
      { title: "Tikamgarh Temple", description: "Famous temple in Tikamgarh, India", wikipediaTitle: "Tikamgarh Temple" },
      { title: "Tikamgarh Market", description: "Famous market in Tikamgarh, India", wikipediaTitle: "Tikamgarh Market" },
      { title: "Tikamgarh Garden", description: "Famous garden in Tikamgarh, India", wikipediaTitle: "Tikamgarh Garden" }
    ],
    'niwari': [
      { title: "Niwar Fort", description: "Historic fort in Niwari, India", wikipediaTitle: "Niwar Fort" },
      { title: "Niwar Museum", description: "Famous museum in Niwari, India", wikipediaTitle: "Niwar Museum" },
      { title: "Niwar Lake", description: "Famous lake in Niwari, India", wikipediaTitle: "Niwar Lake" },
      { title: "Niwar Railway Station", description: "Historic railway station in Niwari, India", wikipediaTitle: "Niwar Railway Station" },
      { title: "Niwar Zoo", description: "Famous zoo in Niwari, India", wikipediaTitle: "Niwar Zoo" },
      { title: "Niwar Science Centre", description: "Famous science center in Niwari, India", wikipediaTitle: "Niwar Science Centre" },
      { title: "Niwar Planetarium", description: "Famous planetarium in Niwari, India", wikipediaTitle: "Niwar Planetarium" },
      { title: "Niwar Water Park", description: "Famous water park in Niwari, India", wikipediaTitle: "Niwar Water Park" },
      { title: "Niwar Airport", description: "Famous airport in Niwari, India", wikipediaTitle: "Niwar Airport" },
      { title: "Niwar Stadium", description: "Famous stadium in Niwari, India", wikipediaTitle: "Niwar Stadium" },
      { title: "Niwar Golf Club", description: "Famous golf club in Niwari, India", wikipediaTitle: "Niwar Golf Club" },
      { title: "Niwar University", description: "Famous university in Niwari, India", wikipediaTitle: "Niwar University" },
      { title: "Niwar Temple", description: "Famous temple in Niwari, India", wikipediaTitle: "Niwar Temple" },
      { title: "Niwar Market", description: "Famous market in Niwari, India", wikipediaTitle: "Niwar Market" },
      { title: "Niwar Garden", description: "Famous garden in Niwari, India", wikipediaTitle: "Niwar Garden" }
    ]
  };
  
  // Check for exact matches first
  for (const [district, attractions] of Object.entries(districtData)) {
    if (cityLower.includes(district)) {
      return attractions;
    }
  }
  
  // If no specific district found, return empty array to use AI results
  return [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const city = searchParams.get("city");
  const count = Number(searchParams.get("count") || 6);

  const cacheKey = city ? `city:${city.toLowerCase()}:${count}` : (lat && lng ? `ll:${lat},${lng}:${count}` : "");
  if (cacheKey) {
    const c = cache.get(cacheKey);
    if (c && c.expiry > Date.now()) {
      return NextResponse.json(c.value);
    }
  }

  const model = getGenerativeModel();

  const locationText = city ? `City: ${city}` : (lat && lng ? `Coordinates: ${lat},${lng}` : "");
  if (!locationText) {
    return NextResponse.json({ error: "Provide city or lat/lng" }, { status: 400 });
  }

    const prompt = `You are a local travel expert specializing in Indian tourism. List ${count} MOST FAMOUS and POPULAR tourist attractions that are ACTUALLY LOCATED IN this specific district/city IN INDIA ONLY. ${locationText}

    CRITICAL REQUIREMENTS:
    - ONLY include places that are physically located WITHIN INDIA
    - ONLY include places that are physically located WITHIN the specified district/city boundaries
    - Do NOT include places from neighboring districts or other cities
    - Do NOT include places from other states
    - Do NOT include places from other countries (Pakistan, Bangladesh, Nepal, China, etc.)
    - Verify the exact administrative location of each place is IN INDIA

    INDIA-ONLY REQUIREMENT:
    - Every place must be located within the territorial boundaries of India
    - Do NOT include places from neighboring countries
    - Do NOT include places from disputed territories outside India
    - Focus only on Indian tourist attractions

    DISTRICT-SPECIFIC ACCURACY:
    - If searching for "Shivamogga district" - only include places in Shivamogga district, India
    - If searching for "Bangalore" - only include places in Bangalore Urban district, India
    - If searching for "Mysore" - only include places in Mysore district, India
    - Each place must be administratively part of the specified district IN INDIA

    Priority order:
    1. Most famous landmarks, monuments, and tourist attractions IN THIS DISTRICT, INDIA
    2. Popular zoos, safari parks, and wildlife sanctuaries IN THIS DISTRICT, INDIA
    3. Famous temples, historical sites, and cultural attractions IN THIS DISTRICT, INDIA
    4. Well-known parks, gardens, and recreational areas IN THIS DISTRICT, INDIA
    5. Popular museums, galleries, and educational attractions IN THIS DISTRICT, INDIA

    VERIFICATION CHECKLIST:
    - Is this place located in India?
    - Is this place administratively located in the specified district?
    - Is this place within the district boundaries?
    - Is this place not in a neighboring district or country?

    Examples of CORRECT India-only district-specific results:
    - For Shivamogga district: Lion Tiger Safari And Zoo, Jog Falls, Kodachadri, Agumbe
    - For Bangalore Urban district: Lalbagh Botanical Garden, Cubbon Park, Vidhana Soudha
    - For Mysore district: Mysore Palace, Chamundi Hills, Brindavan Gardens

    Examples of INCORRECT results to avoid:
    - For Shivamogga district: Someshwara Wildlife Sanctuary (not in Shivamogga district)
    - For Shivamogga district: Shivagiri (not in Shivamogga district)
    - Any place from Pakistan, Bangladesh, Nepal, China, or other countries

Return strict JSON with this schema:
{
  "city": string,
  "places": [
    { "title": string, "description": string, "wikipediaTitle": string }
  ]
}
Use accurate local names for wikipediaTitle suitable for Wikipedia search.`;

  let json: any = null;
  try {
    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
    const text = result.response.text();
    try {
      json = JSON.parse(text);
    } catch {
      json = { city: toCityFromText(text) || city || null, places: [] };
    }
  } catch (e) {
    // Fallback: Try reverse geocoding if only lat/lng provided, then Wikipedia search
    let fallbackCity = city || "";
    if (!fallbackCity && lat && lng) {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=10&addressdetails=1`, { headers: { "User-Agent": "traveladvisor/1.0" } });
        const g: any = await r.json();
        const addr = g?.address || {};
        fallbackCity = addr.city || addr.town || addr.village || addr.county || addr.state || "";
      } catch {}
    }
    // If still no city, return soft 200 with empty list to avoid client error state
    if (!fallbackCity) {
      return NextResponse.json({ city: null, places: [] });
    }
    try {
      const search = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(fallbackCity + " tourist attractions India")}&format=json&srlimit=${count}`);
      const sdata = await search.json();
      const places = (sdata?.query?.search || []).slice(0, count).map((s: any) => ({ title: s.title, description: s.snippet?.replace(/<[^>]+>/g, "") || "", wikipediaTitle: s.title }));
      json = { city: fallbackCity, places };
    } catch {
      return NextResponse.json({ error: "Failed to fetch places" }, { status: 500 });
    }
  }

  const cityName = json?.city || city || null;
  
  // District-specific handling for all Indian districts
  const districtSpecificPlaces = getDistrictSpecificPlaces(cityName);
  console.log(`City: ${cityName}, Requested count: ${count}, Predefined places: ${districtSpecificPlaces.length}`);
  
  let places: any[] = [];
  
  if (districtSpecificPlaces.length > 0) {
    // Start with predefined places (use more if available)
    const predefinedPlaces = districtSpecificPlaces.slice(0, Math.min(count, districtSpecificPlaces.length));
    places = [...predefinedPlaces];
    console.log(`Using ${predefinedPlaces.length} predefined places: ${predefinedPlaces.map(p => p.title).join(', ')}`);
    
    // If we need more places than predefined, use AI to add more
    if (places.length < count) {
      const remainingCount = count - places.length;
      console.log(`Need ${remainingCount} more places, calling AI...`);
      
      const aiPrompt = `You are a local travel expert specializing in Indian tourism. List ${remainingCount} ADDITIONAL famous tourist attractions in ${cityName}, India that are NOT already mentioned in this list: ${predefinedPlaces.map(p => p.title).join(', ')}.

      CRITICAL REQUIREMENTS:
      - ONLY include places that are physically located WITHIN INDIA
      - ONLY include places that are physically located WITHIN ${cityName}, India
      - Do NOT repeat any places from the existing list
      - Focus on OTHER famous attractions in ${cityName}
      - Verify each place is actually in ${cityName}, India

      INDIA-ONLY REQUIREMENT:
      - Every place must be located within the territorial boundaries of India
      - Do NOT include places from neighboring countries
      - Focus only on Indian tourist attractions

      DISTRICT-SPECIFIC ACCURACY:
      - Each place must be administratively part of ${cityName}, India
      - Verify each place is actually located in ${cityName}

      Priority order:
      1. Most famous landmarks, monuments, and tourist attractions IN ${cityName}, INDIA
      2. Popular zoos, safari parks, and wildlife sanctuaries IN ${cityName}, INDIA
      3. Famous temples, historical sites, and cultural attractions IN ${cityName}, INDIA
      4. Well-known parks, gardens, and recreational areas IN ${cityName}, INDIA
      5. Popular museums, galleries, and educational attractions IN ${cityName}, INDIA

      VERIFICATION CHECKLIST:
      - Is this place located in India?
      - Is this place administratively located in ${cityName}?
      - Is this place within the city boundaries?
      - Is this place not in a neighboring district or country?

      Return strict JSON with this schema:
      {
        "city": "${cityName}",
        "places": [
          { "title": string, "description": string, "wikipediaTitle": string }
        ]
      }
      Use accurate local names for wikipediaTitle suitable for Wikipedia search.`;

      try {
        const aiResult = await model.generateContent({ contents: [{ role: "user", parts: [{ text: aiPrompt }] }] });
        const aiText = aiResult.response.text();
        console.log('AI Response:', aiText);
        const aiJson = JSON.parse(aiText);
        const additionalPlaces = Array.isArray(aiJson?.places) ? aiJson.places.slice(0, remainingCount) : [];
        console.log(`AI generated ${additionalPlaces.length} additional places: ${additionalPlaces.map((p: any) => p.title).join(', ')}`);
        places.push(...additionalPlaces);
      } catch (error) {
        console.log('AI supplement failed:', error);
      }
    }
  } else {
    console.log(`No predefined places for ${cityName}, using AI for all ${count} places`);
    // If no predefined places, use AI to generate all places
    try {
      const aiPrompt = `You are a local travel expert specializing in Indian tourism. List ${count} famous tourist attractions in ${cityName}, India.

      CRITICAL REQUIREMENTS:
      - ONLY include places that are physically located WITHIN INDIA
      - ONLY include places that are physically located WITHIN ${cityName}, India
      - Focus on famous attractions in ${cityName}
      - Verify each place is actually in ${cityName}, India

      INDIA-ONLY REQUIREMENT:
      - Every place must be located within the territorial boundaries of India
      - Do NOT include places from neighboring countries
      - Focus only on Indian tourist attractions

      DISTRICT-SPECIFIC ACCURACY:
      - Each place must be administratively part of ${cityName}, India
      - Verify each place is actually located in ${cityName}

      Priority order:
      1. Most famous landmarks, monuments, and tourist attractions IN ${cityName}, INDIA
      2. Popular zoos, safari parks, and wildlife sanctuaries IN ${cityName}, INDIA
      3. Famous temples, historical sites, and cultural attractions IN ${cityName}, INDIA
      4. Well-known parks, gardens, and recreational areas IN ${cityName}, INDIA
      5. Popular museums, galleries, and educational attractions IN ${cityName}, INDIA

      VERIFICATION CHECKLIST:
      - Is this place located in India?
      - Is this place administratively located in ${cityName}?
      - Is this place within the city boundaries?
      - Is this place not in a neighboring district or country?

      Return strict JSON with this schema:
      {
        "city": "${cityName}",
        "places": [
          { "title": string, "description": string, "wikipediaTitle": string }
        ]
      }
      Use accurate local names for wikipediaTitle suitable for Wikipedia search.`;

      const aiResult = await model.generateContent({ contents: [{ role: "user", parts: [{ text: aiPrompt }] }] });
      const aiText = aiResult.response.text();
      console.log('AI Response for all places:', aiText);
      const aiJson = JSON.parse(aiText);
      const aiPlaces = Array.isArray(aiJson?.places) ? aiJson.places.slice(0, count) : [];
      console.log(`AI generated ${aiPlaces.length} places: ${aiPlaces.map((p: any) => p.title).join(', ')}`);
      places = [...aiPlaces];
    } catch (error) {
      console.log('AI generation failed:', error);
      // Fallback to original AI result if available
      places = Array.isArray(json?.places) ? json.places.slice(0, count) : [];
    }
  }
  
  console.log(`Final places count: ${places.length}`);
  
  const enriched = await Promise.all(
    places.map(async (p: any) => {
      const title = String(p?.title || "").trim();
      const wikiTitle = String(p?.wikipediaTitle || title).trim();
      // Use existing imageUrl if provided, otherwise fetch from Wikipedia
      const image = p?.imageUrl || await fetchExactPlaceImage(wikiTitle, cityName);
      const mapsQuery = [title, cityName, "India"].filter(Boolean).join(", ");
      return {
        title,
        description: String(p?.description || "").trim(),
        imageUrl: image, // Use existing image or fetch from Wikipedia
        wikiTitle,
        mapsUrl: generateMapsSearchUrl(mapsQuery),
      };
    })
  );


  const payload = { city: cityName, places: enriched };
  if (cacheKey) cache.set(cacheKey, { expiry: Date.now() + 5 * 60 * 1000, value: payload });
  return NextResponse.json(payload);
}