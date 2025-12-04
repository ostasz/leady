import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30');

        // Calculate start date
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];

        // Fetch records by date range instead of limit to handle duplicates
        const snapshot = await adminDb.collection('energy_prices')
            .where('date', '>=', startDateStr)
            .orderBy('date', 'desc')
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ history: [] });
        }

        // Group by day of week (0-6) and hour (1-24) for weekly profile
        const weeklyData = new Map<number, Map<number, { sum: number; count: number }>>();

        // Initialize weekly structure
        for (let d = 0; d < 7; d++) {
            weeklyData.set(d, new Map<number, { sum: number; count: number }>());
            for (let h = 1; h <= 24; h++) {
                weeklyData.get(d)!.set(h, { sum: 0, count: 0 });
            }
        }

        // Group by date and calculate average
        const dailyData = new Map<string, { sum: number; count: number }>();
        // Group by hour (1-24) for profile
        const hourlyData = new Map<number, { sum: number; count: number }>();
        // Group by date for heat map
        const heatMapData = new Map<string, { hour: number; price: number }[]>();

        let totalSum = 0;
        let totalCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
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

            // Heat Map aggregation
            if (!heatMapData.has(date)) {
                heatMapData.set(date, []);
            }
            heatMapData.get(date)!.push({ hour, price });
        });

        const overallAverage = totalCount > 0 ? Math.round((totalSum / totalCount) * 100) / 100 : 0;

        // Convert to array and calculate average for history
        const history = Array.from(dailyData.entries())
            .map(([date, stats]) => ({
                date,
                avgPrice: Math.round((stats.sum / stats.count) * 100) / 100
            }))
            .sort((a, b) => a.date.localeCompare(b.date)) // Sort ascending by date
            .slice(-days); // Take requested number of days

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

        // Prepare full hourly history for heat map
        const fullHourlyHistory = Array.from(heatMapData.entries())
            .map(([date, prices]) => ({
                date,
                prices: prices.sort((a, b) => a.hour - b.hour).map(p => p.price)
            }))
            .sort((a, b) => a.date.localeCompare(b.date)) // Sort ascending by date (oldest first)
            .slice(-days); // Take requested number of days

        return NextResponse.json({ history, hourlyProfile, overallAverage, weeklyProfile }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0'
            }
        });

    } catch (error: any) {
        console.error('Error fetching price history:', error);
        return NextResponse.json(
            { error: 'Failed to fetch price history', details: error.message },
            { status: 500 }
        );
    }
}
