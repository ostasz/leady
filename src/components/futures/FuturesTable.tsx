'use client';

import { Download } from 'lucide-react';

interface FutureData {
    date: string;
    price: number;
}

interface TableProps {
    dataY1: FutureData[]; // Base 2026
    dataY2: FutureData[]; // Base 2027
    year1: string;
    year2: string;
}

export default function FuturesTable({ dataY1, dataY2, year1, year2 }: TableProps) {
    // Merge data similarly to chart
    const dateMap = new Map<string, { date: string; p1?: number; p2?: number }>();

    [...dataY1, ...dataY2].forEach(d => {
        if (!dateMap.has(d.date)) {
            dateMap.set(d.date, { date: d.date });
        }
    });

    dataY1.forEach(d => {
        if (dateMap.has(d.date)) dateMap.get(d.date)!.p1 = d.price;
    });
    dataY2.forEach(d => {
        if (dateMap.has(d.date)) dateMap.get(d.date)!.p2 = d.price;
    });

    // Sort Descending for table (newest first)
    const rows = Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    const downloadCSV = () => {
        const headers = ['Data', `BASE ${year1} (PLN)`, `BASE ${year2} (PLN)`];
        const csvContent = [
            headers.join(','),
            ...rows.map(row => `${row.date},${row.p1 || ''},${row.p2 || ''}`)
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'notowania_futures.csv');
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
                            <th className="p-3 text-xs uppercase tracking-wider text-cyan-400 font-medium text-right">BASE {year1}</th>
                            <th className="p-3 text-xs uppercase tracking-wider text-violet-400 font-medium text-right">BASE {year2}</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {rows.map((row) => (
                            <tr key={row.date} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                                <td className="p-3 text-gray-300 font-mono">{row.date}</td>
                                <td className="p-3 text-right font-medium text-white">
                                    {row.p1 ? row.p1.toFixed(2) : '-'}
                                </td>
                                <td className="p-3 text-right font-medium text-white">
                                    {row.p2 ? row.p2.toFixed(2) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
