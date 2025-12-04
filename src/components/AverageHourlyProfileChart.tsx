'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { getPriceColor } from '@/types/energy-prices';

interface AverageHourlyProfileChartProps {
    data: { hour: number; price: number }[];
    overallAverage?: number;
}

export default function AverageHourlyProfileChart({ data, overallAverage }: AverageHourlyProfileChartProps) {
    // Use passed overallAverage or calculate fallback
    const profileAvg = overallAverage ?? (data.reduce((sum, item) => sum + item.price, 0) / (data.length || 1));

    const chartData = data.map(item => ({
        ...item,
        fill: getPriceColor(item.price, profileAvg)
    }));

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="font-semibold text-gray-900">Godzina {data.hour}:00</p>
                    <p className="text-lg font-bold" style={{ color: data.fill }}>
                        {data.price.toFixed(2)} PLN/MWh
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-80 relative">
            <div className="absolute top-2 right-4 bg-white/90 px-3 py-1.5 rounded-lg border border-indigo-500 shadow-sm z-10">
                <span className="text-sm text-gray-600 mr-2">Średnia:</span>
                <span className="text-base font-bold text-indigo-600">{profileAvg.toFixed(2)} PLN</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="hour"
                        label={{ value: 'Godzina', position: 'insideBottom', offset: -10 }}
                        tick={{ fill: '#6b7280' }}
                    />
                    <YAxis
                        label={{ value: 'Średnia Cena (PLN/MWh)', angle: -90, position: 'insideLeft' }}
                        tick={{ fill: '#6b7280' }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }} />
                    <ReferenceLine
                        y={profileAvg}
                        stroke="#6366f1"
                        strokeDasharray="5 5"
                    />
                    <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-xs text-gray-600 bg-gray-50 py-3 px-4 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full shadow-sm"></div>Bardzo tanio</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>Tanio</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-full shadow-sm"></div>Średnio</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-500 rounded-full shadow-sm"></div>Drogo</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full shadow-sm"></div>Bardzo drogo</div>
            </div>
        </div>
    );
}
