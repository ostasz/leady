import { TrendingUp, TrendingDown, Activity, Battery } from 'lucide-react';
import { FuturesKpiDto } from '@/types/energy-prices';

interface KPIProps {
    data: FuturesKpiDto;
    contract: string;
}

export default function FuturesAdvKPI({ data, contract }: KPIProps) {
    // A) Fix: Proper 0 handling
    const formatPrice = (v?: number | null) =>
        (v === null || v === undefined || Number.isNaN(v)) ? '-.--' : v.toFixed(2);

    // B) Fix: Safe spread status logic
    const getSpreadStatus = (change: number = 0) => {
        if (!Number.isFinite(change)) return { label: 'Brak Danych', color: 'text-gray-500' };
        if (change > 0.5) return { label: 'Rosnący (Widening)', color: 'text-orange-400' };
        if (change < -0.5) return { label: 'Malejący (Narrowing)', color: 'text-blue-400' };
        return { label: 'Stabilny', color: 'text-gray-500' };
    };

    const spreadStatus = getSpreadStatus(data.spreadChange);

    // Helper for rendering trend percentage safely
    const renderTrend = (changePct?: number) => {
        if (changePct === undefined || changePct === null) return null;

        const isPositive = changePct >= 0;
        const Icon = isPositive ? TrendingUp : TrendingDown;
        const color = isPositive ? 'text-[#00C1B5]' : 'text-red-400';

        return (
            <div className={`mt-2 flex items-center gap-1 ${color} text-sm`}>
                <Icon size={16} aria-hidden="true" />
                <span>{isPositive ? '+' : ''}{changePct.toFixed(1)}% vs Wczoraj</span>
            </div>
        );
    };

    // E) Safe volume/OI
    const safeVolume = Number.isFinite(data.volume) ? data.volume : 0;
    const safeOpenInterest = Number.isFinite(data.openInterest) ? data.openInterest : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* BASE Card */}
            <div className="bg-[#1E293B] text-white p-5 rounded-xl shadow-sm border border-gray-700 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Activity size={48} className="text-[#009D8F]" aria-hidden="true" />
                </div>
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">
                    BASE {contract}
                </div>
                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    {formatPrice(data.basePrice)} <span className="text-sm font-normal text-gray-500">PLN/MWh</span>
                </div>
                {renderTrend(data.baseChangePct)}
            </div>

            {/* PEAK Card */}
            <div className="bg-[#1E293B] text-white p-5 rounded-xl shadow-sm border border-gray-700 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Battery size={48} className="text-[#009D8F]" aria-hidden="true" />
                </div>
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">
                    {/* D) Improved contract naming robust against missing 'BASE' */}
                    PEAK {contract.includes('BASE') ? contract.replace('BASE', 'PEAK') : `${contract} (PEAK)`}
                </div>
                <div className="text-3xl font-bold text-white">
                    {formatPrice(data.peakPrice)} <span className="text-sm font-normal text-gray-500">PLN/MWh</span>
                </div>
                {renderTrend(data.peakChangePct)}
            </div>

            {/* SPREAD Card */}
            <div className="bg-[#1E293B] text-white p-5 rounded-xl shadow-sm border border-gray-700">
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">
                    Spread BASE/PEAK
                </div>
                <div className="text-3xl font-bold text-[#009D8F]">
                    {formatPrice(data.spread)} <span className="text-sm font-normal text-gray-500">PLN</span>
                </div>
                {/* G) Optional visual bar removed as per review suggestion to avoid misleading scale */}
                <div className={`text-xs mt-4 text-center ${spreadStatus.color}`}>
                    {spreadStatus.label} ({data.spreadChange ? (data.spreadChange > 0 ? '+' : '') + data.spreadChange.toFixed(2) : '0.00'})
                </div>
            </div>

            {/* VOL/LOP Card */}
            <div className="bg-[#1E293B] text-white p-5 rounded-xl shadow-sm border border-gray-700">
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">
                    Całkowity Wolumen / LOP
                </div>
                <div className="flex flex-col">
                    <div className="text-2xl font-bold text-[#A78BFA]">
                        {(safeVolume / 1000).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k <span className="text-sm text-gray-500">MWh</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        LOP: {safeOpenInterest.toLocaleString('pl-PL')}
                    </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[#00C1B5] text-sm justify-end">
                    <TrendingUp size={14} aria-hidden="true" />
                    <span>Active</span>
                </div>
            </div>
        </div>
    )
}
