import { NextResponse } from 'next/server';
import { decode } from '@googlemaps/polyline-codec';
import { auth } from '@/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
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
    const R = 6371e3; // metres
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

    // Always include start
    if (path.length > 0) samples.push(path[0]);

    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];
        const d = distance(p1, p2);

        if (accumulatedDist + d >= intervalMeters) {
            // Simple approximation: just take p2. 
            // For better precision we could interpolate, but for 5km radius search, p2 is fine if segments are small.
            // Polyline points are usually dense enough.
            samples.push(p2);
            accumulatedDist = 0;
        } else {
            accumulatedDist += d;
        }
    }

    return samples;
}

export async function GET(request: Request) {
    const session = await auth();
    if (session?.user?.id) {
        prisma.user.update({
            where: { id: session.user.id },
            data: { searchCount: { increment: 1 } }
        }).catch(err => console.error('Failed to update search count', err));
    }

    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');

    if (!origin || !destination) {
        return NextResponse.json({ error: 'Origin and destination are required' }, { status: 400 });
    }

    try {
        const route = await getDirections(origin, destination);
        const polyline = route.overview_polyline.points;
        // decode returns array of [lat, lng] tuples
        const path = decode(polyline).map(([lat, lng]) => ({ lat, lng }));

        // Sample every 10km (10000m). Radius is 5km, so 10km spacing leaves no gaps (5+5).
        const samples = samplePath(path, 10000);

        // Limit samples to avoid excessive API usage (e.g. max 20 searches)
        const limitedSamples = samples.slice(0, 20);

        // Parallel fetch
        const resultsPromises = limitedSamples.map(p => searchNearby(p, 5000));
        const resultsArrays = await Promise.all(resultsPromises);

        // Deduplicate
        const allPlaces = new Map();
        resultsArrays.flat().forEach((place: any) => {
            if (!allPlaces.has(place.place_id)) {
                allPlaces.set(place.place_id, place);
            }
        });

        const uniquePlaces = Array.from(allPlaces.values());

        // Sort by rating/reviews as proxy for size/prominence
        uniquePlaces.sort((a: any, b: any) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0));

        const top20 = uniquePlaces.slice(0, 20);

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
            route: path, // Return path to draw on map
            results: detailedResults
        });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
