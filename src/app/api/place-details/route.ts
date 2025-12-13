import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { logUsage } from '@/lib/usage';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const { searchParams } = new URL(request.url);
        const placeId = searchParams.get('placeId');

        if (!placeId) {
            return NextResponse.json({ error: 'Place ID is required' }, { status: 400 });
        }

        if (!API_KEY) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Fetch details specifically requested by user
        const fields = 'formatted_phone_number,website,editorial_summary,opening_hours';
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}&language=pl`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== 'OK') {
            // If Google API error, return it but don't log usage as successful "value"
            return NextResponse.json({ error: data.error_message || 'Failed to fetch details' }, { status: 400 });
        }

        // Log specific usage for cost tracking
        await logUsage(uid, 'google_maps', 'place_details', 1, { placeId });

        const result = data.result || {};

        return NextResponse.json({
            phone: result.formatted_phone_number,
            website: result.website,
            summary: result.editorial_summary?.overview,
            openingHours: result.opening_hours?.weekday_text
        });

    } catch (error: unknown) {
        console.error('Place details error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
