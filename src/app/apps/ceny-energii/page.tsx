/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { EnergyPriceEntry, DailyPriceSummary, groupPricesByDate, calculateDailySummary } from '@/types/energy-prices';
import EnergyPriceChart from '@/components/EnergyPriceChart';
import PriceStatistics from '@/components/PriceStatistics';
import { ArrowLeft, Calendar, Lightbulb, Upload } from 'lucide-react';
import Link from 'next/link';
import PriceHistoryChart from '@/components/PriceHistoryChart';
import AverageHourlyProfileChart from '@/components/AverageHourlyProfileChart';
import PriceHeatMap from '@/components/PriceHeatMap';
import WorkProfileCalculator from '@/components/WorkProfileCalculator';
import YearCalendar from '@/components/YearCalendar';

export default function EnergyPricesDashboard() {
    const { user, userData, loading: authLoading, getAuthHeaders } = useAuth();
    const router = useRouter();
    const [prices, setPrices] = useState<EnergyPriceEntry[]>([]);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [dailySummary, setDailySummary] = useState<DailyPriceSummary | null>(null);
    const [historyData, setHistoryData] = useState<{ date: string; avgPrice: number }[]>([]);
    const [hourlyProfile, setHourlyProfile] = useState<{ hour: number; price: number }[]>([]);
    const [weeklyProfile, setWeeklyProfile] = useState<{ dayOfWeek: number; name: string; prices: number[] }[]>([]);
    const [overallAverage, setOverallAverage] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [historyRange, setHistoryRange] = useState<number>(365);

    // Work Profile State (lifted for sharing)
    const [selectedShiftId, setSelectedShiftId] = useState<string>('1s-8-16');
    const [weekendMode, setWeekendMode] = useState<'none' | 'saturday' | 'full_weekend'>('none');

    // Auth guard - admin only for now
    // Auth guard - allow all authenticated users
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Fetch available dates AND history on mount or range change
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                const headers = await getAuthHeaders();

                // 1. Fetch history with range
                const historyRes = await fetch(`/api/energy-prices/history?days=${historyRange}`, { headers, cache: 'no-store' });
                const historyJson = await historyRes.json();
                if (historyJson.history) {
                    setHistoryData(historyJson.history);

                    // Use history dates for calendar availability
                    // History data is already sorted by date (descending or ascending depending on API, but we can sort here)
                    const dates = historyJson.history.map((item: any) => item.date);
                    // Ensure uniqueness and sort descending
                    const uniqueDates = Array.from(new Set(dates)).sort().reverse();
                    setAvailableDates(uniqueDates as string[]);

                    // Select most recent date by default if not selected
                    if (uniqueDates.length > 0 && !selectedDate) {
                        setSelectedDate(uniqueDates[0] as string);
                    }
                }
                if (historyJson.hourlyProfile) {
                    setHourlyProfile(historyJson.hourlyProfile);
                }
                if (historyJson.weeklyProfile) {
                    setWeeklyProfile(historyJson.weeklyProfile);
                }
                if (historyJson.overallAverage !== undefined) {
                    setOverallAverage(historyJson.overallAverage);
                }

                // Removed legacy fetch for availableDates as it was limited to 1000 records (~40 days)
            } catch (err) {
                console.error('Error fetching data:', err);
            }
        };

        fetchData();
    }, [user, getAuthHeaders, historyRange]); // Add historyRange dependency

    // Fetch prices for selected date
    useEffect(() => {
        if (!user || !selectedDate) return;

        const fetchPrices = async () => {
            try {
                setLoading(true);
                const headers = await getAuthHeaders();
                // Fetch full data for selected date
                const response = await fetch(`/api/energy-prices?date=${encodeURIComponent(selectedDate)}`, {
                    headers,
                    cache: 'no-store'
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch prices');
                }

                const data = await response.json();
                setPrices(data.prices || []);

                // Calculate summary immediately
                const summary = calculateDailySummary(data.prices || []);
                setDailySummary(summary);

                setError('');
            } catch (err: any) {
                setError(err.message || 'Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        fetchPrices();
    }, [selectedDate, user, getAuthHeaders]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) return null;

    // Helper to format date for display
    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('pl-PL', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-xl font-semibold text-gray-900">
                            Ceny Energii - Rynek Dnia Następnego
                        </h1>
                    </div>


                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                        {error}
                    </div>
                )}

                {/* History Chart Section */}
                {historyData.length > 0 && (
                    <div className="flex flex-col gap-8 mb-8">
                        {/* Trend Chart */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Trend średnich cen (ostatnie {historyRange} dni)
                                </h2>
                                <div className="flex gap-2 items-center">

                                    <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                                        {[30, 90, 365].map((days) => (
                                            <button
                                                key={days}
                                                onClick={() => setHistoryRange(days)}
                                                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${historyRange === days
                                                    ? 'bg-white text-primary shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-900'
                                                    }`}
                                            >
                                                {days} dni
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <PriceHistoryChart
                                data={historyData}
                                onDateSelect={setSelectedDate}
                                selectedDate={selectedDate}
                                overallAverage={overallAverage}
                            />
                            <p className="text-sm text-gray-500 mt-4 text-center">
                                Kliknij na punkt na wykresie, aby zobaczyć szczegóły dla danego dnia.
                            </p>
                        </div>

                        {/* Daily Details Section */}
                        {dailySummary && (
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        Szczegóły dnia: {formatDate(selectedDate)}
                                    </h2>
                                </div>

                                <PriceStatistics summary={dailySummary} />

                                <div className="mt-8">
                                    <h3 className="text-md font-medium text-gray-700 mb-4">Profil godzinowy</h3>
                                    <EnergyPriceChart data={dailySummary} />
                                </div>
                            </div>
                        )}

                        {/* Hourly Profile Chart */}
                        {hourlyProfile.length > 0 && (
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                                    Typowy profil dnia (średnia z {historyRange} dni)
                                </h2>
                                <AverageHourlyProfileChart
                                    data={hourlyProfile}
                                    overallAverage={overallAverage}
                                />

                            </div>
                        )}
                    </div>
                )}


                {/* Weekly Profile Chart */}
                {weeklyProfile.length > 0 && (
                    <>
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
                            <h2 className="text-lg font-semibold text-gray-900 mb-6">
                                Typowy tydzień (średnia z {historyRange} dni)
                            </h2>
                            <PriceHeatMap
                                data={weeklyProfile}
                                overallAverage={overallAverage}
                                selectedShiftId={selectedShiftId}
                                weekendMode={weekendMode}
                            />
                        </div>

                        {/* Work Profile Calculator */}
                        <WorkProfileCalculator
                            weeklyProfile={weeklyProfile}
                            overallAverage={overallAverage}
                            selectedShiftId={selectedShiftId}
                            onShiftChange={setSelectedShiftId}
                            weekendMode={weekendMode}
                            onWeekendModeChange={setWeekendMode}
                        />
                    </>
                )}



                {availableDates.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <p className="text-gray-600 mb-4">Brak danych cenowych. Przejdź do panelu admina aby wgrać dane.</p>
                        <Link
                            href="/admin/ceny-energii"
                            className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                        >
                            Panel Admina
                        </Link>
                    </div>
                )}

                {availableDates.length > 0 && (
                    <>
                    </>
                )}
            </main>
        </div>
    );
}
