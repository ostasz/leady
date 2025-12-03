import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { EnergyPriceEntry } from '@/types/energy-prices';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const date = searchParams.get('date');

        // Build query
        let query = adminDb.collection('energy_prices');

        if (date) {
            query = query.where('date', '==', date) as any;
        }

        query = query.orderBy('date', 'desc').orderBy('hour', 'asc') as any;

        // Limit to recent data if no date specified
        if (!date) {
            query = query.limit(100) as any;
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

        return NextResponse.json({ prices, count: prices.length });
    } catch (error: any) {
        console.error('Error fetching energy prices:', error);
        return NextResponse.json(
            { error: 'Failed to fetch energy prices', details: error.message },
            { status: 500 }
        );
    }
}
