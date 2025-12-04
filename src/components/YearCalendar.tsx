import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';

interface YearCalendarProps {
    selectedDate: string;
    availableDates: string[];
    onDateSelect: (date: string) => void;
}

const MONTHS = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

const DAYS = ['p', 'w', 'ś', 'c', 'p', 's', 'n'];

const MONTH_NAMES_PL: { [key: string]: number } = {
    'styczeń': 0, 'luty': 1, 'marzec': 2, 'kwiecień': 3, 'maj': 4, 'czerwiec': 5,
    'lipiec': 6, 'sierpień': 7, 'wrzesień': 8, 'październik': 9, 'listopad': 10, 'grudzień': 11
};

const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    // Try standard parsing first
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;

    // Try parsing Polish format: "poniedziałek, 1 styczeń 2024"
    try {
        const parts = dateStr.split(' ');
        if (parts.length >= 4) {
            const day = parseInt(parts[1]);
            const monthStr = parts[2].toLowerCase();
            const year = parseInt(parts[3]);

            const month = MONTH_NAMES_PL[monthStr];
            if (month !== undefined && !isNaN(day) && !isNaN(year)) {
                return new Date(year, month, day);
            }
        }
    } catch (e) {
        console.warn('Failed to parse date:', dateStr);
    }

    return null;
};

type ViewMode = 'years' | 'months' | 'days';

export default function YearCalendar({ selectedDate, availableDates, onDateSelect }: YearCalendarProps) {
    // Parse initial date
    const initialDate = useMemo(() => {
        return parseDate(selectedDate) || (availableDates.length > 0 ? parseDate(availableDates[0]) : null) || new Date();
    }, [selectedDate, availableDates]);

    const [viewMode, setViewMode] = useState<ViewMode>('years');
    const [selectedYear, setSelectedYear] = useState<number>(initialDate.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(initialDate.getMonth());

    // Group available dates by year-month-day for O(1) lookup
    // Normalize all available dates to YYYY-MM-DD format
    const availableSet = useMemo(() => {
        const map = new Map<string, string>();
        availableDates.forEach(dateStr => {
            const date = parseDate(dateStr);
            if (date) {
                const normalized = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                map.set(normalized, dateStr); // Store original string with normalized key
            }
        });
        return map;
    }, [availableDates]);

    // Get available years
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        availableDates.forEach(dateStr => {
            const date = parseDate(dateStr);
            if (date) years.add(date.getFullYear());
        });
        return Array.from(years).sort((a, b) => b - a); // Descending
    }, [availableDates]);

    // Check if a month has any available dates
    const isMonthAvailable = (year: number, month: number) => {
        // This is a bit inefficient, iterating all dates. 
        // Better to have a pre-computed structure, but for < 1000 dates it's fine.
        // Optimization: check if any key in availableSet starts with YYYY-MM
        const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        for (const key of availableSet.keys()) {
            if (key.startsWith(prefix)) return true;
        }
        return false;
    };

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        // 0 = Sunday, 1 = Monday, ... 6 = Saturday
        // We want 0 = Monday, ... 6 = Sunday
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1;
    };

    // --- RENDERERS ---

    const renderYears = () => (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {availableYears.map(year => (
                <button
                    key={year}
                    onClick={() => {
                        setSelectedYear(year);
                        setViewMode('months');
                    }}
                    className={`
                        p-6 rounded-xl text-2xl font-light transition-all
                        ${year === selectedYear
                            ? 'bg-red-50 text-red-600 ring-2 ring-red-500'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}
                    `}
                >
                    {year}
                </button>
            ))}
        </div>
    );

    const renderMonths = () => (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {MONTHS.map((month, index) => {
                const available = isMonthAvailable(selectedYear, index);
                return (
                    <button
                        key={month}
                        onClick={() => {
                            if (available) {
                                setSelectedMonth(index);
                                setViewMode('days');
                            }
                        }}
                        disabled={!available}
                        className={`
                            p-6 rounded-xl text-lg font-medium transition-all
                            ${index === selectedMonth && selectedYear === initialDate.getFullYear() // Highlight if it matches current selection context
                                ? 'bg-red-50 text-red-600 ring-2 ring-red-500'
                                : available
                                    ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                    : 'bg-gray-50 text-gray-300 cursor-default'}
                        `}
                    >
                        {month}
                    </button>
                );
            })}
        </div>
    );

    const renderDays = () => {
        const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
        const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);
        const days = [];

        // Empty cells
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-10 w-10" />);
        }

        // Days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isAvailable = availableSet.has(dateStr);

            // Check if selected date matches
            const selected = parseDate(selectedDate);
            const isSelected = selected &&
                selected.getFullYear() === selectedYear &&
                selected.getMonth() === selectedMonth &&
                selected.getDate() === day;

            days.push(
                <button
                    key={day}
                    onClick={() => {
                        if (isAvailable) {
                            const originalDateStr = availableSet.get(dateStr);
                            if (originalDateStr) {
                                onDateSelect(originalDateStr);
                            }
                        }
                    }}
                    disabled={!isAvailable}
                    className={`
                        h-10 w-10 flex items-center justify-center text-sm rounded-full transition-all
                        ${isSelected
                            ? 'bg-red-500 text-white font-bold shadow-md scale-110'
                            : isAvailable
                                ? 'text-gray-900 hover:bg-gray-100 font-medium cursor-pointer'
                                : 'text-gray-300 cursor-default'}
                    `}
                >
                    {day}
                </button>
            );
        }

        return (
            <div className="max-w-md mx-auto">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-4">
                    {DAYS.map((d, i) => (
                        <div key={i} className="h-10 w-10 flex items-center justify-center text-sm text-gray-400 font-medium uppercase">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-y-2 place-items-center">
                    {days}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {/* Header Navigation */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    {viewMode !== 'years' && (
                        <button
                            onClick={() => setViewMode(viewMode === 'days' ? 'months' : 'years')}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors"
                        >
                            <ArrowLeft size={24} />
                        </button>
                    )}
                    <h2 className="text-3xl font-light text-gray-900">
                        {viewMode === 'years' && 'Wybierz Rok'}
                        {viewMode === 'months' && selectedYear}
                        {viewMode === 'days' && `${MONTHS[selectedMonth]} ${selectedYear}`}
                    </h2>
                </div>
            </div>

            {/* Content */}
            <div className="min-h-[300px]">
                {viewMode === 'years' && renderYears()}
                {viewMode === 'months' && renderMonths()}
                {viewMode === 'days' && renderDays()}
            </div>
        </div>
    );
}
