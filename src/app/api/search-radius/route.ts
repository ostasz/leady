import { NextResponse } from 'next/server';
import { adminAuth, adminDb, admin } from '@/lib/firebase-admin';
import { logUsage } from '@/lib/usage';
import { LEAD_PROFILES, ProfileKey } from '@/config/lead-profiles';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
    throw new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY");
}

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

// Helper for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function geocode(address: string) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Geocoding HTTP error: ${res.status}`);

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

async function searchForProfile(address: string, location: { lat: number; lng: number }, radius: number, profileKey: string, uid: string) {
    if (!LEAD_PROFILES[profileKey as ProfileKey]) return [];

    const profile = LEAD_PROFILES[profileKey as ProfileKey];
    const allKeywords = profile.keywords;

    const executeSearch = async (queryStr: string) => {
        let results: GooglePlaceResult[] = [];
        let nextToken = '';

        for (let i = 0; i < 3; i++) {
            let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(queryStr)}&location=${location.lat},${location.lng}&radius=${radius}&key=${API_KEY}&language=pl`;

            if (nextToken) {
                url += `&pagetoken=${nextToken}`;
                // Google requires time to register the token
                await delay(2000);
            }

            const res = await fetch(url);
            if (!res.ok) {
                console.error(`Fetch failed: ${res.status}`);
                break;
            }

            const data = await res.json();

            // Log Text Search Usage
            await logUsage(uid, 'google_maps', 'text_search', 1, { query: queryStr, page: i + 1 });

            if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                console.error(`[${profile.label}] Page ${i + 1} failed: ${data.status} - ${data.error_message}`);
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

    const filterResults = (results: GooglePlaceResult[]) => {
        return results.filter((place: GooglePlaceResult) => {
            if (!place.geometry?.location) return false; // Safety check

            const dist = calculateDistance(
                location.lat,
                location.lng,
                place.geometry.location.lat,
                place.geometry.location.lng
            );
            return dist <= (radius / 1000);
        });
    };

    const topKeywords = allKeywords.slice(0, 2);
    const combinedResults: GooglePlaceResult[] = [];
    const seenPlaceIds = new Set<string>();

    for (const keyword of topKeywords) {
        // 1. Specific Search: "Keyword City"
        const specificQuery = `${keyword} ${address}`;
        const specificRes = await executeSearch(specificQuery);
        let keywordResults = [...filterResults(specificRes)];

        // 2. Broad Search: "Keyword" + Radius ("The Masarnia Mechanism")
        const broadRes = await executeSearch(keyword);
        const filteredBroad = filterResults(broadRes);
        keywordResults = [...keywordResults, ...filteredBroad];

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

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        // Atomic increment of search count
        await adminDb.collection('users').doc(uid).set({
            searchCount: admin.firestore.FieldValue.increment(1)
        }, { merge: true });

        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');
        const profilesParam = searchParams.get('profiles');
        const profiles = profilesParam ? profilesParam.split(',') : [];
        const radiusParam = searchParams.get('radius');

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        const location = await geocode(address);
        await logUsage(uid, 'google_maps', 'geocoding', 1, { query: address });

        const allCombinedResults: GooglePlaceResult[] = [];
        const processedIds = new Set<string>();

        for (const profileKey of profiles) {
            const isFarm = profileKey === 'agro_farm';
            let radius = isFarm ? 50000 : 20000;

            if (radiusParam) {
                const customRadiusKm = parseInt(radiusParam);
                if (!isNaN(customRadiusKm) && customRadiusKm > 0) {
                    radius = customRadiusKm * 1000;
                }
            }

            const results = await searchForProfile(address, location, radius, profileKey, uid);

            for (const place of results) {
                if (!processedIds.has(place.place_id)) {
                    processedIds.add(place.place_id);
                    allCombinedResults.push(place);
                }
            }
        }

        // Return basic results directly (Details on Demand model)
        const simplifiedResults = allCombinedResults.map(place => ({
            id: place.place_id,
            name: place.name,
            address: place.formatted_address || place.vicinity,
            location: place.geometry.location,
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            types: place.types,
            // Details (phone, website, summary) are now fetched via /api/place-details
        }));

        return NextResponse.json({
            center: location,
            results: simplifiedResults
        });
    } catch (error: unknown) {
        console.error(error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
