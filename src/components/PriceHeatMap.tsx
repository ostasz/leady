'use client';

import { getPriceColor, SHIFT_OPTIONS } from '@/types/energy-prices';

interface PriceHeatMapProps {
    data: { dayOfWeek: number; name: string; prices: number[] }[];
    overallAverage: number;
    selectedShiftId?: string;
    weekendMode?: 'none' | 'saturday' | 'full_weekend';
}

export default function PriceHeatMap({
    data,
    overallAverage,
    selectedShiftId,
    weekendMode = 'none'
}: PriceHeatMapProps) {
    const hours = Array.from({ length: 24 }, (_, i) => i + 1);

    // Helper to check if a cell is active in the current profile
    const isCellActive = (dayOfWeek: number, hour: number) => {
        if (!selectedShiftId) return true; // Show all if no profile selected

        const selectedShift = SHIFT_OPTIONS.find(s => s.id === selectedShiftId);
        if (!selectedShift) return true;

        const isSaturday = dayOfWeek === 6;
        const isSunday = dayOfWeek === 0;
        const isWeekend = isSaturday || isSunday;

        // Check weekend mode
        if (isWeekend) {
            if (weekendMode === 'none') return false;
            if (weekendMode === 'saturday' && !isSaturday) return false;
            // if full_weekend, include both
        }

        // Check shift hours
        if (selectedShift.type === '24/7') return true;

        return hour >= selectedShift.startHour && hour < selectedShift.endHour;
    };

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[800px]">
                {/* Header Row */}
                <div className="flex mb-2">
                    <div className="w-24 flex-shrink-0"></div>
                    <div className="flex-1 grid grid-cols-24 gap-1">
                        {hours.map(hour => (
                            <div key={hour} className="text-center text-xs text-gray-400">
                                {hour}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Data Rows */}
                <div className="space-y-1">
                    {data.map((day, dayIndex) => (
                        <div key={day.dayOfWeek} className={`flex ${day.dayOfWeek === 6 ? 'mt-4' : ''}`}>
                            <div className="w-24 flex-shrink-0 flex items-center text-xs font-medium text-gray-500">
                                {day.name}
                            </div>
                            <div className="flex-1 grid grid-cols-24 gap-1">
                                {day.prices.map((price, hourIndex) => {
                                    const hour = hourIndex + 1;
                                    const color = getPriceColor(price, overallAverage);
                                    const isActive = isCellActive(day.dayOfWeek, hour);

                                    return (
                                        <div
                                            key={hour}
                                            className={`
                                                h-8 rounded-sm transition-all duration-200 relative group
                                                ${isActive ? 'opacity-100' : 'opacity-10 grayscale'}
                                            `}
                                            style={{ backgroundColor: color }}
                                        >
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                                <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg">
                                                    <div className="font-semibold mb-1">{day.name}, godz. {hour}:00</div>
                                                    <div>Cena: {price.toFixed(2)} PLN</div>
                                                    <div className="text-gray-400 text-[10px] mt-1">
                                                        {(price / overallAverage * 100).toFixed(0)}% średniej
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Legend */}
                <div className="mt-6 flex justify-center items-center gap-6 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span>Bardzo tanio</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>Tanio</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span>Średnio</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span>Drogo</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span>Bardzo drogo</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
