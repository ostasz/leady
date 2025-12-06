'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, TooltipProps, Brush } from 'recharts';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

interface FutureData {
    date: string;
    price: number;
}

interface ChartProps {
    dataY1: FutureData[];
    dataY2: FutureData[];
    year1: string;
    year2: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg shadow-xl text-sm z-50">
                <p className="text-gray-400 mb-2 font-medium">
                    {format(parseISO(label), 'd MMMM yyyy (EEEE)', { locale: pl })}
                </p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-gray-300 font-medium">{entry.name}:</span>
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

export default function FuturesChart({ dataY1, dataY2, year1, year2 }: ChartProps) {
    // Merge data by date
    // Create a map of all unique dates
    const dateMap = new Map<string, { date: string;[key: string]: any }>();

    [...dataY1, ...dataY2].forEach(d => {
        if (!dateMap.has(d.date)) {
            dateMap.set(d.date, { date: d.date });
        }
    });

    dataY1.forEach(d => {
        if (dateMap.has(d.date)) {
            dateMap.get(d.date)![year1] = d.price;
        }
    });

    dataY2.forEach(d => {
        if (dateMap.has(d.date)) {
            dateMap.get(d.date)![year2] = d.price;
        }
    });

    const mergedData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return (
        <div className="w-full h-[450px] bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-lg">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergedData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
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
                    <Legend verticalAlign="top" height={36} />
                    <Line
                        type="monotone"
                        dataKey={year1}
                        stroke="#06b6d4"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: '#06b6d4', stroke: '#fff' }}
                        name={`BASE ${year1}`}
                        connectNulls
                    />
                    <Line
                        type="monotone"
                        dataKey={year2}
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff' }}
                        name={`BASE ${year2}`}
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
