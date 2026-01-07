import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { EnergyPriceEntry } from '@/types/energy-prices';

export async function GET(request: NextRequest) {
    try {
        // Enforce Authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        try {
            await adminAuth.verifyIdToken(token);
        } catch (error) {
            console.error('Token verification failed:', error);
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const date = searchParams.get('date');

        // Build query
        let query = adminDb.collection('energy_prices');

        if (date) {
            // If date is specified, get all 24 hours for that date
            query = query.where('date', '==', date).orderBy('hour', 'asc') as any;
        } else {
            // If no date, get limited sample sorted by hour
            query = query.orderBy('hour', 'asc').limit(1000) as any;
        }

        const snapshot = await query.get();

        const prices: EnergyPriceEntry[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            prices.push({
                id: doc.id,
                date: data.date,
                hour: data.hour,
                price: data.price,
                createdAt: data.createdAt,
                createdBy: data.createdBy
            });
        });

        return NextResponse.json({ prices, count: prices.length }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });
    } catch (error: any) {
        console.error('Error fetching energy prices:', error);
        return NextResponse.json(
            { error: 'Failed to fetch energy prices', details: error.message },
            { status: 500 }
        );
    }
}
