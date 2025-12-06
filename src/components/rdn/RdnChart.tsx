'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps, Brush } from 'recharts';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

interface PriceData {
    date: string;
    price: number;
}

interface ChartProps {
    data: PriceData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl text-sm z-50">
                <p className="text-gray-400 mb-2 font-medium">
                    {format(parseISO(label), 'd MMMM yyyy (EEEE)', { locale: pl })}
                </p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-gray-300 font-medium">TGe24:</span>
                        <span className="text-white font-bold text-base">
                            {entry.value?.toFixed(2)} <span className="text-xs font-normal text-gray-500">PLN</span>
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function RdnChart({ data }: ChartProps) {
    return (
        <div className="w-full h-[450px] bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-lg">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(str) => format(parseISO(str), 'dd.MM')}
                        stroke="#9ca3af"
                        fontSize={12}
                        minTickGap={30}
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        stroke="#9ca3af"
                        fontSize={12}
                        tickFormatter={(val) => `${val}`}
                        width={40}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                        type="monotone"
                        dataKey="price"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6, fill: '#10b981', stroke: '#fff' }}
                        connectNulls
                    />
                    <Brush
                        dataKey="date"
                        height={30}
                        stroke="#4b5563"
                        fill="#1f2937"
                        tickFormatter={(str) => format(parseISO(str), 'MM-yy')}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
