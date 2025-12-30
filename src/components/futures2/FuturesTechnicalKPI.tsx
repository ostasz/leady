import { TrendingUp, TrendingDown, Activity, AlertTriangle, Layers, BarChart2 } from 'lucide-react';

import { FuturesTechnicalDto } from '@/types/energy-prices';

interface TechnicalKPIProps {
    data: FuturesTechnicalDto;
    contract: string;
}

export default function FuturesTechnicalKPI({ data, contract }: TechnicalKPIProps) {
    const formatNumber = (v: number | null | undefined | string) => {
        if (v === null || v === undefined || v === '') return '-.--';
        const num = typeof v === 'number' ? v : Number(v);
        return isNaN(num) ? '-.--' : num.toFixed(2);
    };

    // RSI Config
    const rsiValue = data.rsi ?? 50;
    const rsiStatus = rsiValue > 70 ? 'WYKUPIONY' : (rsiValue < 30 ? 'WYPRZEDANY' : 'NEUTRALNY');

    const rsiColor = rsiValue > 70 ? 'text-red-400' : (rsiValue < 30 ? 'text-[#00C1B5]' : 'text-yellow-400');
    const rsiLabelColor = rsiValue > 70 ? 'text-red-500' : (rsiValue < 30 ? 'text-[#00C1B5]' : 'text-gray-500');

    // ATR Context
    const atrValue = data.atr ?? 0;
    const isVolatile = atrValue > 15;

    // Spread Config
    const spreadValue = data.calendarSpread ?? 0;
    // We don't have label in DTO, assuming Backend sends only numeric value for now. 
    // Ideally Backend should return object or we infer label. 
    // For now: value only.
    const isBackwardation = spreadValue > 0;

    // Trend Config
    let trendStatus = 'NEUTRAL';
    // DEFENSIVE CODING: Handle legacy/stale object data from cache
    if (typeof data.trend === 'object' && data.trend !== null) {
        const t = data.trend as any;
        if (t.diffPct > 5) trendStatus = 'BULLISH';
        else if (t.diffPct < -5) trendStatus = 'BEARISH';
    } else {
        trendStatus = data.trend || 'NEUTRAL';
    }

    const isBullish = trendStatus === 'BULLISH';
    const isBearish = trendStatus === 'BEARISH';
    const trendColor = isBullish ? 'text-[#00C1B5]' : (isBearish ? 'text-red-400' : 'text-gray-400');

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">

            {/* RSI Card */}
            <div className="bg-[#1E293B] border border-gray-700 p-5 rounded-xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Activity size={64} className="text-white" />
                </div>
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Activity size={14} className="text-[#009D8F]" />
                    RSI (14) - Momentum
                </div>
                <div className={`text-3xl font-bold ${rsiColor}`}>
                    {formatNumber(rsiValue)}
                </div>
                <div className={`text-sm mt-1 font-medium ${rsiLabelColor}`}>
                    {rsiStatus}
                </div>
                <div className="mt-4 w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${rsiValue > 70 ? 'bg-red-500' : (rsiValue < 30 ? 'bg-[#00C1B5]' : 'bg-yellow-500')}`}
                        style={{ width: `${Math.min(rsiValue, 100)}%` }}
                    ></div>
                </div>
            </div>

            {/* ATR Card */}
            <div className="bg-[#1E293B] border border-gray-700 p-5 rounded-xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <AlertTriangle size={64} className="text-white" />
                </div>
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-orange-400" />
                    ATR (14) - Ryzyko Zmienności
                </div>
                <div className="text-3xl font-bold text-white">
                    {formatNumber(atrValue)} <span className="text-sm font-normal text-gray-500">PLN</span>
                </div>
                <div className="text-sm mt-1 text-gray-500">
                    Średnia dzienna zmiana ceny
                </div>
                {isVolatile && (
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded text-orange-400 text-xs">
                        <AlertTriangle size={12} />
                        Podwyższona zmienność
                    </div>
                )}
            </div>

            {/* Calendar Spread Card */}
            <div className="bg-[#1E293B] border border-gray-700 p-5 rounded-xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Layers size={64} className="text-white" />
                </div>
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Layers size={14} className="text-purple-400" />
                    Calendar Spread (Y vs Y+1)
                </div>
                <div className={`text-3xl font-bold ${isBackwardation ? 'text-[#00C1B5]' : 'text-[#009D8F]'}`}>
                    {formatNumber(spreadValue)} <span className="text-sm font-normal text-gray-500">PLN</span>
                </div>
                <div className="text-sm mt-1 font-medium text-gray-500">
                    Struktura: <span className={isBackwardation ? 'text-[#00C1B5]' : 'text-[#009D8F]'}>{isBackwardation ? 'Backwardation' : 'Contango'}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {isBackwardation
                        ? 'Obecny rok droższy (Backwardation)'
                        : 'Przyszły rok droższy (Contango)'}
                </div>
            </div>

            {/* Trend Strength Card */}
            <div className="bg-[#1E293B] border border-gray-700 p-5 rounded-xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <BarChart2 size={64} className="text-white" />
                </div>
                <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
                    <BarChart2 size={14} className="text-teal-400" />
                    Siła Trendu (vs SMA50)
                </div>
                <div className={`text-3xl font-bold ${trendColor}`}>
                    {trendStatus === 'NEUTRAL' ? 'NEUTRALNY' : trendStatus}
                </div>
                <div className="text-sm mt-1 font-medium text-gray-500">
                    Stan: <span className={trendColor}>{trendStatus}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    {/* SMA50 not calculated in frontend anymore, handled via Trend ENUM */}
                    Analiza Trendu
                </div>
                <div className="mt-3 w-full bg-gray-700 h-1.5 rounded-full overflow-hidden flex">
                    <div className="w-1/2 h-full border-r border-gray-600 bg-transparent"></div>
                </div>
            </div>

        </div>
    );
}
