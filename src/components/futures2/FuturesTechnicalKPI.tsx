import { TrendingUp, TrendingDown, Activity, AlertTriangle, Layers, BarChart2 } from 'lucide-react';

interface TechnicalKPIProps {
    data: {
        rsi: { value: number; status: string };
        atr: { value: number };
        calendarSpread: { value: number; label: string };
        trend?: { sma50: number; diffPct: number; status: string };
    };
    contract: string;
}

export default function FuturesTechnicalKPI({ data, contract }: TechnicalKPIProps) {
    const formatNumber = (v: number) => v ? v.toFixed(2) : '-.--';

    // RSI Config
    const rsiColor = data.rsi.value > 70 ? 'text-red-400' : (data.rsi.value < 30 ? 'text-[#00C1B5]' : 'text-yellow-400');
    const rsiLabelColor = data.rsi.value > 70 ? 'text-red-500' : (data.rsi.value < 30 ? 'text-[#00C1B5]' : 'text-gray-500');

    // ATR Context
    const isVolatile = data.atr.value > 15;

    // Spread Config
    const isBackwardation = data.calendarSpread.value > 0;

    // Trend Config
    const trend = data.trend || { sma50: 0, diffPct: 0, status: 'N/A' };
    const isBullish = trend.diffPct > 5;
    const isBearish = trend.diffPct < -5;
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
                    {formatNumber(data.rsi.value)}
                </div>
                <div className={`text-sm mt-1 font-medium ${rsiLabelColor}`}>
                    {data.rsi.status}
                </div>
                <div className="mt-4 w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${data.rsi.value > 70 ? 'bg-red-500' : (data.rsi.value < 30 ? 'bg-[#00C1B5]' : 'bg-yellow-500')}`}
                        style={{ width: `${Math.min(data.rsi.value, 100)}%` }}
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
                    {formatNumber(data.atr.value)} <span className="text-sm font-normal text-gray-500">PLN</span>
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
                    {formatNumber(data.calendarSpread.value)} <span className="text-sm font-normal text-gray-500">PLN</span>
                </div>
                <div className="text-sm mt-1 font-medium text-gray-500">
                    Struktura: <span className={isBackwardation ? 'text-[#00C1B5]' : 'text-[#009D8F]'}>{data.calendarSpread.label}</span>
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
                    {trend.diffPct > 0 ? '+' : ''}{formatNumber(trend.diffPct)}%
                </div>
                <div className="text-sm mt-1 font-medium text-gray-500">
                    Stan: <span className={trendColor}>{trend.status}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    SMA50: {formatNumber(trend.sma50)} PLN
                </div>
                <div className="mt-3 w-full bg-gray-700 h-1.5 rounded-full overflow-hidden flex">
                    <div className="w-1/2 h-full border-r border-gray-600 bg-transparent"></div>
                </div>
            </div>

        </div>
    );
}
