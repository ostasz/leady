'use client';

import { useState, useEffect } from 'react';
import FuturesKPI from '@/components/futures/FuturesKPI';
import FuturesChart from '@/components/futures/FuturesChart';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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

    return (
        <div className="min-h-screen bg-[#0f111a] text-gray-200">
            {/* Navbar / Header */}
            <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
                    <Link href="/" className="p-2 -ml-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        ⚡ Centrum Analiz Futures
                    </h1>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {loading ? (
                    <div className="h-96 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-gray-700 border-t-cyan-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FuturesKPI year={year1} data={dataY1} label={`BASELINE ${year1}`} />
                            <FuturesKPI year={year2} data={dataY2} label={`BASELINE ${year2}`} />
                        </div>

                        {/* Main Chart */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-gray-100">Analiza Cenowa</h2>
                                <div className="text-sm text-gray-500">
                                    Porównanie kontraktów rocznych
                                </div>
                            </div>
                            <FuturesChart
                                dataY1={dataY1}
                                dataY2={dataY2}
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
