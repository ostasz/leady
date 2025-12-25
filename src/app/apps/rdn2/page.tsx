'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { pl } from 'date-fns/locale';
import Rdn2KpiCards from '@/components/rdn2/Rdn2KpiCards';
import Rdn2HourlyChart from '@/components/rdn2/Rdn2HourlyChart';
import Rdn2Heatmap from '@/components/rdn2/Rdn2Heatmap';
import Rdn2Table from '@/components/rdn2/Rdn2Table';
import Rdn2TrendChart from '@/components/rdn2/Rdn2TrendChart';
import Link from 'next/link';
import { Home } from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';

export default function Rdn2Page() {
    const { user } = useAuth();
    const [history, setHistory] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Initial Fetch
    useEffect(() => {
        const fetchData = async () => {
            if (!user) return; // Don't fetch if not logged in (will be handled by protected route, but good safety)

            try {
                const token = await user.getIdToken();
                // Fetch larger history to allow calendar selection
                const res = await fetch('/api/energy-prices/history?days=365', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to fetch data');

                const json = await res.json();
                const fetchedHistory = json.fullHourlyHistory || [];

                if (fetchedHistory.length > 0) {
                    setHistory(fetchedHistory);
                    // Default to latest date
                    const latest = fetchedHistory[fetchedHistory.length - 1];
                    setSelectedDate(latest.date);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchData();
        }
    }, [user]);

    // Derive Dashboard Data based on selectedDate
    const data = useMemo(() => {
        if (!selectedDate || history.length === 0) return null;

        // 1. Identify Target Entry
        const targetEntry = history.find((h: any) => h.date === selectedDate);

        if (!targetEntry) return null; // Date not found in loaded history

        const targetDate = parseISO(selectedDate);

        // 2. Identify Benchmarks
        const prevDateStr = format(subDays(targetDate, 1), 'yyyy-MM-dd');
        const prevEntry = history.find((h: any) => h.date === prevDateStr);

        // Last Week Avg (Last 7 days relative to selectedDate)
        const last7DaysEntries = history.filter((h: any) => h.date < selectedDate).slice(-7);

        // 3. Construct Hourly Data
        const hourlyData = targetEntry.prices.map((price: number, hour: number) => {
            const priceYesterday = prevEntry?.prices[hour] ?? 0;

            // Avg 7 days logic
            let sum7 = 0;
            let count7 = 0;
            last7DaysEntries.forEach((d: any) => {
                if (d.prices[hour] !== undefined) {
                    sum7 += d.prices[hour];
                    count7++;
                }
            });
            const priceAvgWeek = count7 > 0 ? sum7 / count7 : 0;

            const volume = targetEntry.volumes ? targetEntry.volumes[hour] : 0;

            return {
                hour: (hour + 1).toString().padStart(2, '0'),
                price,
                priceYesterday,
                priceAvgWeek,
                volume,
                change: priceYesterday !== 0 ? ((price - priceYesterday) / priceYesterday) * 100 : 0
            };
        });

        // 4. Construct KPI Stats
        const prices = targetEntry.prices;
        const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;

        const prevPrices = prevEntry?.prices || [];
        const prevAvg = prevPrices.length > 0 ? prevPrices.reduce((a: number, b: number) => a + b, 0) / prevPrices.length : 0;

        // Peak (07-22) indices 7..21
        const peakIndices = Array.from({ length: 15 }, (_, i) => i + 7);
        const peakPrices = peakIndices.map(i => prices[i]).filter(p => p !== undefined);
        const avgPeak = peakPrices.reduce((a: number, b: number) => a + b, 0) / peakPrices.length;

        const prevPeakPrices = peakIndices.map(i => prevPrices[i]).filter(p => p !== undefined);
        const prevAvgPeak = prevPeakPrices.length > 0 ? prevPeakPrices.reduce((a: number, b: number) => a + b, 0) / prevPeakPrices.length : 0;

        // Sparkline history: 30 days ending at selectedDate
        const relevantHistoryForSparktips = history.filter(h => h.date <= selectedDate).slice(-30);

        const currentTotalVolume = targetEntry.volumes ? targetEntry.volumes.reduce((a: number, b: number) => a + b, 0) : 0;
        const prevTotalVolume = prevEntry?.volumes ? prevEntry.volumes.reduce((a: number, b: number) => a + b, 0) : 0;

        const stats = {
            tgeBase: avgPrice,
            tgeBaseChange: prevAvg !== 0 ? ((avgPrice - prevAvg) / prevAvg) * 100 : 0,
            tgePeak: avgPeak,
            tgePeakChange: prevAvgPeak !== 0 ? ((avgPeak - prevAvgPeak) / prevAvgPeak) * 100 : 0,
            minPrice: Math.min(...prices),
            maxPrice: Math.max(...prices),
            volume: currentTotalVolume,
            volumeChange: prevTotalVolume !== 0 ? ((currentTotalVolume - prevTotalVolume) / prevTotalVolume) * 100 : 0,
            history: relevantHistoryForSparktips.map((h: any) => ({
                date: h.date,
                val: h.prices.reduce((a: number, b: number) => a + b, 0) / h.prices.length
            })),
            peakHistory: relevantHistoryForSparktips.map((h: any) => {
                const hPeakPrices = peakIndices.map(i => h.prices[i]).filter(p => p !== undefined);
                const hAvgPeak = hPeakPrices.length > 0 ? hPeakPrices.reduce((a: number, b: number) => a + b, 0) / hPeakPrices.length : 0;
                return { date: h.date, val: hAvgPeak };
            }),
            spreadHistory: relevantHistoryForSparktips.map((h: any) => ({
                date: h.date,
                val: Math.max(...h.prices) - Math.min(...h.prices)
            }))
        };

        // 5. Heatmap Data (14 days ending at selectedDate, reversed)
        const heatmapHistory = [...relevantHistoryForSparktips].slice(-14).reverse();
        const heatmapDays = heatmapHistory.map((h: any) => format(parseISO(h.date), 'dd'));
        const heatmapHours = Array.from({ length: 24 }, (_, i) => i + 1);
        const heatmapValues = heatmapHours.map(h => {
            return heatmapHistory.map((d: any) => d.prices[h - 1]);
        });

        return {
            stats,
            hourlyData,
            heatmapData: { days: heatmapDays, hours: heatmapHours, values: heatmapValues },
            tableData: hourlyData,
            dateStr: format(targetDate, 'd MMMM yyyy (EEEE)', { locale: pl })
        };
    }, [history, selectedDate]);


    if (loading) return <div className="min-h-screen bg-[#F3F4F6] text-gray-900 flex items-center justify-center">Loading...</div>;

    // Determine min/max dates for picker
    const minDate = history.length > 0 ? history[0].date : undefined;
    const maxDate = history.length > 0 ? history[history.length - 1].date : undefined;

    return (
        <div className="min-h-screen bg-[#F3F4F6] text-gray-900 p-6 font-sans">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-4 rounded-xl border border-gray-200 shadow-sm gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Link href="/" className="p-2 -ml-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#009D8F] transition-colors">
                        <Home size={28} />
                    </Link>
                    <div className="bg-[#009D8F]/10 p-2 rounded-lg text-[#009D8F]">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-wide">Analiza Rynku Dnia Następnego (RDN)</h1>
                        <p className="text-xs text-gray-500">Polish Power Exchange (TGE)</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 w-full md:w-auto justify-between md:justify-end">
                    <label htmlFor="date-picker" className="text-gray-500 text-sm whitespace-nowrap">Data dostawy:</label>
                    <input
                        id="date-picker"
                        type="date"
                        min={minDate}
                        max={maxDate}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent text-[#009D8F] font-bold font-mono focus:outline-none cursor-pointer text-right [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                </div>
            </header>

            {!data ? (
                <div className="flex items-center justify-center h-64 text-gray-500 border border-dashed border-gray-300 rounded-xl">
                    Wybierz inną datę (brak danych dla {selectedDate})
                </div>
            ) : (
                <main className="space-y-6">
                    {/* 1. KPI Cards */}
                    <section>
                        <Rdn2KpiCards stats={data.stats} onDateSelect={setSelectedDate} />
                    </section>

                    {/* 2. Main Chart */}
                    <section>
                        <Rdn2HourlyChart data={data.hourlyData} />
                    </section>

                    {/* 3. Trend Chart */}
                    <section>
                        <Rdn2TrendChart data={history} />
                    </section>

                    {/* 4. Bottom Section: Heatmap + Table */}
                    <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3">
                            <Rdn2Heatmap data={data.heatmapData} />
                        </div>
                        <div className="lg:col-span-2 h-full">
                            <Rdn2Table data={data.tableData} />
                        </div>
                    </section>
                </main>
            )}
        </div>
    );
}
