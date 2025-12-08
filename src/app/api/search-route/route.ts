import { NextResponse } from 'next/server';
import { decode } from '@googlemaps/polyline-codec';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logUsage } from '@/lib/usage';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

async function getDirections(origin: string, destination: string, uid: string) {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${API_KEY}&language=pl`;
    const res = await fetch(url);
    const data = await res.json();

    await logUsage(uid, 'google_maps', 'directions', 1, { origin, destination });

    if (data.status !== 'OK' || !data.routes[0]) {
        throw new Error(`Directions failed: ${data.status}`);
    }
    return data.routes[0];
}

async function searchNearby(location: { lat: number; lng: number }, radius: number, uid: string) {
    const keyword = 'manufacturing|factory|industrial';
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&keyword=${encodeURIComponent(keyword)}&key=${API_KEY}&language=pl`;
    const res = await fetch(url);
    const data = await res.json();

    await logUsage(uid, 'google_maps', 'nearby_search', 1, { location, radius });

    return data.results || [];
}

function distance(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) {
    const R = 6371e3;
    const φ1 = p1.lat * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180;
    const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
    const Δλ = (p2.lng - p1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function samplePath(path: { lat: number; lng: number }[], intervalMeters: number) {
    const samples = [];
    let accumulatedDist = 0;

    if (path.length > 0) samples.push(path[0]);

    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        const d = distance(p1, p2);

        if (accumulatedDist + d >= intervalMeters) {
            samples.push(p2);
            accumulatedDist = 0;
        } else {
            accumulatedDist += d;
        }
    }

    return samples;
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
        const uid = decodedToken.uid; // Extract UID

        const { searchParams } = new URL(request.url);
        const origin = searchParams.get('origin');
        const destination = searchParams.get('destination');

        if (!origin || !destination) {
            return NextResponse.json({ error: 'Origin and destination required' }, { status: 400 });
        }

        const route = await getDirections(origin, destination, uid);
        const polyline = route.overview_polyline.points;
        const path = decode(polyline).map(([lat, lng]) => ({ lat, lng }));
        const samples = samplePath(path, 10000);
        // Sample less frequently or limit samples to save Nearby Search costs if needed
        const limitedSamples = samples.slice(0, 20);

        const resultsPromises = limitedSamples.map(p => searchNearby(p, 5000, uid));
        const resultsArrays = await Promise.all(resultsPromises);

        const allPlaces = new Map();
        resultsArrays.flat().forEach((place: any) => {
            if (!allPlaces.has(place.place_id)) {
                allPlaces.set(place.place_id, place);
            }
        });

        const uniquePlaces = Array.from(allPlaces.values());
        uniquePlaces.sort((a: any, b: any) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0));

        // Increased limit to 40 as requested
        const topResults = uniquePlaces.slice(0, 40);

        // Map to simplified structure (Details on Demand)
        const simplifiedResults = topResults.map((place: any) => ({
            id: place.place_id,
            name: place.name,
            address: place.vicinity, // nearbysearch returns vicinity
            location: place.geometry.location,
            rating: place.rating,
            user_ratings_total: place.user_ratings_total,
            types: place.types,
            // Details are fetched on demand via /api/place-details
        }));

        return NextResponse.json({
            route: path,
            results: simplifiedResults
        });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
