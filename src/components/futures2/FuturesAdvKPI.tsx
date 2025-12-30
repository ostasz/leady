import { TrendingUp, TrendingDown, Activity, Battery } from 'lucide-react';
import { FuturesKpiDto } from '@/types/energy-prices';

interface KPIProps {
    data: FuturesKpiDto;
    contract: string;
}

export default function FuturesAdvKPI({ data, contract }: KPIProps) {
    const formatPrice = (v: number) => v ? v.toFixed(2) : '-.--';

    // Determine Spread Status
    const getSpreadStatus = (change: number = 0) => {
        if (change > 0.5) return { label: 'Rosnący (Widening)', color: 'text-orange-400' };
        if (change < -0.5) return { label: 'Malejący (Narrowing)', color: 'text-blue-400' };
        return { label: 'Stabilny', color: 'text-gray-500' };
    };

    const spreadStatus = getSpreadStatus(data.spreadChange);

    // Determine sentiment color
    // If base price > yesterday (we assume trend calculation passed, but for now mocked green)
    const isBullish = true;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* BASE Card */}
            <div className="bg-[#1E293B] text-white p-5 rounded-xl shadow-sm border border-gray-700 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Activity size={48} className="text-[#009D8F]" />
                </div>
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">
                    BASE {contract}
                </div>
                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    {formatPrice(data.basePrice)} <span className="text-sm font-normal text-gray-500">PLN/MWh</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[#00C1B5] text-sm">
                    <TrendingUp size={16} />
                    <span>+1.5% vs Wczoraj</span>
                </div>
            </div>

            {/* PEAK Card */}
            <div className="bg-[#1E293B] text-white p-5 rounded-xl shadow-sm border border-gray-700 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Battery size={48} className="text-[#009D8F]" />
                </div>
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">
                    PEAK {contract.replace('BASE', 'PEAK')}
                </div>
                <div className="text-3xl font-bold text-white">
                    {formatPrice(data.peakPrice)} <span className="text-sm font-normal text-gray-500">PLN/MWh</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[#00C1B5] text-sm">
                    <TrendingUp size={16} />
                    <span>+0.8% vs Wczoraj</span>
                </div>
            </div>

            {/* SPREAD Card */}
            <div className="bg-[#1E293B] text-white p-5 rounded-xl shadow-sm border border-gray-700">
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">
                    Spread BASE/PEAK
                </div>
                <div className="text-3xl font-bold text-[#009D8F]">
                    {formatPrice(data.spread)} <span className="text-sm font-normal text-gray-500">PLN</span>
                </div>
                <div className="mt-2 w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#009D8F] h-full w-[60%]"></div>
                </div>
                <div className={`text-xs mt-1 text-center ${spreadStatus.color}`}>
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
                        {(data.volume / 1000).toFixed(1)}k <span className="text-sm text-gray-500">MWh</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        LOP: {data.openInterest}
                    </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[#00C1B5] text-sm justify-end">
                    <TrendingUp size={14} />
                    <span>Active</span>
                </div>
            </div>
        </div>
    )
}
