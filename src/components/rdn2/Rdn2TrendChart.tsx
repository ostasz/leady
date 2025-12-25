'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useState } from 'react';

interface PriceData {
    date: string;
    price: number; // calculated average price for the day
}

interface TrendChartProps {
    data: any[]; // Full history from API
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-lg text-sm z-50">
                <p className="text-gray-500 mb-1 font-medium text-xs">
                    {format(parseISO(label), 'd MMMM yyyy', { locale: pl })}
                </p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#009D8F]" />
                    <span className="text-gray-500 font-medium">Spot (TGe24):</span>
                    <span className="text-gray-900 font-bold">
                        {payload[0].value?.toFixed(2)} <span className="text-xs font-normal text-gray-400">PLN</span>
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

export default function Rdn2TrendChart({ data }: TrendChartProps) {
    const [range, setRange] = useState(30);

    // Prepare data: map { date, prices[] } -> { date, price: avg }
    // Sort by date just in case
    const processData = () => {
        if (!data) return [];
        return data
            .map((d: any) => ({
                date: d.date,
                price: d.prices.reduce((a: number, b: number) => a + b, 0) / d.prices.length
            }))
            .sort((a: any, b: any) => a.date.localeCompare(b.date));
    };

    const fullData = processData();
    const filteredData = fullData.slice(-range);

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Analiza Trendu</h2>
                    <div className="text-sm text-gray-500">
                        Notowania historyczne TGe24
                        {filteredData.length > 0 && (
                            <span className="ml-1 text-gray-400">
                                (od {format(parseISO(filteredData[0].date), 'dd.MM.yyyy')} do {format(parseISO(filteredData[filteredData.length - 1].date), 'dd.MM.yyyy')})
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100 w-fit">
                    {[30, 90, 365].map((days) => (
                        <button
                            key={days}
                            onClick={() => setRange(days)}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${range === days
                                ? 'bg-[#009D8F] text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-white'
                                }`}
                        >
                            {days === 365 ? '1 Rok' : `${days} Dni`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#009D8F" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#009D8F" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={true} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(str) => format(parseISO(str), 'dd.MM')}
                            stroke="#94A3B8"
                            fontSize={11}
                            minTickGap={50}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />
                        <YAxis
                            domain={['auto', 'auto']}
                            stroke="#94A3B8"
                            fontSize={11}
                            tickFormatter={(val) => Math.round(val).toString()}
                            width={35}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#009D8F', strokeWidth: 1, strokeDasharray: '3 3' }} />
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#009D8F"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorTrend)"
                            animationDuration={1000}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
