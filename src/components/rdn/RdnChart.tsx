'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-lg text-sm z-50">
                <p className="text-gray-500 mb-2 font-medium">
                    {format(parseISO(label), 'd MMMM yyyy (EEEE)', { locale: pl })}
                </p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#C1F232]" />
                        <span className="text-gray-500 font-medium">TGe24:</span>
                        <span className="text-gray-900 font-bold text-lg">
                            {entry.value?.toFixed(2)} <span className="text-xs font-normal text-gray-400">PLN</span>
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
        <div className="w-full h-[450px] bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4ADE80" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#4ADE80" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={true} />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(str) => format(parseISO(str), 'dd.MM')}
                        stroke="#9CA3AF"
                        fontSize={12}
                        minTickGap={40}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                    />
                    <YAxis
                        domain={['auto', 'auto']}
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickFormatter={(val) => `${val}`}
                        width={40}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#4ADE80"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
