'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { useEffect, useState } from 'react';
import { AreaChart, Area, YAxis, Tooltip } from 'recharts'; // Use Recharts like FuturesTicker
import { Activity, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react';
import { EnergyPriceEntry } from '@/types/energy-prices';

export default function RDNTicker() {
    const { user, getAuthHeaders } = useAuth();
    const [data, setData] = useState<EnergyPriceEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch last 30 days to match Futures ticker
                const res = await fetch('/api/energy-prices/history?days=30');
                if (res.ok) {
                    const json = await res.json();
                    if (json.history && Array.isArray(json.history)) {
                        // Sort by date ascending for graph
                        const sorted = json.history.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                        setData(sorted);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch RDN ticker data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user, getAuthHeaders]);

    if (loading) return (
        <div className="bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-800 h-48 animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-600 border-t-green-500 rounded-full animate-spin"></div>
        </div>
    );
    if (data.length < 2) return null;

    const current = data[data.length - 1];
    const previous = data[data.length - 2];
    const latestPrice = (current as any).avgPrice || current.price;
    const previousPrice = (previous as any).avgPrice || previous.price;
    const priceChange = latestPrice - previousPrice;
    const percentChange = previousPrice ? (priceChange / previousPrice) * 100 : 0;

    // Determine color based on change
    let chartColor = '#06b6d4'; // Default Blue/Cyan
    if (priceChange > 0) chartColor = '#22c55e'; // Green
    if (priceChange < 0) chartColor = '#ef4444'; // Red

    // Prepare graph data
    // Take last 30 data points (or whatever is available if less)
    const graphData = data.slice(-30).map(d => ({
        date: d.date,
        price: (d as any).avgPrice || d.price
    }));

    return (
        <div className="group bg-white rounded-xl p-4 md:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden text-gray-900 h-full flex flex-col justify-between transition-all hover:shadow-md">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 md:mb-6 relative z-10 w-full">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-[#2DD4BF] group-hover:bg-[#C5FAEA] transition-all duration-300">
                        <Activity size={24} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">TGe24 (RDN)</h3>
                        <p className="text-xs text-gray-500">Rynek Dnia Następnego (PLN/MWh)</p>
                    </div>
                </div>
                <Link href="/apps/rdn2" className="text-gray-400 hover:text-[#2DD4BF] transition-colors" title="Otwórz pełny dashboard">
                    <ExternalLink size={18} />
                </Link>
            </div>

            <div className="relative z-10 flex justify-between items-end">
                <div>
                    <div className="text-sm font-medium text-gray-500 mb-1">Index TGe24</div>
                    <div className="text-2xl font-bold tracking-tight text-gray-900">
                        {latestPrice.toFixed(2)} <span className="text-sm font-normal text-gray-400">PLN</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        {/* Indicator: Lime text on Light Lime pill */}
                        <div className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-md ${priceChange >= 0
                            ? 'bg-[#ecfccb] text-[#65a30d]' // Lime 100 BG, Lime 600 Text
                            : 'bg-[#fff7ed] text-[#ea580c]' // Orange 50 BG, Orange 600 Text
                            }`}>
                            {priceChange >= 0 ? <TrendingUp size={12} className="mr-1" strokeWidth={2.5} /> :
                                <TrendingDown size={12} className="mr-1" strokeWidth={2.5} />}
                            {Math.abs(priceChange).toFixed(2)} ({Math.abs(percentChange).toFixed(1)}%)
                        </div>
                        <div className="text-xs text-gray-400">
                            {new Date(current.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                        </div>
                    </div>
                </div>

                {/* Sparkline - Mint Color */}
                <Link href="/apps/rdn2" className="h-16 w-32 cursor-pointer hover:opacity-80 transition-opacity">
                    <AreaChart width={128} height={64} data={graphData}>
                        <defs>
                            <linearGradient id="gradient-rdn" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#2DD4BF" // Mint/Turquoise
                            strokeWidth={2}
                            fill="url(#gradient-rdn)"
                            isAnimationActive={false}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white px-2 py-1 rounded text-xs text-gray-700 font-medium border border-gray-100 shadow-md">
                                            {Number(payload[0].value).toFixed(1)}
                                        </div>
                                    );
                                }
                                return null;
                            }}
                            cursor={{ stroke: '#2DD4BF', strokeWidth: 1, opacity: 0.5 }}
                        />
                        <YAxis domain={['dataMin', 'dataMax']} hide />
                    </AreaChart>
                </Link>
            </div>

            {/* Decor - Subtle Mint Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 bg-[#2DD4BF]/5 pointer-events-none"></div>
        </div>
    );
}
