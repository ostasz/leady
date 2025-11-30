import { NextResponse } from 'next/server';
import { decode } from '@googlemaps/polyline-codec';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

async function getDirections(origin: string, destination: string) {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK' || !data.routes[0]) {
        throw new Error(`Directions failed: ${data.status}`);
    }
    return data.routes[0];
}

async function searchNearby(location: { lat: number; lng: number }, radius: number) {
    const keyword = 'manufacturing|factory|industrial';
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&keyword=${encodeURIComponent(keyword)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results || [];
}

async function getPlaceDetails(placeId: string) {
    const fields = 'formatted_phone_number,website,editorial_summary';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.result || {};
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
        await adminAuth.verifyIdToken(token);

        const { searchParams } = new URL(request.url);
        const origin = searchParams.get('origin');
        const destination = searchParams.get('destination');

        if (!origin || !destination) {
            return NextResponse.json({ error: 'Origin and destination required' }, { status: 400 });
        }

        const route = await getDirections(origin, destination);
        const polyline = route.overview_polyline.points;
        const path = decode(polyline).map(([lat, lng]) => ({ lat, lng }));
        const samples = samplePath(path, 10000);
        const limitedSamples = samples.slice(0, 20);

        const resultsPromises = limitedSamples.map(p => searchNearby(p, 5000));
        const resultsArrays = await Promise.all(resultsPromises);

        const allPlaces = new Map();
        resultsArrays.flat().forEach((place: any) => {
            if (!allPlaces.has(place.place_id)) {
                allPlaces.set(place.place_id, place);
            }
        });

        const uniquePlaces = Array.from(allPlaces.values());
        uniquePlaces.sort((a: any, b: any) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0));
        const top20 = uniquePlaces.slice(0, 20);

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
            route: path,
            results: detailedResults
        });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
