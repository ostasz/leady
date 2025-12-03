import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

interface GooglePlaceResult {
    place_id: string;
    name: string;
    formatted_address?: string;
    vicinity?: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
    rating?: number;
    user_ratings_total?: number;
    types?: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

async function geocode(address: string) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK') {
        return data.results[0].geometry.location;
    }
    throw new Error(data.error_message || 'Geocoding failed');
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

import { LEAD_PROFILES, ProfileKey } from '@/config/lead-profiles';

// Modified to search for a SINGLE profile to ensure separation of concerns
async function searchForProfile(address: string, location: { lat: number; lng: number }, radius: number, profileKey: string) {
    if (!LEAD_PROFILES[profileKey as ProfileKey]) return [];

    const profile = LEAD_PROFILES[profileKey as ProfileKey];
    const allKeywords = profile.keywords;

    // Helper to execute search
    const executeSearch = async (queryStr: string) => {
        let results: GooglePlaceResult[] = [];
        let nextToken = '';
        // console.log(`[${profile.label}] Executing search: "${queryStr}"`);

        for (let i = 0; i < 3; i++) {
            let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(queryStr)}&location=${location.lat},${location.lng}&radius=${radius}&key=${API_KEY}`;

            if (nextToken) {
                url += `&pagetoken=${nextToken}`;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            const res = await fetch(url);
            const data = await res.json();

            if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                console.error(`[${profile.label}] Page ${i + 1} failed: ${data.status}`);
                break;
            }

            if (data.results) {
                results = [...results, ...data.results];
            }

            nextToken = data.next_page_token;
            if (!nextToken) break;
        }
        return results;
    };

    // Helper to filter results
    const filterResults = (results: GooglePlaceResult[]) => {
        return results.filter((place: GooglePlaceResult) => {
            const dist = calculateDistance(
                location.lat,
                location.lng,
                place.geometry.location.lat,
                place.geometry.location.lng
            );
            const isWithin = dist <= (radius / 1000); // Convert radius to km

            if (!isWithin) {
                console.log(`[Filter] Dropping "${place.name}" - Distance: ${dist.toFixed(2)}km > ${radius / 1000}km`);
            }
            return isWithin;
        });
    };

    // STRATEGY: "The Masarnia Mechanism"
    // Google Places API does NOT support "OR" operator reliably.
    // Instead of one giant query, we pick the top 2-3 keywords and run separate searches.
    // This guarantees we find "Masarnia" AND "Zakład mięsny" without syntax errors.

    const topKeywords = allKeywords.slice(0, 2); // Take top 2 keywords to manage quota
    const combinedResults: GooglePlaceResult[] = [];
    const seenPlaceIds = new Set<string>();

    for (const keyword of topKeywords) {
        // 1. Specific Search: "Keyword City"
        // We try specific first to get best matches in the city center.
        const specificQuery = `${keyword} ${address}`;
        // console.log(`[${profile.label}] Specific: "${specificQuery}"`);
        const specificRes = await executeSearch(specificQuery);
        let keywordResults = [...filterResults(specificRes)];

        // 2. Broad Search: "Keyword" + Radius
        // "The Masarnia Mechanism": ALWAYS trigger broad search expansion to find results in the radius.
        // This ensures we don't miss places just because they don't have the city name in their address.

        // console.log(`[${profile.label}] Broad: "${keyword}" (Radius: ${radius/1000}km)`);
        const broadRes = await executeSearch(keyword);
        const filteredBroad = filterResults(broadRes);
        keywordResults = [...keywordResults, ...filteredBroad];

        // Merge into combined
        for (const place of keywordResults) {
            if (!seenPlaceIds.has(place.place_id)) {
                seenPlaceIds.add(place.place_id);
                combinedResults.push(place);
            }
        }
    }

    console.log(`[${profile.label}] Total unique results: ${combinedResults.length}`);
    return combinedResults;
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
        const radiusParam = searchParams.get('radius');

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        const location = await geocode(address);

        // Execute search for EACH profile independently to maximize results
        // and prevent one category from drowning out another
        const allCombinedResults: GooglePlaceResult[] = [];
        const processedIds = new Set<string>();

        for (const profileKey of profiles) {
            // Determine radius based on profile type or custom param
            // If custom radius is provided (in km), convert to meters.
            // Otherwise fallback to defaults: 'agro_farm' gets 50km, others 20km
            const isFarm = profileKey === 'agro_farm';
            let radius = isFarm ? 50000 : 20000;

            if (radiusParam) {
                const customRadiusKm = parseInt(radiusParam);
                if (!isNaN(customRadiusKm) && customRadiusKm > 0) {
                    radius = customRadiusKm * 1000; // Convert km to meters
                }
            }

            console.log(`[Search] Profile: ${profileKey}, IsFarm: ${isFarm}, Radius: ${radius}m`);

            const results = await searchForProfile(address, location, radius, profileKey);

            // Add unique results
            for (const place of results) {
                if (!processedIds.has(place.place_id)) {
                    processedIds.add(place.place_id);
                    allCombinedResults.push(place);
                }
            }
        }

        // Fetch details for all results (no ranking/sorting)
        const detailedResults = await Promise.all(allCombinedResults.map(async (place: GooglePlaceResult) => {
            const details = await getPlaceDetails(place.place_id);
            return {
                id: place.place_id,
                name: place.name,
                address: place.formatted_address || place.vicinity,
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
    } catch (error: unknown) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
