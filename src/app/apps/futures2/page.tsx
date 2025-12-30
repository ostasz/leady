'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import FuturesHeader from '@/components/futures2/FuturesHeader';
import FuturesAdvKPI from '@/components/futures2/FuturesAdvKPI';
import FuturesTechnicalKPI from '@/components/futures2/FuturesTechnicalKPI';
import FuturesCandleChart from '@/components/futures2/FuturesCandleChart';
import ForwardCurveChart from '@/components/futures2/ForwardCurveChart';
import FuturesTicker from '@/components/futures2/FuturesTicker';
import {
    FuturesHistoryPoint,
    FuturesKpiDto,
    FuturesTechnicalDto,
    ForwardCurvePoint,
    FuturesTickerRow
} from '@/types/energy-prices';

export default function FuturesPage2() {
    const today = new Date().toISOString().split('T')[0];
    const nextYear = (new Date().getFullYear() + 1).toString().slice(-2);
    // UI State
    const [selectedContract, setSelectedContract] = useState(`BASE_Y-${nextYear}`);
    const [selectedDate, setSelectedDate] = useState(today);
    const [timeRange, setTimeRange] = useState('6M'); // 1M, 3M, 6M, YTD, 1Y
    const [refreshKey, setRefreshKey] = useState(0);

    // Data State (Typed)
    const [history, setHistory] = useState<FuturesHistoryPoint[]>([]);
    const [kpi, setKpi] = useState<FuturesKpiDto | null>(null);
    const [technical, setTechnical] = useState<FuturesTechnicalDto | null>(null);
    const [forwardCurve, setForwardCurve] = useState<ForwardCurvePoint[]>([]);
    const [ticker, setTicker] = useState<FuturesTickerRow[]>([]);

    // Status State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { user } = useAuth();

    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            setLoading(true);
            setError(null); // Clear previous errors
            try {
                let headers: any = {};
                if (user) {
                    const token = await user.getIdToken();
                    headers = { 'Authorization': `Bearer ${token}` };
                }

                const res = await fetch(`/api/energy-prices/futures/details?contract=${selectedContract}&date=${selectedDate}`, {
                    headers,
                    signal: controller.signal
                });

                if (res.ok) {
                    const json = await res.json();

                    // Prevent memory leak / race condition update
                    if (controller.signal.aborted) return;

                    setHistory(json.history || []);
                    setKpi(json.kpi || null);
                    setTechnical(json.technical || null);
                    setForwardCurve(json.forwardCurve || []);
                    setTicker(json.ticker || []);

                    // Double Fetch Fix: We do NOT update selectedDate here causing a loop.
                    // We just accept that displayed data might correspond to valid trading day (effectiveDate)
                    // if (json.effectiveDate && json.effectiveDate !== selectedDate) {
                    //      setSelectedDate(json.effectiveDate);
                    // }
                } else {
                    const errorJson = await res.json().catch(() => ({}));
                    const errorMessage = errorJson.error || `Błąd serwera: ${res.status}`;
                    console.error('API Error:', errorMessage);

                    if (!controller.signal.aborted) {
                        setError(errorMessage);
                        // Optional: Clear data on error or keep stale?
                        // Let's clear to avoid confusion if it's a critical error
                        setKpi(null);
                    }
                }
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error('Failed to fetch futures details', error);
                    setError('Wystąpił błąd podczas pobierania danych.');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        if (user !== undefined) { // Wait for auth init
            fetchData();
        }

        return () => {
            controller.abort();
        };
    }, [selectedContract, selectedDate, user, refreshKey]);

    // Optimize filtering with useMemo
    const filteredHistory = useMemo(() => {
        if (!history.length) return [];
        const now = new Date();
        let cutoff = new Date();

        switch (timeRange) {
            case '1M': cutoff.setMonth(now.getMonth() - 1); break;
            case '3M': cutoff.setMonth(now.getMonth() - 3); break;
            case '6M': cutoff.setMonth(now.getMonth() - 6); break;
            case 'YTD': cutoff = new Date(now.getFullYear(), 0, 1); break;
            case 'ALL': return history;
            default: cutoff.setMonth(now.getMonth() - 6);
        }

        const cutoffTime = cutoff.getTime();
        // Optimization: Parsing date strings in loop is expensive if array is huge.
        // If history.date is standard 'YYYY-MM-DD', new Date() is okay but string compare is faster for sorting.
        // For filtering '>= cutoff', we have to parse.
        return history.filter(d => new Date(d.date).getTime() >= cutoffTime);
    }, [history, timeRange]);

    return (
        <div className="min-h-screen bg-[#0B1120] text-gray-100 font-sans">
            {/* Navbar / Header */}
            <div className="bg-[#111827] sticky top-0 z-50 border-b border-gray-800 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 -ml-2 hover:bg-gray-800 rounded-lg transition-colors">
                            <span className="text-2xl">⚡</span>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">System Analiz</h1>
                        </div>
                    </div>

                    {/* Integrated Controls */}
                    <div className="hidden md:block">
                        <FuturesHeader
                            selectedContract={selectedContract}
                            onContractChange={setSelectedContract}
                            range={timeRange}
                            onRangeChange={setTimeRange}
                            selectedDate={selectedDate}
                            onDateChange={setSelectedDate}
                        />
                    </div>

                    {error && (
                        <div className="absolute top-16 left-0 w-full bg-red-500/10 border-b border-red-500/50 text-red-400 px-4 py-2 text-sm text-center">
                            ⚠️ {error}
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setRefreshKey(prev => prev + 1)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-all"
                            title="Odśwież dane"
                        >
                            <RefreshCw size={18} />
                        </button>
                        <div className="bg-gray-900 p-1 rounded-lg flex items-center border border-gray-800">
                            <Link href="/apps/futures" className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 hover:text-white transition-colors">
                                Podstawowy
                            </Link>
                            <span className="px-3 py-1.5 rounded-md text-xs font-bold bg-[#009D8F] text-white shadow-sm cursor-default">
                                PRO (Trader)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-[1600px] mx-auto px-4 py-8 space-y-6">

                {/* Control Panel - Moved to Header */}

                {loading ? (
                    <div className="h-96 flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-4 border-blue-900 border-t-blue-500 rounded-full animate-spin"></div>
                        <div className="text-blue-400 font-mono text-sm animate-pulse">Ładowanie danych giełdowych...</div>
                    </div>
                ) : (
                    <>
                        {/* KPI SECTION */}
                        {kpi && <FuturesAdvKPI data={kpi} contract={selectedContract} />}

                        {/* TECHNICAL INDICATORS */}
                        {technical && <FuturesTechnicalKPI data={technical} contract={selectedContract} />}

                        {/* MAIN CHART */}
                        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                            <FuturesCandleChart data={filteredHistory} contract={selectedContract} />
                        </div>

                        {/* BOTTOM SECTION: CURVE + TICKER */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div>
                                <ForwardCurveChart data={forwardCurve} />
                            </div>
                            <div>
                                <FuturesTicker data={ticker} />
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
