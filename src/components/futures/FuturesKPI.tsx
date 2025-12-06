'use client';

import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from 'lucide-react';

interface FutureData {
    date: string;
    price: number;
}

interface KPIProps {
    year: string;
    data: FutureData[]; // Expecting sorted ASC
    label: string;
}

export default function FuturesKPI({ year, data, label }: KPIProps) {
    if (!data || data.length === 0) return null;

    const latest = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : latest;

    // Price Stats
    const change = latest.price - prev.price;
    const changePercent = prev.price ? (change / prev.price) * 100 : 0;

    // Period Stats (based on passed data, so if we pass 1 year, it's 1 year stats)
    const prices = data.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    // Volatility (Max - Min) / Min
    const rangePercent = min ? ((max - min) / min) * 100 : 0;

    return (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 text-white shadow-lg overflow-hidden relative">
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">{label}</p>
                    <h2 className="text-3xl font-bold">{latest.price.toFixed(2)} <span className="text-base font-normal text-gray-500">PLN</span></h2>
                </div>
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold ${change > 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        change < 0 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    }`}>
                    {change > 0 ? <TrendingUp size={16} /> :
                        change < 0 ? <TrendingDown size={16} /> : <Minus size={16} />}
                    {Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(1)}%)
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs relative z-10">
                <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                    <span className="text-gray-500 block mb-0.5">Min (Okres)</span>
                    <span className="font-semibold text-gray-300">{min.toFixed(2)}</span>
                </div>
                <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                    <span className="text-gray-500 block mb-0.5">Max (Okres)</span>
                    <span className="font-semibold text-gray-300">{max.toFixed(2)}</span>
                </div>
                <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50">
                    <span className="text-gray-500 block mb-0.5">Zmienność</span>
                    <span className="font-semibold text-cyan-400">{rangePercent.toFixed(1)}%</span>
                </div>
            </div>

            {/* Decor */}
            <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full blur-3xl opacity-20 ${change > 0 ? 'bg-green-500' :
                    change < 0 ? 'bg-red-500' : 'bg-cyan-500'
                }`}></div>
        </div>
    );
}
