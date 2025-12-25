'use client';

function getColor(value: number, min: number, max: number) {
    // Normalize value between 0 and 1
    const ratio = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));

    // Green (low) -> Yellow (mid) -> Red (high)
    // Low: Mint (#009D8F) -> 0, 157, 143
    // Mid: Lime (#D2E603) -> 210, 230, 3
    // High: Orange (#F97316) -> 249, 115, 22

    if (ratio < 0.5) {
        // Mint to Lime
        const r = Math.round(0 + (210 - 0) * (ratio * 2));
        const g = Math.round(157 + (230 - 157) * (ratio * 2));
        const b = Math.round(143 + (3 - 143) * (ratio * 2));
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        // Lime to Orange
        const r = Math.round(210 + (249 - 210) * ((ratio - 0.5) * 2));
        const g = Math.round(230 + (115 - 230) * ((ratio - 0.5) * 2));
        const b = Math.round(3 + (22 - 3) * ((ratio - 0.5) * 2));
        return `rgb(${r}, ${g}, ${b})`;
    }
}

interface HeatmapData {
    days: string[]; // Labels for X axis (e.g., "01", "02"...)
    hours: number[]; // 0..23
    values: number[][]; // values[hourIndex][dayIndex] -> Price
}

export default function Rdn2Heatmap({ data }: { data: HeatmapData }) {
    // Flatten to find min/max
    const allValues = data.values.flat();
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-gray-900 text-lg font-semibold">Mapa Ciepła Cen (Ostatnie 14 Dni)</h2>
                {/* Legend */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Low</span>
                    <div className="w-24 h-2 rounded-full bg-gradient-to-r from-[#009D8F] via-[#D2E603] to-[#F97316]"></div>
                    <span>High</span>
                </div>
            </div>

            <div className="overflow-x-auto text-center">
                <div className="inline-block min-w-max">
                    {/* Grid Container */}
                    <div className="flex justify-center">
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: `30px repeat(${data.days.length}, 24px)`,
                            gap: '2px'
                        }}>
                            {/* Header Row (Days) */}
                            <div className="text-xs text-gray-500 font-mono"></div>
                            {data.days.map((day, i) => (
                                <div key={i} className="text-[10px] text-gray-500 text-center font-mono">
                                    {day}
                                </div>
                            ))}

                            {/* Rows (Hours) */}
                            {data.hours.map((hour, rowIdx) => (
                                <>
                                    {/* Y Axis Label */}
                                    <div key={`label-${hour}`} className="text-[10px] text-gray-400 font-mono flex items-center justify-end pr-2">
                                        {hour}
                                    </div>
                                    {/* Cells */}
                                    {data.days.map((_, colIdx) => {
                                        const value = data.values[rowIdx][colIdx];
                                        const color = getColor(value, minVal, maxVal);

                                        return (
                                            <div
                                                key={`${rowIdx}-${colIdx}`}
                                                className="h-6 rounded-[2px] transition-all hover:scale-110 hover:z-10 relative group cursor-default"
                                                style={{ backgroundColor: color }}
                                            >
                                                {/* Tooltip */}
                                                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 whitespace-nowrap bg-black text-white text-xs px-2 py-1 rounded pointer-events-none">
                                                    {value.toFixed(2)} PLN
                                                </div>
                                            </div>
                                        )
                                    })}
                                </>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-2 text-center text-xs text-gray-400">
                Oś X: Dni Miesiąca (Day) | Oś Y: Godziny Doby (Hour)
            </div>
        </div>
    );
}
