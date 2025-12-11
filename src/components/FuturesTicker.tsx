'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, Zap, ExternalLink } from 'lucide-react';
import { AreaChart, Area, YAxis, Tooltip } from 'recharts';

interface FutureData {
    date: string;
    price: number;
}

interface FuturesResponse {
    futures: {
        [year: string]: FutureData[];
    };
}

export default function FuturesTicker() {
    const [data, setData] = useState<FuturesResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchFutures = async () => {
            try {
                const res = await fetch('/api/energy-prices/futures');
                if (!res.ok) throw new Error('Failed to fetch data');
                const json = await res.json();
                setData(json);
            } catch (err) {
                setError('Błąd pobierania danych');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchFutures();
    }, []);

    if (loading) return (
        <div className="bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-800 h-48 animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-600 border-t-cyan-500 rounded-full animate-spin"></div>
        </div>
    );

    if (error || !data) return null; // Hide if error or no data

    const years = Object.keys(data.futures).sort();
    if (years.length === 0) return null;

    return (
        <div className="bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-800 relative overflow-hidden text-white">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-800 rounded-lg text-cyan-400">
                        <Zap size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-100">Notowania Terminowe (Futures)</h3>
                        <p className="text-xs text-gray-400">Kontrakty BASE (PLN/MWh)</p>
                    </div>
                </div>
                <Link href="/apps/futures" className="text-gray-500 hover:text-cyan-400 transition-colors" title="Otwórz pełny dashboard">
                    <ExternalLink size={18} />
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                {years.map(year => {
                    const history = data.futures[year];
                    if (!history || history.length === 0) return null;

                    const latest = history[history.length - 1];
                    const prev = history[0];
                    const change = latest.price - prev.price;
                    const changePercent = prev.price ? (change / prev.price) * 100 : 0;

                    // Determine color based on change
                    let chartColor = '#06b6d4'; // Default Blue/Cyan (0 change)
                    if (change > 0) chartColor = '#22c55e'; // Green
                    if (change < 0) chartColor = '#ef4444'; // Red

                    return (
                        <div key={year} className="relative">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <div className="text-sm font-medium text-gray-400 mb-1">BASE {year}</div>
                                    <div className="text-2xl font-bold tracking-tight text-white">
                                        {latest.price.toFixed(2)} <span className="text-sm font-normal text-gray-500">PLN</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className={`flex items-center text-xs font-semibold px-1.5 py-0.5 rounded ${change > 0 ? 'bg-green-900/30 text-green-400' :
                                            change < 0 ? 'bg-red-900/30 text-red-400' : 'bg-gray-800 text-gray-400'
                                            }`}>
                                            {change > 0 ? <TrendingUp size={12} className="mr-1" /> :
                                                change < 0 ? <TrendingDown size={12} className="mr-1" /> : <Minus size={12} className="mr-1" />}
                                            {Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(1)}%)
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(latest.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                                        </div>
                                    </div>
                                </div>

                                {/* Sparkline */}
                                <Link href="/apps/futures" className="h-16 w-24 cursor-pointer hover:opacity-80 transition-opacity">
                                    <AreaChart width={96} height={64} data={history}>
                                        <defs>
                                            <linearGradient id={`gradient-${year}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={chartColor} stopOpacity={0.5} />
                                                <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <Area
                                            type="monotone"
                                            dataKey="price"
                                            stroke={chartColor}
                                            strokeWidth={2}
                                            fill={`url(#gradient-${year})`}
                                            isAnimationActive={false}
                                        />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-gray-950/90 px-1.5 py-0.5 rounded text-[10px] text-gray-200 font-mono border border-gray-800 shadow-sm leading-none">
                                                            {Number(payload[0].value).toFixed(1)}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                            cursor={{ stroke: chartColor, strokeWidth: 1, opacity: 0.5 }}
                                        />
                                        <YAxis domain={['dataMin', 'dataMax']} hide />
                                    </AreaChart>
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Decor */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        </div>
    );
}
