'use client';

import { useState, useEffect } from 'react';
import FuturesKPI from '@/components/futures/FuturesKPI';
import FuturesChart from '@/components/futures/FuturesChart';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

interface FutureData {
    date: string;
    price: number;
}

interface FuturesResponse {
    futures: {
        [year: string]: FutureData[];
    };
}

export default function FuturesPage() {
    const [dataY1, setDataY1] = useState<FutureData[]>([]);
    const [dataY2, setDataY2] = useState<FutureData[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<number>(30); // Default to 30 days

    const currentYear = new Date().getFullYear();
    const year1 = (currentYear + 1).toString();
    const year2 = (currentYear + 2).toString();

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Limit=0 fetches ALL history
                const res = await fetch('/api/energy-prices/futures?limit=0');
                if (res.ok) {
                    const json: FuturesResponse = await res.json();
                    setDataY1(json.futures[year1] || []);
                    setDataY2(json.futures[year2] || []);
                }
            } catch (error) {
                console.error('Failed to fetch futures data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [year1, year2]);

    // Filter data based on selected time range
    const filteredDataY1 = dataY1.slice(-timeRange);
    const filteredDataY2 = dataY2.slice(-timeRange);

    return (
        <div className="min-h-screen bg-white text-gray-900">
            {/* Navbar / Header */}
            <div className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
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
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {loading ? (
                    <div className="h-96 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#2DD4BF] rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FuturesKPI year={year1} data={filteredDataY1} label={`BASELINE ${year1}`} />
                            <FuturesKPI year={year2} data={filteredDataY2} label={`BASELINE ${year2}`} />
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
                                                (za okres od {format(parseISO(filteredDataY1[0].date), 'dd.MM.yyyy')} do {format(parseISO(filteredDataY1[filteredDataY1.length - 1].date), 'dd.MM.yyyy')})
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
