'use client';

import { useAuth } from './AuthProvider';
import { useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'; // Use Recharts like FuturesTicker
import { Activity, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
        <div className="bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-800 relative overflow-hidden text-white h-full flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 relative z-10 w-full">
                <div className="p-2 bg-gray-800 rounded-lg text-green-400">
                    <Activity size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-100">TGe24 (RDN)</h3>
                    <p className="text-xs text-gray-400">Rynek Dnia Następnego (PLN/MWh)</p>
                </div>
            </div>

            <div className="relative z-10 flex justify-between items-end">
                <div>
                    <div className="text-sm font-medium text-gray-400 mb-1">Index TGe24</div>
                    <div className="text-2xl font-bold tracking-tight text-white">
                        {latestPrice.toFixed(2)} <span className="text-sm font-normal text-gray-500">PLN</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={`flex items-center text-xs font-semibold px-1.5 py-0.5 rounded ${priceChange > 0 ? 'bg-green-900/30 text-green-400' :
                            priceChange < 0 ? 'bg-red-900/30 text-red-400' : 'bg-gray-800 text-gray-400'
                            }`}>
                            {priceChange > 0 ? <TrendingUp size={12} className="mr-1" /> :
                                priceChange < 0 ? <TrendingDown size={12} className="mr-1" /> : <Minus size={12} className="mr-1" />}
                            {Math.abs(priceChange).toFixed(2)} ({Math.abs(percentChange).toFixed(1)}%)
                        </div>
                        <div className="text-xs text-gray-500">
                            {new Date(current.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                        </div>
                    </div>
                </div>

                {/* Sparkline */}
                <div className="h-16 w-32">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={graphData}>
                            <defs>
                                <linearGradient id="gradient-rdn" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.5} />
                                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke={chartColor}
                                strokeWidth={2}
                                fill="url(#gradient-rdn)"
                                isAnimationActive={false}
                            />
                            <YAxis domain={['dataMin', 'dataMax']} hide />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Decor */}
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-16 -mt-16 ${priceChange > 0 ? 'bg-green-500/10' :
                priceChange < 0 ? 'bg-red-500/10' : 'bg-cyan-500/10'
                }`}></div>
        </div>
    );
}
