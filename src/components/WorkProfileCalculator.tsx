'use client';

import { useMemo } from 'react';
import { SHIFT_OPTIONS, ShiftOption } from '@/types/energy-prices';

interface WorkProfileCalculatorProps {
    weeklyProfile: { dayOfWeek: number; name: string; prices: number[] }[];
    overallAverage: number;
    selectedShiftId: string;
    onShiftChange: (id: string) => void;
    weekendMode: 'none' | 'saturday' | 'full_weekend';
    onWeekendModeChange: (mode: 'none' | 'saturday' | 'full_weekend') => void;
}

export default function WorkProfileCalculator({
    weeklyProfile,
    overallAverage,
    selectedShiftId,
    onShiftChange,
    weekendMode,
    onWeekendModeChange
}: WorkProfileCalculatorProps) {

    const result = useMemo(() => {
        if (!weeklyProfile.length) return 0;

        const selectedShift = SHIFT_OPTIONS.find(s => s.id === selectedShiftId);
        if (!selectedShift) return 0;

        // If 24/7 and full weekend is included, return the precise overall average
        if (selectedShift.type === '24/7' && weekendMode === 'full_weekend') {
            return overallAverage + 100;
        }

        let totalSum = 0;
        let totalCount = 0;

        weeklyProfile.forEach(day => {
            // Check if this day should be included
            const isSaturday = day.dayOfWeek === 6;
            const isSunday = day.dayOfWeek === 0;
            const isWeekend = isSaturday || isSunday;

            if (isWeekend) {
                if (weekendMode === 'none') return;
                if (weekendMode === 'saturday' && !isSaturday) return;
                // if full_weekend, include both (no return)
            }

            // Iterate through hours
            day.prices.forEach((price, index) => {
                const hour = index + 1; // 1-24

                // Check if hour is within shift
                // Handle 24/7 simply
                if (selectedShift.type === '24/7') {
                    totalSum += price;
                    totalCount++;
                    return;
                }

                // Handle standard ranges
                if (hour >= selectedShift.startHour && hour < selectedShift.endHour) {
                    totalSum += price;
                    totalCount++;
                }
            });
        });

        return (totalCount > 0 ? totalSum / totalCount : 0) + 100;
    }, [weeklyProfile, selectedShiftId, weekendMode, overallAverage]);

    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
                Kalkulator profilu
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Controls */}
                <div className="space-y-6">
                    {/* Shift Selection */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Wybierz system pracy:</h3>
                        <div className="space-y-4">
                            {/* 1-Shift Group */}
                            <div>
                                <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Praca jednozmianowa</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {SHIFT_OPTIONS.filter(s => s.type === '1s').map(option => (
                                        <label key={option.id} className={`
                                            flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all
                                            ${selectedShiftId === option.id
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-medium'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-700'}
                                        `}>
                                            <input
                                                type="radio"
                                                name="shift"
                                                value={option.id}
                                                checked={selectedShiftId === option.id}
                                                onChange={(e) => onShiftChange(e.target.value)}
                                                className="sr-only"
                                            />
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* 2-Shifts Group */}
                            <div>
                                <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Praca dwuzmianowa</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {SHIFT_OPTIONS.filter(s => s.type === '2s').map(option => (
                                        <label key={option.id} className={`
                                            flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all
                                            ${selectedShiftId === option.id
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-medium'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-700'}
                                        `}>
                                            <input
                                                type="radio"
                                                name="shift"
                                                value={option.id}
                                                checked={selectedShiftId === option.id}
                                                onChange={(e) => onShiftChange(e.target.value)}
                                                className="sr-only"
                                            />
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* 24/7 Group */}
                            <div>
                                <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Praca ciągła</div>
                                <div className="grid grid-cols-1">
                                    {SHIFT_OPTIONS.filter(s => s.type === '24/7').map(option => (
                                        <label key={option.id} className={`
                                            flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all
                                            ${selectedShiftId === option.id
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-medium'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-700'}
                                        `}>
                                            <input
                                                type="radio"
                                                name="shift"
                                                value={option.id}
                                                checked={selectedShiftId === option.id}
                                                onChange={(e) => onShiftChange(e.target.value)}
                                                className="sr-only"
                                            />
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Weekend Options */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Praca w weekendy:</h3>
                        <div className="flex flex-col gap-2">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="weekend"
                                    value="none"
                                    checked={weekendMode === 'none'}
                                    onChange={() => onWeekendModeChange('none')}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Bez weekendów</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="weekend"
                                    value="saturday"
                                    checked={weekendMode === 'saturday'}
                                    onChange={() => onWeekendModeChange('saturday')}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Praca w sobotę</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="weekend"
                                    value="full_weekend"
                                    checked={weekendMode === 'full_weekend'}
                                    onChange={() => onWeekendModeChange('full_weekend')}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Praca w sobotę i niedzielę</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Result Display */}
                <div className="flex flex-col justify-center items-center bg-gray-50 rounded-xl p-8 border border-gray-100">
                    <div className="text-center">
                        <p className="text-sm text-gray-500 mb-2 uppercase tracking-wide font-semibold">Średnia cena dla Twojego profilu</p>
                        <div className="text-4xl font-bold text-indigo-600 mb-2">
                            {result.toFixed(2)} <span className="text-xl text-gray-500 font-normal">PLN/MWh</span>
                        </div>
                        <p className="text-xs text-gray-400 max-w-xs mx-auto">
                            Obliczona na podstawie średnich cen z wybranego okresu historycznego dla zaznaczonych godzin i dni pracy.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
