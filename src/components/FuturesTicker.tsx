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
        <div className="group bg-white rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden text-gray-900 transition-all hover:shadow-md">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-[#2DD4BF] group-hover:bg-[#C5FAEA] transition-all duration-300">
                        <Zap size={24} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Notowania Terminowe (Futures)</h3>
                        <p className="text-xs text-gray-500">Kontrakty BASE (PLN/MWh)</p>
                    </div>
                </div>
                <Link href="/apps/futures" className="text-gray-400 hover:text-[#2DD4BF] transition-colors" title="Otwórz pełny dashboard">
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

                    // Specific Color Logic per year/trend
                    // Grow: Mint/Turquoise Chart, Lime Indicator
                    // Decline: Orange Chart, Orange Indicator

                    const isGrowth = change >= 0;

                    // Chart Color: Mint (#2DD4BF) if growth, Orange (#f97316) if decline
                    const chartColor = isGrowth ? '#2DD4BF' : '#f97316';

                    // Indicator Styles
                    const indicatorClass = isGrowth
                        ? 'bg-[#ecfccb] text-[#65a30d]' // Lime 100 BG, Lime 600 Text
                        : 'bg-[#fff7ed] text-[#ea580c]'; // Orange 50 BG, Orange 600 Text

                    return (
                        <div key={year} className="relative">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <div className="text-sm font-medium text-gray-500 mb-1">BASE {year}</div>
                                    <div className="text-2xl font-bold tracking-tight text-gray-900">
                                        {latest.price.toFixed(2)} <span className="text-sm font-normal text-gray-400">PLN</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-md ${indicatorClass}`}>
                                            {change >= 0 ? <TrendingUp size={12} className="mr-1" strokeWidth={2.5} /> :
                                                <TrendingDown size={12} className="mr-1" strokeWidth={2.5} />}
                                            {Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(1)}%)
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {new Date(latest.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                                        </div>
                                    </div>
                                </div>

                                {/* Sparkline */}
                                <Link href="/apps/futures" className="h-16 w-24 cursor-pointer hover:opacity-80 transition-opacity">
                                    <AreaChart width={96} height={64} data={history}>
                                        <defs>
                                            <linearGradient id={`gradient-${year}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={chartColor} stopOpacity={0.4} />
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
                                                        <div className="bg-white px-2 py-1 rounded text-xs text-gray-700 font-medium border border-gray-100 shadow-md">
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

            {/* Decor - Mint Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#2DD4BF]/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        </div>
    );
}
