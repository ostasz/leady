'use client';

import { DailyPriceSummary, formatPrice, getPriceColor } from '@/types/energy-prices';
import { TrendingDown, TrendingUp, DollarSign, Clock } from 'lucide-react';

interface PriceStatisticsProps {
    data: DailyPriceSummary;
}

export default function PriceStatistics({ data }: PriceStatisticsProps) {
    const { statistics } = data;

    const StatCard = ({
        title,
        value,
        subtitle,
        icon: Icon,
        color
    }: {
        title: string;
        value: string;
        subtitle: string;
        icon: any;
        color: string;
    }) => (
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-start justify-between mb-2">
                <div>
                    <p className="text-sm text-gray-600">{title}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: `${color}15` }}>
                    <Icon size={24} style={{ color }} />
                </div>
            </div>
            <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
                title="Najniższa cena"
                value={`${statistics.minPrice.toFixed(2)} PLN`}
                subtitle={`Godzina ${statistics.minHour}:00`}
                icon={TrendingDown}
                color="#10b981"
            />

            <StatCard
                title="Najwyższa cena"
                value={`${statistics.maxPrice.toFixed(2)} PLN`}
                subtitle={`Godzina ${statistics.maxHour}:00`}
                icon={TrendingUp}
                color="#ef4444"
            />

            <StatCard
                title="Średnia cena"
                value={`${statistics.avgPrice.toFixed(2)} PLN`}
                subtitle="Całodniowa średnia"
                icon={DollarSign}
                color="#6366f1"
            />

            <StatCard
                title="Potencjał oszczędności"
                value={`${statistics.savings.toFixed(2)} PLN`}
                subtitle="Różnica min-max"
                icon={Clock}
                color="#f59e0b"
            />
        </div>
    );
}
