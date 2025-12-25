'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';

interface KpiStats {
    tgeBase: number;
    tgeBaseChange: number;
    tgePeak: number;
    tgePeakChange: number;
    minPrice: number;
    maxPrice: number;
    volume: number;
    volumeChange: number;
    history: { val: number; date: string }[];
    peakHistory?: { val: number; date: string }[];
    spreadHistory?: { val: number; date: string }[];
}

interface Rdn2KpiCardsProps {
    stats: KpiStats;
    onDateSelect?: (date: string) => void;
}

export default function Rdn2KpiCards({ stats, onDateSelect }: Rdn2KpiCardsProps) {
    const KpiCard = ({ title, value, subValue, change, data, unit, color = "purple" }: any) => {
        const isPositive = change >= 0;
        const colorHex = color === 'purple' ? '#7C3AED' : color === 'orange' ? '#F97316' : color === 'mint' ? '#009D8F' : '#D2E603';

        return (
            <div className="bg-white rounded-xl p-5 relative overflow-hidden text-gray-900 border border-gray-200 shadow-sm group">
                <div className="relative z-30 pointer-events-none">
                    <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">{title}</h3>

                    <div className="flex items-baseline gap-2 mt-2">
                        <span className={`font-bold font-mono tracking-tight ${String(value).length > 12 ? 'text-2xl' : 'text-3xl'} whitespace-nowrap text-gray-900`}>{value}</span>
                        {unit && <span className="text-gray-500 text-xs font-medium">{unit}</span>}
                    </div>

                    {subValue && (
                        <div className="mt-1 text-sm text-gray-500 font-medium">
                            {subValue}
                        </div>
                    )}

                    {change !== undefined && (
                        <div className={`flex items-center gap-1 mt-3 px-2 py-1 rounded-md w-fit bg-opacity-20 ${isPositive ? 'bg-[#D2E603]/20 text-[#D2E603]' : 'bg-[#F97316]/20 text-[#F97316]'}`}>
                            {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                            <span className="text-xs font-bold text-gray-700">{Math.abs(change).toFixed(2)}%</span>
                        </div>
                    )}
                </div>

                {/* Sparkline in background - Interactive */}
                <div className="absolute bottom-0 left-0 right-0 h-24 opacity-30 hover:opacity-100 transition-opacity duration-300 z-20">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            onClick={(e: any) => {
                                if (e && e.activePayload && e.activePayload[0]) {
                                    onDateSelect?.(e.activePayload[0].payload.date);
                                }
                            }}
                            className="cursor-pointer"
                        >
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '8px', padding: '8px', fontSize: '12px' }}
                                itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                labelStyle={{ display: 'none' }}
                                formatter={(value: number) => [value.toFixed(2), '']}
                            />
                            <Area
                                type="monotone"
                                dataKey="val"
                                stroke={colorHex}
                                fill={colorHex}
                                strokeWidth={2}
                                fillOpacity={0.2}
                                activeDot={{ r: 4, fill: '#fff', stroke: colorHex }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
                title="TGEBase (Średnia Dnia)"
                value={stats.tgeBase.toFixed(2)}
                change={stats.tgeBaseChange}
                data={stats.history}
                color="mint"
            />
            <KpiCard
                title="TGEPeak (07-22h)"
                value={stats.tgePeak.toFixed(2)}
                change={stats.tgePeakChange}
                data={stats.peakHistory || stats.history}
                color="orange"
            />
            <KpiCard
                title="Cena Max / Min"
                value={`${stats.maxPrice.toFixed(2)} / ${stats.minPrice.toFixed(2)}`}
                subValue={`Spread: ${(stats.maxPrice - stats.minPrice).toFixed(2)} PLN`}
                data={stats.spreadHistory || stats.history}
                color="purple"
            />
            <KpiCard
                title="Wolumen Całkowity"
                value={stats.volume.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u00A0/g, ' ')}
                unit="MWh"
                change={stats.volumeChange}
                data={stats.history.map(h => ({ ...h, val: 0 }))}
                color="lime"
            />
        </div>
    );
}
