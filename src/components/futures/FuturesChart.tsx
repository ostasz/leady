'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

import { FuturesHistoryPoint } from '@/types/energy-prices';

interface ChartProps {
    dataY1: FuturesHistoryPoint[];
    dataY2: FuturesHistoryPoint[];
    year1: string;
    year2: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: {
        value?: number;
        name?: string;
        color?: string;
    }[];
    label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-lg text-sm z-50">
                <p className="text-gray-500 mb-2 font-medium">
                    {label && format(parseISO(label), 'd MMMM yyyy (EEEE)', { locale: pl })}
                </p>
                {payload.map((entry, index: number) => (
                    <div key={index} className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-gray-500 font-medium">{entry.name}:</span>
                        <span className="text-gray-900 font-bold text-base">
                            {entry.value?.toFixed(2)} <span className="text-xs font-normal text-gray-400">PLN</span>
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
    const dateMap = new Map<string, { date: string } & Record<string, number | string>>();

    [...dataY1, ...dataY2].forEach(d => {
        if (!dateMap.has(d.date)) {
            dateMap.set(d.date, { date: d.date });
        }
    });

    dataY1.forEach(d => {
        if (dateMap.has(d.date)) {
            dateMap.get(d.date)![year1] = d.close;
        }
    });

    dataY2.forEach(d => {
        if (dateMap.has(d.date)) {
            dateMap.get(d.date)![year2] = d.close;
        }
    });

    const mergedData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Colors: Mint (#2DD4BF or Teal-400) and Deep Purple (#7e22ce or Purple-700)
    // Background: bg-gray-50 container, white chart if needed? User said "Obszar wykresu ma białe tło".
    // I will set container to bg-gray-50 and chart area usually is transparent so it shows container bg.
    // Wait, user said "Obszar wykresu ma białe tło" (The chart area has a white background).
    // So distinct from container? Or is container white?
    // "Duży dolny kontener ... mają tło w kolorze bardzo jasnoszarym" (Container light gray).
    // "Obszar wykresu ma białe tło" (Chart Area white).
    // I will assume the outer div is the container (gray-50) and maybe give the chart SVG a white bg or just the plot area?
    // Actually, simpler to just make the container bg-gray-50 as requested and maybe a white inset?
    // Let's stick to simple Container = bg-gray-50 as per plan. If Chart Area needs to be white, I can add a background to LineChart or CartesianGrid fill?
    // I will try to make the LineChart container white inside a Gray wrapper if that was the intent, but usually "Chart Area" refers to the whole box.
    // Let's stick to `bg-gray-50` for the *component* box (matching KPIs). 

    return (
        <div className="w-full h-[450px] bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergedData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={true} />
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
                    <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ color: '#374151' }}
                    />
                    <Line
                        type="monotone"
                        dataKey={year1}
                        stroke="#2DD4BF"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: '#2DD4BF', stroke: '#fff' }}
                        name={`BASE ${year1}`}
                        connectNulls
                    />
                    <Line
                        type="monotone"
                        dataKey={year2}
                        stroke="#7e22ce"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: '#7e22ce', stroke: '#fff' }}
                        name={`BASE ${year2}`}
                        connectNulls
                    />
                    <Brush
                        dataKey="date"
                        height={30}
                        stroke="#d1d5db"
                        fill="#f3f4f6"
                        tickFormatter={(str) => format(parseISO(str), 'MM-yy')}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
