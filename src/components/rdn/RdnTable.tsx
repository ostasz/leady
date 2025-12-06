'use client';

import { Download } from 'lucide-react';

interface PriceData {
    date: string;
    price: number;
}

interface TableProps {
    data: PriceData[];
}

export default function RdnTable({ data }: TableProps) {
    // Sort Descending for table (newest first)
    const rows = [...data].sort((a, b) => b.date.localeCompare(a.date));

    const downloadCSV = () => {
        const headers = ['Data', 'TGe24 (PLN/MWh)'];
        const csvContent = [
            headers.join(','),
            ...rows.map(row => `${row.date},${row.price}`)
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'notowania_rdn.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur">
                <h3 className="text-lg font-bold text-white">Historia Notowań</h3>
                <button
                    onClick={downloadCSV}
                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm transition-colors border border-gray-700"
                >
                    <Download size={16} />
                    Eksportuj CSV
                </button>
            </div>

            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-800/80 sticky top-0 z-10 backdrop-blur-sm">
                        <tr>
                            <th className="p-3 text-xs uppercase tracking-wider text-gray-400 font-medium">Data</th>
                            <th className="p-3 text-xs uppercase tracking-wider text-emerald-400 font-medium text-right">Cena (PLN/MWh)</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {rows.map((row) => (
                            <tr key={row.date} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                                <td className="p-3 text-gray-300 font-mono">{row.date}</td>
                                <td className="p-3 text-right font-medium text-white">
                                    {row.price.toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
