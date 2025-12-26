import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    try {
        const today = new Date();
        const currentYear = today.getFullYear();
        const nextYear = currentYear + 1;
        const nextNextYear = currentYear + 2;

        const nextYearShort = nextYear.toString().slice(-2);
        const nextNextYearShort = nextNextYear.toString().slice(-2);

        // Contract names e.g., "BASE_Y-26", "BASE_Y-27"
        const contractY1 = `BASE_Y-${nextYearShort}`;
        const contractY2 = `BASE_Y-${nextNextYearShort}`;

        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam) : 30;

        console.log(`Fetching futures for ${contractY1} and ${contractY2}`);

        const [y1Snapshot, y2Snapshot] = await Promise.all([
            adminDb.collection('futures_data')
                .where('contract', '==', contractY1)
                .get(),
            adminDb.collection('futures_data')
                .where('contract', '==', contractY2)
                .get()
        ]);

        const formatData = (snap: FirebaseFirestore.QuerySnapshot) => {
            return snap.docs
                .map(doc => {
                    const data = doc.data();
                    return {
                        date: data.date,
                        price: data.DKR || data.closingPrice || 0, // DKR (formerly closingPrice)
                        max: data.maxPrice,
                        min: data.minPrice,
                        volume: data.volume,
                        openInterest: data.openInterest
                    };
                })
                .sort((a, b) => a.date.localeCompare(b.date));
        };

        const y1History = formatData(y1Snapshot);
        const y2History = formatData(y2Snapshot);

        const y1Sliced = limit > 0 && limit < y1History.length ? y1History.slice(-limit) : y1History;
        const y2Sliced = limit > 0 && limit < y2History.length ? y2History.slice(-limit) : y2History;

        return NextResponse.json({
            futures: {
                [nextYear]: y1Sliced,
                [nextNextYear]: y2Sliced
            }
        });

    } catch (error: any) {
        console.error('Error fetching futures:', error);
        return NextResponse.json(
            { error: 'Failed to fetch futures', details: error.message },
            { status: 500 }
        );
    }
}
