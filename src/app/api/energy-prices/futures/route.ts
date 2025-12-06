import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    try {
        const today = new Date();
        const nextYear = today.getFullYear() + 1;
        const nextNextYear = today.getFullYear() + 2;

        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam) : 30; // Default to 30 if not specified

        console.log(`Fetching futures for Y+1 (${nextYear}) and Y+2 (${nextNextYear}) with limit: ${limit === 0 ? 'ALL' : limit}`);

        // Fetch ALL data for the requested years to avoid composite index requirements
        // The dataset is small (one quote per day), so in-memory sorting is fine.
        const [y1Snapshot, y2Snapshot] = await Promise.all([
            adminDb.collection('energy_futures')
                .where('contractType', '==', 'BASE')
                .where('deliveryYear', '==', nextYear)
                .get(),
            adminDb.collection('energy_futures')
                .where('contractType', '==', 'BASE')
                .where('deliveryYear', '==', nextNextYear)
                .get()
        ]);

        const formatData = (snap: FirebaseFirestore.QuerySnapshot) => {
            return snap.docs
                .map(doc => {
                    const data = doc.data();
                    return {
                        date: data.date,
                        price: data.price,
                    };
                })
                .sort((a, b) => a.date.localeCompare(b.date)); // Sort ASC by date string (YYYY-MM-DD works with string sort)
        };

        const y1History = formatData(y1Snapshot);
        const y2History = formatData(y2Snapshot);

        // Return sliced data based on limit (0 means all data)
        const y1Sliced = limit > 0 ? y1History.slice(-limit) : y1History;
        const y2Sliced = limit > 0 ? y2History.slice(-limit) : y2History;

        console.log(`Found ${y1History.length} entries for ${nextYear}, ${y2History.length} for ${nextNextYear}`);

        return NextResponse.json({
            futures: {
                [nextYear]: y1Sliced, // Return sorted ASC for charts
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
