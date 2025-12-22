'use client';

import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

interface ChartData {
    label: string;
    value: number;
    [key: string]: any;
}

interface AIChartProps {
    type: 'line' | 'bar';
    title: string;
    data: ChartData[];
    xAxisLabel?: string;
    yAxisLabel?: string;
    color?: string;
}

export default function AIChart({ type, title, data, xAxisLabel, yAxisLabel, color = '#005a8c' }: AIChartProps) {
    return (
        <div className="w-full bg-white p-4 rounded-xl border border-gray-100 shadow-sm my-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 text-center">{title}</h3>
            <div className="h-[300px] w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                    {type === 'line' ? (
                        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="label"
                                stroke="#9ca3af"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10 }}
                                minTickGap={30}
                            />
                            <YAxis
                                stroke="#9ca3af"
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}`}
                                tick={{ fontSize: 10 }}
                                label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#9ca3af' } : undefined}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="value"
                                name={yAxisLabel || "Wartość"}
                                stroke={color}
                                strokeWidth={2}
                                activeDot={{ r: 6 }}
                                dot={false}
                            />
                        </LineChart>
                    ) : (
                        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="label"
                                stroke="#9ca3af"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10 }}
                            />
                            <YAxis
                                stroke="#9ca3af"
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}`}
                                tick={{ fontSize: 10 }}
                                label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', fill: '#9ca3af' } : undefined}
                            />
                            <Tooltip
                                cursor={{ fill: '#f3f4f6' }}
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }}
                            />
                            <Legend />
                            <Bar
                                dataKey="value"
                                name={yAxisLabel || "Wartość"}
                                fill={color}
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>
            {(xAxisLabel || yAxisLabel) && (
                <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-2">
                    <span>{xAxisLabel}</span>
                </div>
            )}
        </div>
    );
}
