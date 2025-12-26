interface TickerItem {
    instrument: string;
    price: number;
    change: number;
    open: number;
    max: number;
    min: number;
    volume: number;
}

interface FuturesTickerProps {
    data: TickerItem[];
}

export default function FuturesTicker({ data }: FuturesTickerProps) {
    return (
        <div className="bg-[#111827] p-4 rounded-xl shadow-sm border border-gray-800 h-[330px] flex flex-col">
            <h3 className="text-white font-semibold mb-4">Tablica Notowań (Ticker Board)</h3>
            <div className="overflow-x-auto flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                <table className="w-full text-xs text-left text-gray-400">
                    <thead className="text-xs text-gray-500 uppercase bg-[#1f2937] sticky top-0 z-10 shadow-md border-b border-gray-800">
                        <tr>
                            <th className="px-3 py-3 rounded-tl-lg">Instrument</th>
                            <th className="px-3 py-3 text-right">Kurs Rozl.</th>
                            <th className="px-3 py-3 text-right">Zmiana</th>
                            <th className="px-3 py-3 text-right">Kurs Min.</th>
                            <th className="px-3 py-3 text-right rounded-tr-lg">Wolumen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {data.map((item) => (
                            <tr key={item.instrument} className="hover:bg-gray-800/50 transition-colors">
                                <td className="px-3 py-3 font-medium text-white">{item.instrument}</td>
                                <td className="px-3 py-3 text-right text-xs font-bold text-gray-200">
                                    {item.price.toFixed(2)}
                                </td>
                                <td className={`px-3 py-3 text-right font-medium ${item.change >= 0 ? 'text-[#00C1B5]' : 'text-red-400'}`}>
                                    {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                                </td>
                                <td className="px-3 py-3 text-right">{item.min?.toFixed(2) || '-'}</td>
                                <td className="px-3 py-3 text-right text-[#A78BFA] font-medium">{item.volume}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
