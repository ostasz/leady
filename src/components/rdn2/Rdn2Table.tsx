'use client';

interface TableData {
    hour: string;
    price: number;
    change: number; // Percentage
    volume: number;
}

export default function Rdn2Table({ data }: { data: TableData[] }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-gray-200">
                <h2 className="text-gray-900 text-lg font-semibold">Tabela Szczegółowa - Godzina po Godzinie</h2>
            </div>

            <div className="flex-1">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                        <tr>
                            <th className="p-2 text-gray-500 text-[10px] font-semibold uppercase">Godzina</th>
                            <th className="p-2 text-gray-500 text-[10px] font-semibold uppercase text-right">Cena (PLN/MWh)</th>
                            <th className="p-2 text-gray-500 text-[10px] font-semibold uppercase text-right">Zmiana % (d/d)</th>
                            <th className="p-2 text-gray-500 text-[10px] font-semibold uppercase text-right">Wolumen (MWh)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="py-1 px-2 text-gray-600 text-xs font-medium border-r border-gray-100">{row.hour}:00</td>
                                <td className="py-1 px-2 text-gray-900 text-xs font-bold text-right tabular-nums">{row.price.toFixed(2)}</td>
                                <td className={`py-1 px-2 text-xs text-right tabular-nums font-medium ${row.change >= 0 ? 'text-[#009D8F]' : 'text-[#F97316]'}`}>
                                    {row.change > 0 ? '+' : ''}{row.change.toFixed(2)}%
                                </td>
                                <td className="py-1 px-2 text-gray-500 text-xs text-right tabular-nums">{row.volume.toFixed(1)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
