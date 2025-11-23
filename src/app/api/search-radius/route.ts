import { NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('Missing Google Maps API Key');
}

async function geocode(address: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.status !== 'OK' || !data.results[0]) {
    throw new Error(`Geocoding failed: ${data.status}`);
  }
  
  return data.results[0].geometry.location; // { lat, lng }
}

async function searchNearby(location: { lat: number; lng: number }, radius: number) {
  // Use keyword for broader matching of manufacturing/industrial types
  const keyword = 'manufacturing|factory|industrial';
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&keyword=${encodeURIComponent(keyword)}&key=${GOOGLE_MAPS_API_KEY}`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Places search failed: ${data.status}`);
  }
  
  return data.results || [];
}

async function getPlaceDetails(placeId: string) {
  const fields = 'formatted_phone_number,website,editorial_summary';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.result || {};
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  try {
    const location = await geocode(address);
    // 20km radius
    const results = await searchNearby(location, 20000);
    
    // Sort by prominence (rating/reviews)
    results.sort((a: any, b: any) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0));

    // Take top 20
    const top20 = results.slice(0, 20);

    // Fetch details for top 20 in parallel
    const detailedResults = await Promise.all(top20.map(async (place: any) => {
      const details = await getPlaceDetails(place.place_id);
      return {
        id: place.place_id,
        name: place.name,
        address: place.vicinity,
        location: place.geometry.location,
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        types: place.types,
        phone: details.formatted_phone_number,
        website: details.website,
        summary: details.editorial_summary?.overview
      };
    }));

    return NextResponse.json({ 
      center: location,
      results: detailedResults 
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
