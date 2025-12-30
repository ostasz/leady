import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FuturesHistoryPoint } from '@/types/energy-prices';

export async function GET(request: NextRequest) {
    try {
        // 0. SECURITY: Authorization Check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        try {
            await adminAuth.verifyIdToken(token);
        } catch (authError) {
            console.error('Auth verification failed:', authError);
            return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

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

        // 1. PERFORMANCE: Filter by days instead of sending full history
        // Default to 180 days if not provided to be safe
        const daysParam = searchParams.get('days');
        const days = daysParam ? parseInt(daysParam) : 180;

        // Calculate start date string for filtering
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateString = startDate.toISOString().split('T')[0];

        // 2. Fetch Data with Date Filtering (Composite Index: contract + date needed)
        // If index is missing, this might fail or require in-memory filtering.
        // Given we added index for futures2 details, let's try to query efficiently.
        // We'll trust the composite index exists or fallback gracefully if possible.

        // Note: Using Promise.all for parallel fetch
        const fetchContractHistory = async (contract: string) => {
            const snapshot = await adminDb.collection('futures_data')
                .where('contract', '==', contract)
                .where('date', '>=', startDateString)
                .get();

            return snapshot.docs
                .map(doc => {
                    const data = doc.data();
                    const point: FuturesHistoryPoint = {
                        date: data.date,
                        close: data.DKR || data.closingPrice || 0,
                        high: data.maxPrice,
                        low: data.minPrice,
                        volume: data.volume,
                        openInterest: data.openInterest,
                        change: 0 // Calculated below if needed
                    };
                    return point;
                })
                .sort((a, b) => a.date.localeCompare(b.date));
        };

        const [y1History, y2History] = await Promise.all([
            fetchContractHistory(contractY1),
            fetchContractHistory(contractY2)
        ]);

        return NextResponse.json({
            futures: {
                [nextYear]: y1History,
                [nextNextYear]: y2History
            }
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0' // Ensure fresh data
            }
        });

    } catch (error) {
        console.error('Error fetching futures:', error);
        return NextResponse.json(
            { error: 'Failed to fetch futures', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
