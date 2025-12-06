'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function RDNTicker() {
    const { getAuthHeaders, user } = useAuth();
    const [data, setData] = useState<{ date: string; avgPrice: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                const headers = await getAuthHeaders();
                // Fetch 7 days to calculate change for the latest day
                const res = await fetch('/api/energy-prices/history?days=7', { headers });
                const json = await res.json();

                if (json.history) {
                    // Sort by date ascending for the graph
                    const sorted = json.history.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    setData(sorted);
                }
            } catch (err) {
                console.error('Failed to fetch RDN history', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, getAuthHeaders]);

    if (loading) return <div className="h-32 animate-pulse rounded-xl bg-gray-100"></div>;
    if (data.length < 2) return null;

    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    const change = current.avgPrice - previous.avgPrice;
    const percentChange = (change / previous.avgPrice) * 100;
    const isPositive = change >= 0;

    // Mini Sparkline Logic
    const prices = data.slice(-6).map(d => d.avgPrice); // Last 6 days for graph
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const height = 40;
    const width = 120;

    const points = prices.map((price, i) => {
        const x = (i / (prices.length - 1)) * width;
        const y = height - ((price - min) / range) * height; // Invert Y
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="p-6 rounded-xl shadow-sm border border-gray-100 bg-white text-gray-900 flex items-center justify-between relative overflow-hidden transition-all hover:shadow-md">

            {/* Left: Title & Value */}
            <div className="flex items-center gap-4 z-10">
                <div className="p-3 rounded-full shadow-sm bg-green-50">
                    <Activity className="text-green-600" size={24} />
                </div>
                <div>
                    <h3 className="text-xs font-bold tracking-wider text-gray-500">TGe24</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900">
                            {current.avgPrice.toFixed(2)} <span className="text-sm font-normal text-gray-500">PLN/MWh</span>
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                            {new Date(current.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Middle: Sparkline */}
            <div className="hidden sm:block absolute right-28 top-1/2 -translate-y-1/2 opacity-20">
                <svg width={width} height={height} className="overflow-visible">
                    <polyline
                        points={points}
                        fill="none"
                        stroke={isPositive ? "#22c55e" : "#ef4444"}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>

            {/* Right: Change */}
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold z-10 ${isPositive
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
                }`}>
                {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {Math.abs(percentChange).toFixed(2)}%
            </div>
        </div>
    );
}
