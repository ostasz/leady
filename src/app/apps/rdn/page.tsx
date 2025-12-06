'use client';

import { useState, useEffect } from 'react';
import RdnKPI from '@/components/rdn/RdnKPI';
import RdnChart from '@/components/rdn/RdnChart';
import RdnTable from '@/components/rdn/RdnTable';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PriceData {
    date: string;
    price: number;
}

export default function RdnPage() {
    const [data, setData] = useState<PriceData[]>([]);
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

    return (
        <div className="min-h-screen bg-[#0f111a] text-gray-200">
            {/* Navbar / Header */}
            <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
                    <Link href="/" className="p-2 -ml-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        📊 Centrum Analiz RDN (TGe24)
                    </h1>
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
                            <RdnKPI data={data} label="TGe24 (365 DNI)" />
                        </div>

                        {/* Main Chart */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-lg font-semibold text-gray-100">Analiza Trendu</h2>
                                <div className="text-sm text-gray-500">
                                    Notowania historyczne TGe24
                                </div>
                            </div>
                            <RdnChart data={data} />
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
