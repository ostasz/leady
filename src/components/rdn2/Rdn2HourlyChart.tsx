'use client';

import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Area
} from 'recharts';

interface HourlyData {
    hour: string; // "00", "01"...
    price: number;
    priceYesterday: number;
    priceAvgWeek: number;
    volume: number;
}

export default function Rdn2HourlyChart({ data }: { data: HourlyData[] }) {
    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-gray-900 text-lg font-semibold flex items-center gap-2">
                    Profil Godzinowy Ceny Energii (Fixing I) - Dzień Następny
                </h2>
            </div>

            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#009D8F" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#009D8F" stopOpacity={0.3} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />

                        <XAxis
                            dataKey="hour"
                            tick={{ fill: '#64748B', fontSize: 12 }}
                            axisLine={{ stroke: '#e5e7eb' }}
                            tickLine={false}
                            label={{ value: 'Godzina Doby', position: 'insideBottom', offset: -10, fill: '#64748B' }}
                        />

                        <YAxis
                            yAxisId="left"
                            tick={{ fill: '#64748B', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            label={{ value: 'Cena (PLN/MWh)', angle: -90, position: 'insideLeft', fill: '#64748B', style: { textAnchor: 'middle' } }}
                        />

                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fill: '#64748B', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                            label={{ value: 'Wolumen (MWh)', angle: 90, position: 'insideRight', fill: '#64748B', style: { textAnchor: 'middle' } }}
                        />

                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            itemStyle={{ fontSize: '12px' }}
                            labelStyle={{ color: '#64748B', marginBottom: '5px' }}
                            formatter={(value: number, name: string) => [value.toFixed(2), name]}
                        />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ top: -10 }} />

                        {/* Volume as subtle area/bars in background */}
                        <Bar
                            yAxisId="right"
                            dataKey="volume"
                            name="Wolumen"
                            fill="#64748B"
                            opacity={0.1}
                            barSize={20}
                        />

                        {/* Main Price Bars */}
                        <Bar
                            yAxisId="left"
                            dataKey="price"
                            name="Ceny (PLN/MWh)"
                            fill="url(#colorPrice)"
                            radius={[4, 4, 0, 0]}
                            barSize={30}
                        />

                        {/* Benchmarks */}
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="priceYesterday"
                            name="Poprzedni Dzień"
                            stroke="#F97316"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                        />

                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="priceAvgWeek"
                            name="Średnia Tygodniowa"
                            stroke="#7C3AED"
                            strokeWidth={2}
                            dot={false}
                        />

                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
