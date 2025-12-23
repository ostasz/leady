'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PriceData {
    date: string;
    price: number;
}

interface KPIProps {
    data: PriceData[]; // Expecting sorted ASC
    label: string;
}

export default function RdnKPI({ data, label }: KPIProps) {
    if (!data || data.length === 0) return null;

    const latest = data[data.length - 1];
    // Price Stats - Compare Latest vs Start of Period
    const first = data[0];
    const change = latest.price - first.price;
    const changePercent = first.price ? (change / first.price) * 100 : 0;

    // Period Stats
    const prices = data.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Volatility (Max - Min) / Min
    const rangePercent = min ? ((max - min) / min) * 100 : 0;

    return (
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm overflow-hidden relative">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1 opacity-75">{label}</p>
                    <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">
                        {latest.price.toFixed(2)} <span className="text-lg font-normal text-gray-400">PLN</span>
                    </h2>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm ${change >= 0 ? 'bg-[#C1F232] text-gray-900' : 'bg-red-100 text-red-700'}`}>
                    {change >= 0 ? <TrendingUp size={16} strokeWidth={2.5} /> : <TrendingDown size={16} strokeWidth={2.5} />}
                    {Math.abs(change).toFixed(2)} ({Math.abs(changePercent).toFixed(1)}%)
                </div>
            </div>

            <div className="flex items-center gap-4 text-sm relative z-10 w-full">
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 flex-1 shadow-sm">
                    <span className="text-gray-400 block text-xs font-medium mb-0.5">Min (Okres)</span>
                    <span className="font-bold text-gray-800 text-base">{min.toFixed(2)}</span>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 flex-1 shadow-sm">
                    <span className="text-gray-400 block text-xs font-medium mb-0.5">Max (Okres)</span>
                    <span className="font-bold text-gray-800 text-base">{max.toFixed(2)}</span>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 flex-1 shadow-sm">
                    <span className="text-gray-400 block text-xs font-medium mb-0.5">Zmienność</span>
                    <span className="font-bold text-gray-800 text-base">{rangePercent.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
}
