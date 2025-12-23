'use client';

import { useState, useEffect } from 'react';
import RdnKPI from '@/components/rdn/RdnKPI';
import RdnChart from '@/components/rdn/RdnChart';
import RdnTable from '@/components/rdn/RdnTable';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

interface PriceData {
    date: string;
    price: number;
}

export default function RdnPage() {
    const [data, setData] = useState<PriceData[]>([]);
    const [timeRange, setTimeRange] = useState<number>(30); // Default to 30 days
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch last 365 days for full context
                const res = await fetch('/api/energy-prices/history?days=365');
                if (res.ok) {
                    const json = await res.json();
                    if (json.history && Array.isArray(json.history)) {
                        // Map avgPrice to price
                        const mapped = json.history.map((d: any) => ({
                            date: d.date,
                            price: d.avgPrice || d.price
                        })).sort((a: any, b: any) => a.date.localeCompare(b.date));

                        setData(mapped);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch RDN data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter data based on selected time range
    const filteredData = data.slice(-timeRange);

    return (
        <div className="min-h-screen bg-[#F3F4F6] text-gray-900">
            {/* Navbar / Header */}
            <div className="bg-white sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
                    <Link href="/" className="p-2 -ml-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-900 transition-colors">
                        <img src="/home-icon.jpg" alt="Home" className="w-[37px] h-[37px] object-contain" />
                    </Link>
                    <div className="flex items-center gap-3">
                        <img src="/rdn-trend-icon.png" alt="RDN" className="w-8 h-8 object-contain" />
                        <h1 className="text-xl font-bold text-gray-900">
                            Centrum Analiz RDN (TGe24)
                        </h1>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {loading ? (
                    <div className="h-96 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-gray-700 border-t-emerald-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* KPI */}
                        <div className="grid grid-cols-1">
                            <RdnKPI data={filteredData} label={`TGe24 (${timeRange === 365 ? '1 ROK' : `${timeRange} DNI`})`} />
                        </div>

                        {/* Main Chart */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center flex-wrap gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Analiza Trendu</h2>
                                    <div className="text-sm text-gray-500">
                                        Notowania historyczne TGe24
                                        {filteredData.length > 0 && (
                                            <span className="ml-1 text-gray-400">
                                                (od {format(parseISO(filteredData[0].date), 'dd.MM.yyyy')} do {format(parseISO(filteredData[filteredData.length - 1].date), 'dd.MM.yyyy')})
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                                    {[30, 90, 365].map((days) => (
                                        <button
                                            key={days}
                                            onClick={() => setTimeRange(days)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${timeRange === days
                                                ? 'bg-[#C1F232] text-gray-900 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-900 hover:bg-white/60'
                                                }`}
                                        >
                                            {days === 365 ? '1 Rok' : `${days} Dni`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <RdnChart data={filteredData} />
                        </div>

                        {/* Data Table */}
                        {/* User removed table from Futures, assuming they might want it here or not? 
                             The request "zrób coś podobnego" implies copying current state of Futures.
                             Current state of Futures has NO table. 
                             However, usually historical data is useful. I will include it but be ready to remove.
                             Wait, removing it is safer to match "current Futures state".
                             BUT the futures table removal was specific.
                             Let's check user request: "historia notowan nie jest potrzbna, usun całą sekcję" for Futures.
                             So for RDN I should arguably also OMIT the table to be "similar".
                             I will OMIT the table to be safe and consistent with the latest Futures layout.
                         */}
                    </>
                )}
            </main>
        </div>
    );
}
