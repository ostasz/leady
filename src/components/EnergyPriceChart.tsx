'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { DailyPriceSummary, getPriceColor } from '@/types/energy-prices';

interface EnergyPriceChartProps {
    data: DailyPriceSummary;
}

export default function EnergyPriceChart({ data }: EnergyPriceChartProps) {
    const chartData = data.hourlyPrices.map(hp => ({
        hour: hp.hour,
        price: hp.price,
        fill: getPriceColor(hp.price)
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
        <div className="w-full h-96">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="hour"
                        label={{ value: 'Godzina', position: 'insideBottom', offset: -10 }}
                        tick={{ fill: '#6b7280' }}
                    />
                    <YAxis
                        label={{ value: 'Cena (PLN/MWh)', angle: -90, position: 'insideLeft' }}
                        tick={{ fill: '#6b7280' }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }} />
                    <ReferenceLine
                        y={data.statistics.avgPrice}
                        stroke="#6366f1"
                        strokeDasharray="5 5"
                        label={{
                            value: `Średnia: ${data.statistics.avgPrice.toFixed(2)}`,
                            position: 'right',
                            fill: '#6366f1',
                            fontSize: 12
                        }}
                    />
                    <Bar dataKey="price" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
