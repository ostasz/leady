'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface PriceHistoryChartProps {
    data: { date: string; avgPrice: number }[];
    onDateSelect?: (date: string) => void;
    selectedDate?: string;
    overallAverage?: number;
}

export default function PriceHistoryChart({ data, onDateSelect, selectedDate, overallAverage }: PriceHistoryChartProps) {
    // Format date for X-axis (e.g., "01.01")
    const formatXAxis = (dateStr: string) => {
        const date = new Date(dateStr);
        return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    };

    // Format tooltip date
    const formatTooltipDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pl-PL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="font-semibold text-gray-900 mb-1">{formatTooltipDate(label)}</p>
                    <p className="text-sm text-gray-600">Średnia cena:</p>
                    <p className="text-lg font-bold text-primary">
                        {payload[0].value.toFixed(2)} PLN/MWh
                    </p>
                </div>
            );
        }
        return null;
    };

    // Use passed overallAverage or calculate fallback
    const avgToDisplay = overallAverage ?? (data.reduce((sum, item) => sum + item.avgPrice, 0) / (data.length || 1));

    return (
        <div className="w-full h-80 relative">
            <div className="absolute top-2 right-4 bg-white/90 px-3 py-1.5 rounded-lg border border-green-500 shadow-sm z-10">
                <span className="text-sm text-gray-600 mr-2">Średnia:</span>
                <span className="text-base font-bold text-green-600">{avgToDisplay.toFixed(2)} PLN</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    onClick={(e: any) => {
                        if (e && e.activePayload && e.activePayload[0]) {
                            onDateSelect?.(e.activePayload[0].payload.date);
                        }
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={formatXAxis}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        tickMargin={10}
                    />
                    <YAxis
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 2 }} />
                    <ReferenceLine
                        y={avgToDisplay}
                        stroke="#10b981"
                        strokeDasharray="5 5"
                    />
                    <Line
                        type="monotone"
                        dataKey="avgPrice"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                    />
                    {selectedDate && (
                        <ReferenceLine x={selectedDate} stroke="#ef4444" strokeDasharray="3 3" />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
