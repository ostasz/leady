import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

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

        const { searchParams } = new URL(request.url);
        const quartersParam = searchParams.get('quarters'); // e.g., "Q1,Q2"
        const yearParam = searchParams.get('year'); // e.g., "2025"

        if (!quartersParam) {
            return NextResponse.json({ error: 'Quarters parameter required' }, { status: 400 });
        }

        const quarters = quartersParam.split(',');
        const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

        // Map quarters to month ranges
        const quarterMonths: Record<string, { start: number; end: number }> = {
            'Q1': { start: 1, end: 3 },
            'Q2': { start: 4, end: 6 },
            'Q3': { start: 7, end: 9 },
            'Q4': { start: 10, end: 12 }
        };

        // Build date ranges for selected quarters
        const dateRanges: { startDate: string; endDate: string }[] = [];
        for (const quarter of quarters) {
            const range = quarterMonths[quarter];
            if (!range) continue;

            const startDate = `${year}-${String(range.start).padStart(2, '0')}-01`;
            const endDate = `${year}-${String(range.end).padStart(2, '0')}-${new Date(year, range.end, 0).getDate()}`;
            dateRanges.push({ startDate, endDate });
        }

        // Fetch all data for the selected quarters
        const allData: any[] = [];

        for (const range of dateRanges) {
            const snapshot = await adminDb.collection('energy_prices')
                .where('date', '>=', range.startDate)
                .where('date', '<=', range.endDate)
                .orderBy('date', 'asc')
                .get();

            snapshot.forEach(doc => {
                allData.push(doc.data());
            });
        }

        if (allData.length === 0) {
            return NextResponse.json({
                history: [],
                hourlyProfile: [],
                weeklyProfile: [],
                overallAverage: 0
            });
        }

        // Calculate statistics from raw data
        const dailyData = new Map<string, { sum: number; count: number }>();
        const hourlyData = new Map<number, { sum: number; count: number }>();
        const weeklyData = new Map<number, Map<number, { sum: number; count: number }>>();

        // Initialize weekly structure
        for (let d = 0; d < 7; d++) {
            weeklyData.set(d, new Map<number, { sum: number; count: number }>());
            for (let h = 1; h <= 24; h++) {
                weeklyData.get(d)!.set(h, { sum: 0, count: 0 });
            }
        }

        let totalSum = 0;
        let totalCount = 0;

        // Process all data
        allData.forEach(data => {
            const date = data.date;
            const price = data.price;
            const hour = data.hour;
            const dayOfWeek = new Date(date).getDay(); // 0 = Sunday, 1 = Monday, ...

            totalSum += price;
            totalCount += 1;

            // Daily aggregation
            if (!dailyData.has(date)) {
                dailyData.set(date, { sum: 0, count: 0 });
            }
            const currentDaily = dailyData.get(date)!;
            currentDaily.sum += price;
            currentDaily.count += 1;

            // Hourly aggregation
            if (!hourlyData.has(hour)) {
                hourlyData.set(hour, { sum: 0, count: 0 });
            }
            const currentHourly = hourlyData.get(hour)!;
            currentHourly.sum += price;
            currentHourly.count += 1;

            // Weekly aggregation
            const currentWeekly = weeklyData.get(dayOfWeek)!.get(hour)!;
            currentWeekly.sum += price;
            currentWeekly.count += 1;
        });

        const overallAverage = totalCount > 0 ? Math.round((totalSum / totalCount) * 100) / 100 : 0;

        // Convert to array and calculate average for history
        const history = Array.from(dailyData.entries())
            .map(([date, stats]) => ({
                date,
                avgPrice: Math.round((stats.sum / stats.count) * 100) / 100
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Convert to array and calculate average for hourly profile
        const hourlyProfile = Array.from(hourlyData.entries())
            .map(([hour, stats]) => ({
                hour,
                price: Math.round((stats.sum / stats.count) * 100) / 100
            }))
            .sort((a, b) => a.hour - b.hour);

        // Prepare weekly profile (Mon-Sun)
        const daysOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
        const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

        const weeklyProfile = daysOrder.map(dayOfWeek => {
            const hoursMap = weeklyData.get(dayOfWeek)!;
            const prices = Array.from({ length: 24 }, (_, i) => i + 1).map(hour => {
                const stats = hoursMap.get(hour)!;
                return stats.count > 0 ? Math.round((stats.sum / stats.count) * 100) / 100 : 0;
            });
            return {
                dayOfWeek,
                name: dayNames[dayOfWeek],
                prices
            };
        });

        return NextResponse.json({
            history,
            hourlyProfile,
            overallAverage,
            weeklyProfile
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (error: any) {
        console.error('Error fetching quarter data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch quarter data', details: error.message },
            { status: 500 }
        );
    }
}
