import { ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

import { FuturesHistoryPoint } from '@/types/energy-prices';

interface FuturesCandleChartProps {
    data: FuturesHistoryPoint[];
    contract: string;
}

// Calculate SMA
const calculateSMA = (data: any[], window: number) => {
    return data.map((entry, index) => {
        if (index < window - 1) return { ...entry, [`sma${window}`]: null };
        const slice = data.slice(index - window + 1, index + 1);
        const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
        return { ...entry, [`sma${window}`]: sum / window };
    });
};

export default function FuturesCandleChart({ data, contract }: FuturesCandleChartProps) {
    if (!data || data.length === 0) return <div className="h-96 flex items-center justify-center text-gray-400">Brak danych do wykresu</div>;

    // Enhance data with candle ranges and SMA
    let processedData = data.map(d => {
        const open = d.open ?? d.close;
        const high = d.high ?? d.close;
        const low = d.low ?? d.close;

        return {
            ...d,
            // Recharts floating bar expects [min, max]
            candleBody: [Math.min(open, d.close), Math.max(open, d.close)],
            // Wick is [low, high]
            candleWick: [low, high],
            isBullish: d.close >= open,
            // Ensure fields exist for tooltip
            open, high, low
        };
    });

    processedData = calculateSMA(processedData, 15);
    processedData = calculateSMA(processedData, 50);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            return (
                <div className="bg-[#0f172a] text-white p-3 rounded-lg shadow-lg border border-gray-700 text-xs">
                    <div className="font-bold mb-2 text-gray-200 border-b border-gray-700 pb-1">{format(parseISO(d.date), 'dd MMM yyyy')}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-gray-400">Otwarcie:</span> <span>{d.open.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="text-gray-400">Max:</span> <span>{d.high.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="text-gray-400">Min:</span> <span>{d.low.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="text-gray-400">Zamknięcie:</span> <span className={d.isBullish ? 'text-[#00C1B5]' : 'text-red-400'}>{d.close.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        {d.sma15 && (
                            <>
                                <span className="text-gray-400">SMA15:</span> <span className="text-blue-400">{d.sma15.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </>
                        )}
                        {d.sma50 && (
                            <>
                                <span className="text-gray-400">SMA50:</span> <span className="text-yellow-500">{d.sma50.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </>
                        )}
                        <span className="text-gray-400 mt-2">Wolumen:</span> <span className="mt-2 text-purple-400">{d.volume?.toLocaleString('pl-PL', { maximumFractionDigits: 0 }) ?? '-'}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-[#111827] p-4 rounded-xl shadow-sm border border-gray-800">
            <div className="mb-4 flex justify-between items-center">
                <h3 className="text-white font-semibold">Wykres Świecowy Kontraktu ({contract})</h3>
                <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-gray-400"></div>
                        <span className="text-gray-400">DKR</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-blue-500"></div>
                        <span className="text-gray-400">SMA15</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-0.5 bg-yellow-600"></div>
                        <span className="text-gray-400">SMA50</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col w-full h-[550px]">
                {/* Price Chart (Top) */}
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={processedData}
                            margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                            syncId="futures-sync"
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(str) => format(parseISO(str), 'd MMM', { locale: pl })}
                                stroke="#4b5563"
                                tick={false} // Hide labels on top chart
                                height={2}
                                minTickGap={30}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                orientation="right"
                                stroke="#4b5563"
                                tick={{ fill: '#9ca3af', fontSize: 11 }}
                                width={60}
                            />
                            <Tooltip content={<CustomTooltip />} />

                            {/* Candles & Lines */}
                            <Line type="monotone" dataKey="sma15" stroke="#3b82f6" dot={false} strokeWidth={2} />
                            <Line type="monotone" dataKey="sma50" stroke="#ca8a04" dot={false} strokeWidth={2} />
                            <Line type="monotone" dataKey="close" stroke="#94a3b8" dot={false} strokeWidth={2} strokeOpacity={0.7} activeDot={{ r: 4 }} />

                            <Bar dataKey="candleWick" barSize={1} fillOpacity={1}>
                                {processedData.map((entry, index) => (
                                    <Cell key={`wick-${index}`} fill={entry.isBullish ? '#00C1B5' : '#ef4444'} />
                                ))}
                            </Bar>
                            <Bar dataKey="candleBody" barSize={10}>
                                {processedData.map((entry, index) => (
                                    <Cell key={`body-${index}`} fill={entry.isBullish ? '#00C1B5' : '#ef4444'} />
                                ))}
                            </Bar>
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* Volume Chart (Bottom) */}
                <div className="h-[120px] mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={processedData}
                            margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                            syncId="futures-sync"
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(str) => format(parseISO(str), 'd MMM', { locale: pl })}
                                stroke="#4b5563"
                                tick={{ fill: '#9ca3af', fontSize: 11 }}
                                minTickGap={30}
                            />
                            <YAxis
                                orientation="right"
                                stroke="#4b5563"
                                tickFormatter={(val) => (val / 1000).toFixed(0) + 'k'} // Shorten volume labels
                                tick={{ fill: '#9ca3af', fontSize: 10 }}
                                width={60}
                            />
                            <Bar dataKey="volume" fill="#4c1d95" opacity={0.6} barSize={4} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
