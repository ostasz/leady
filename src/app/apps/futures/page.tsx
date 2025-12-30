'use client';

import { useState, useEffect, useMemo } from 'react';
import FuturesKPI from '@/components/futures/FuturesKPI';
import FuturesChart from '@/components/futures/FuturesChart';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO, isValid } from 'date-fns';
import { useAuth } from '@/components/AuthProvider';
import { FuturesHistoryPoint } from '@/types/energy-prices';

interface FuturesResponse {
    futures: {
        [year: string]: FuturesHistoryPoint[];
    };
}

export default function FuturesPage() {
    const { user } = useAuth();

    // We store full fetched history in state, and filter by timeRange for display
    const [dataY1, setDataY1] = useState<FuturesHistoryPoint[]>([]);
    const [dataY2, setDataY2] = useState<FuturesHistoryPoint[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<number>(30); // Default to 30 days
    const [refreshKey, setRefreshKey] = useState(0);

    const currentYear = new Date().getFullYear();
    const year1 = (currentYear + 1).toString();
    const year2 = (currentYear + 2).toString();

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            setLoading(true);
            setError(null);

            try {
                const token = await user.getIdToken();
                // Request enough data for 365 days view max
                const res = await fetch('/api/energy-prices/futures?days=400', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!res.ok) {
                    throw new Error(`Błąd pobierania danych: ${res.statusText}`);
                }

                const json: FuturesResponse = await res.json();
                setDataY1(json.futures[year1] || []);
                setDataY2(json.futures[year2] || []);
            } catch (error: unknown) {
                console.error('Failed to fetch futures data', error);
                setError(error instanceof Error ? error.message : 'Wystąpił nieoczekiwany błąd podczas pobierania danych.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, year1, year2, refreshKey]);

    // Use useMemo for filtering to improve render performance and stability
    const filteredDataY1 = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - timeRange);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        return dataY1.filter(d => d.date >= cutoffStr);
    }, [dataY1, timeRange]);

    const filteredDataY2 = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - timeRange);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        return dataY2.filter(d => d.date >= cutoffStr);
    }, [dataY2, timeRange]);

    // Safe date formatting helper
    const getDateRangeLabel = (data: FuturesHistoryPoint[]) => {
        if (!data || data.length === 0) return '';
        try {
            const first = data[0].date;
            const last = data[data.length - 1].date;
            if (!isValid(parseISO(first)) || !isValid(parseISO(last))) return '';
            return `(od ${format(parseISO(first), 'dd.MM.yyyy')} do ${format(parseISO(last), 'dd.MM.yyyy')})`;
        } catch {
            return '';
        }
    };

    return (
        <div className="min-h-screen bg-white text-gray-900">
            {/* Navbar / Header */}
            <div className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 -ml-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900 transition-colors">
                            <img src="/home-icon.jpg" alt="Home" className="w-[37px] h-[37px] object-contain" />
                        </Link>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⚡</span>
                            <h1 className="text-xl font-bold text-gray-900">
                                Centrum Analiz Futures
                            </h1>
                        </div>
                    </div>

                    {/* View Toggle */}
                    <div className="bg-gray-100 p-1 rounded-lg flex items-center">
                        <span className="px-3 py-1.5 rounded-md text-sm font-medium bg-white text-gray-900 shadow-sm cursor-default">
                            Dane podstawowe
                        </span>
                        <Link href="/apps/futures2" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                            Dane zaawansowane
                        </Link>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {/* Error Banner */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-sm">Błąd pobierania danych</h3>
                            <p className="text-sm opacity-90">{error}</p>
                        </div>
                        <button
                            onClick={() => setRefreshKey(k => k + 1)}
                            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded text-sm font-medium transition-colors"
                        >
                            Spróbuj ponownie
                        </button>
                    </div>
                )}

                {loading && !error ? (
                    <div className="h-96 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#2DD4BF] rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FuturesKPI data={filteredDataY1} label={`BASELINE ${year1}`} />
                            <FuturesKPI data={filteredDataY2} label={`BASELINE ${year2}`} />
                        </div>

                        {/* Main Chart */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center flex-wrap gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-700">Analiza Cenowa</h2>
                                    <div className="text-sm text-gray-500">
                                        Porównanie kontraktów rocznych
                                        {filteredDataY1.length > 0 && (
                                            <span className="ml-1 text-gray-400">
                                                {getDateRangeLabel(filteredDataY1)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                    {[30, 90, 365].map((days) => (
                                        <button
                                            key={days}
                                            onClick={() => setTimeRange(days)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${timeRange === days
                                                ? 'bg-[#C1F232] text-gray-900 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
                                                }`}
                                        >
                                            {days} Dni
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <FuturesChart
                                dataY1={filteredDataY1}
                                dataY2={filteredDataY2}
                                year1={year1}
                                year2={year2}
                            />
                        </div>


                    </>
                )}
            </main>
        </div>
    );
}
