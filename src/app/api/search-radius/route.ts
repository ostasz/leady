import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

async function geocode(address: string) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK') {
        return data.results[0].geometry.location;
    }
    throw new Error(data.error_message || 'Geocoding failed');
}

import { LEAD_PROFILES, ProfileKey } from '@/config/lead-profiles';

async function searchNearby(location: { lat: number; lng: number }, radius: number, profiles: string[]) {
    // Default to heavy industry if no profiles selected
    const selectedKeys = (profiles.length > 0 ? profiles : ['heavy_industry']) as ProfileKey[];

    // Collect all keywords from selected profiles
    let allKeywords: string[] = [];
    selectedKeys.forEach(key => {
        if (LEAD_PROFILES[key]) {
            allKeywords = [...allKeywords, ...LEAD_PROFILES[key].keywords];
        }
    });

    // Join with OR operator for Google Places API
    // Note: Google Places API 'keyword' parameter matches ANY of the terms if separated by pipe? 
    // Actually, official docs say 'keyword' matches against all fields. 
    // To match ANY, we might need multiple requests or rely on the pipe behavior which is unofficial but often works,
    // OR just send a broad query. 
    // Given the user's instruction "Zestaw słów kluczowych... na tej podstawie budować zapytania", 
    // and the previous code used pipe, we will stick to pipe.
    // However, too many keywords might break the request. 
    // Let's try to join them. If it fails, we might need to limit.
    const keyword = allKeywords.join('|');

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&keyword=${encodeURIComponent(keyword)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Places search failed: ${data.status}`);
    }
    return data.results || [];
}

async function getPlaceDetails(placeId: string) {
    const fields = 'formatted_phone_number,website,editorial_summary';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.result || {};
}

export async function GET(request: Request) {
    try {
        // Get Firebase Auth token
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        // Update search count
        await adminDb.collection('users').doc(uid).update({
            searchCount: (await adminDb.collection('users').doc(uid).get()).data()?.searchCount + 1 || 1
        }).catch(() => { });

        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');
        const profilesParam = searchParams.get('profiles');
        const profiles = profilesParam ? profilesParam.split(',') : [];

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        const location = await geocode(address);
        const results = await searchNearby(location, 20000, profiles); // 20km radius

        // Sort by prominence
        results.sort((a: any, b: any) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0));
        const top20 = results.slice(0, 20);

        // Fetch details for top 20
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
