/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { EnergyPriceEntry, DailyPriceSummary, groupPricesByDate, calculateDailySummary } from '@/types/energy-prices';
import Link from 'next/link';
import PriceHistoryChart from '@/components/PriceHistoryChart';
import AverageHourlyProfileChart from '@/components/AverageHourlyProfileChart';
import PriceHeatMap from '@/components/PriceHeatMap';
import WorkProfileCalculator from '@/components/WorkProfileCalculator';

// Quarter type definition
type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

interface QuarterInfo {
    quarter: Quarter;
    year: number;
    isComplete: boolean;
    startMonth: number;
    endMonth: number;
}

export default function FlixDashboard() {
    const { user, userData, loading: authLoading, getAuthHeaders } = useAuth();
    const router = useRouter();

    // Quarter selection state
    const [selectedQuarters, setSelectedQuarters] = useState<Quarter[]>(['Q2', 'Q3']);

    // Data state
    const [prices, setPrices] = useState<EnergyPriceEntry[]>([]);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [dailySummary, setDailySummary] = useState<DailyPriceSummary | null>(null);
    const [historyData, setHistoryData] = useState<{ date: string; avgPrice: number }[]>([]);
    const [hourlyProfile, setHourlyProfile] = useState<{ hour: number; price: number }[]>([]);
    const [weeklyProfile, setWeeklyProfile] = useState<{ dayOfWeek: number; name: string; prices: number[] }[]>([]);
    const [overallAverage, setOverallAverage] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Work Profile State (lifted for sharing)
    const [selectedShiftId, setSelectedShiftId] = useState<string>('1s-8-16');
    const [weekendMode, setWeekendMode] = useState<'none' | 'saturday' | 'full_weekend'>('none');
    const [customStartHour, setCustomStartHour] = useState<number>(8);
    const [customEndHour, setCustomEndHour] = useState<number>(16);

    // Calculate quarter information based on current date
    const getQuarterInfo = (quarter: Quarter): QuarterInfo => {
        const now = new Date(); // Use actual current date
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12

        const quarterMonths: Record<Quarter, { start: number; end: number }> = {
            'Q1': { start: 1, end: 3 },
            'Q2': { start: 4, end: 6 },
            'Q3': { start: 7, end: 9 },
            'Q4': { start: 10, end: 12 }
        };

        const { start, end } = quarterMonths[quarter];

        // Check if quarter is complete
        // A quarter is complete if we're past its last month
        const isComplete = currentMonth > end;

        // Use current year if complete, otherwise use previous year
        const year = isComplete ? currentYear : currentYear - 1;

        return {
            quarter,
            year,
            isComplete,
            startMonth: start,
            endMonth: end
        };
    };

    // Get all quarter info for display
    const quarterInfoMap = useMemo(() => {
        const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
        return quarters.reduce((acc, q) => {
            acc[q] = getQuarterInfo(q);
            return acc;
        }, {} as Record<Quarter, QuarterInfo>);
    }, []);

    // Filter dates based on selected quarters
    const getDateRangeForQuarters = (quarters: Quarter[]): { startDate: string; endDate: string } | null => {
        if (quarters.length === 0) return null;

        const quarterInfos = quarters.map(q => quarterInfoMap[q]);

        // Find the earliest start and latest end
        const minYear = Math.min(...quarterInfos.map(qi => qi.year));
        const maxYear = Math.max(...quarterInfos.map(qi => qi.year));

        const minMonth = Math.min(...quarterInfos.filter(qi => qi.year === minYear).map(qi => qi.startMonth));
        const maxMonth = Math.max(...quarterInfos.filter(qi => qi.year === maxYear).map(qi => qi.endMonth));

        const startDate = `${minYear}-${String(minMonth).padStart(2, '0')}-01`;
        const endDate = `${maxYear}-${String(maxMonth).padStart(2, '0')}-${new Date(maxYear, maxMonth, 0).getDate()}`;

        return { startDate, endDate };
    };

    // Toggle quarter selection
    const toggleQuarter = (quarter: Quarter) => {
        setSelectedQuarters(prev => {
            if (prev.includes(quarter)) {
                // Don't allow deselecting all quarters
                if (prev.length === 1) return prev;
                return prev.filter(q => q !== quarter);
            } else {
                return [...prev, quarter].sort();
            }
        });
    };

    // Auth guard
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Fetch data based on selected quarters
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                const headers = await getAuthHeaders();

                // Group quarters by year
                const quartersByYear = new Map<number, Quarter[]>();
                selectedQuarters.forEach(q => {
                    const qInfo = quarterInfoMap[q];
                    if (!quartersByYear.has(qInfo.year)) {
                        quartersByYear.set(qInfo.year, []);
                    }
                    quartersByYear.get(qInfo.year)!.push(q);
                });

                // Fetch data for each year separately and merge
                const allHistory: { date: string; avgPrice: number }[] = [];
                let mergedHourlyProfile: { hour: number; sum: number; count: number }[] = Array.from({ length: 24 }, (_, i) => ({
                    hour: i + 1,
                    sum: 0,
                    count: 0
                }));
                let mergedWeeklyProfile: { dayOfWeek: number; name: string; hourlyData: { sum: number; count: number }[] }[] = [];
                let totalSum = 0;
                let totalCount = 0;

                // Initialize weekly profile structure
                const daysOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
                const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
                mergedWeeklyProfile = daysOrder.map(dayOfWeek => ({
                    dayOfWeek,
                    name: dayNames[dayOfWeek],
                    hourlyData: Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }))
                }));

                for (const [year, quarters] of quartersByYear.entries()) {
                    const quartersParam = quarters.join(',');
                    const response = await fetch(
                        `/api/energy-prices/quarters?quarters=${quartersParam}&year=${year}`,
                        { headers, cache: 'no-store' }
                    );

                    if (!response.ok) {
                        throw new Error(`Failed to fetch data for ${year}`);
                    }

                    const data = await response.json();

                    // Merge history
                    if (data.history) {
                        allHistory.push(...data.history);
                    }

                    // Merge hourly profile
                    if (data.hourlyProfile) {
                        data.hourlyProfile.forEach((item: { hour: number; price: number }) => {
                            const hourData = mergedHourlyProfile[item.hour - 1];
                            // We need to back-calculate sum from average
                            // Since we don't have count from API, we'll use a weighted approach
                            hourData.sum += item.price;
                            hourData.count += 1;
                        });
                    }

                    // Merge weekly profile
                    if (data.weeklyProfile) {
                        data.weeklyProfile.forEach((dayData: { dayOfWeek: number; prices: number[] }) => {
                            const dayIndex = daysOrder.indexOf(dayData.dayOfWeek);
                            if (dayIndex >= 0) {
                                dayData.prices.forEach((price, hourIndex) => {
                                    const hourData = mergedWeeklyProfile[dayIndex].hourlyData[hourIndex];
                                    hourData.sum += price;
                                    hourData.count += 1;
                                });
                            }
                        });
                    }

                    // Track overall sum and count
                    if (data.history) {
                        data.history.forEach((item: { avgPrice: number }) => {
                            totalSum += item.avgPrice;
                            totalCount += 1;
                        });
                    }
                }

                // Sort and set history
                allHistory.sort((a, b) => a.date.localeCompare(b.date));
                setHistoryData(allHistory);

                const dates = allHistory.map(item => item.date);
                const uniqueDates = Array.from(new Set(dates)).sort().reverse();
                setAvailableDates(uniqueDates as string[]);

                if (uniqueDates.length > 0 && !selectedDate) {
                    setSelectedDate(uniqueDates[0] as string);
                }

                // Calculate final averages for hourly profile
                const finalHourlyProfile = mergedHourlyProfile.map(item => ({
                    hour: item.hour,
                    price: item.count > 0 ? Math.round((item.sum / item.count) * 100) / 100 : 0
                }));
                setHourlyProfile(finalHourlyProfile);

                // Calculate final averages for weekly profile
                const finalWeeklyProfile = mergedWeeklyProfile.map(day => ({
                    dayOfWeek: day.dayOfWeek,
                    name: day.name,
                    prices: day.hourlyData.map(hourData =>
                        hourData.count > 0 ? Math.round((hourData.sum / hourData.count) * 100) / 100 : 0
                    )
                }));
                setWeeklyProfile(finalWeeklyProfile);

                // Calculate overall average
                const overallAvg = totalCount > 0 ? Math.round((totalSum / totalCount) * 100) / 100 : 0;
                setOverallAverage(overallAvg);

                setError('');
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Błąd podczas pobierania danych');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, getAuthHeaders, selectedQuarters]);

    // Fetch prices for selected date
    useEffect(() => {
        if (!user || !selectedDate) return;

        const fetchPrices = async () => {
            try {
                const headers = await getAuthHeaders();
                const response = await fetch(`/api/energy-prices?date=${encodeURIComponent(selectedDate)}`, {
                    headers,
                    cache: 'no-store'
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch prices');
                }

                const data = await response.json();
                setPrices(data.prices || []);

                const summary = calculateDailySummary(data.prices || []);
                setDailySummary(summary);

                setError('');
            } catch (err: any) {
                setError(err.message || 'Failed to load data');
            }
        };

        fetchPrices();
    }, [selectedDate, user, getAuthHeaders]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00BFA5]"></div>
            </div>
        );
    }

    if (!user) return null;

    const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-[#00BFA5] transition-colors" title="Wróć do Portalu">
                            <img src="/home-icon.jpg" alt="Home" className="w-[37px] h-[37px] object-contain" />
                        </Link>
                        <h1 className="text-xl font-semibold text-gray-900">
                            Obliczanie kosztu energii FLIX
                        </h1>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                        {error}
                    </div>
                )}

                {/* Quarter Selector */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Wybierz kwartały do analizy
                        </h2>
                        <div className="text-sm text-gray-500">
                            Wybrano: {selectedQuarters.length} {selectedQuarters.length === 1 ? 'kwartał' : selectedQuarters.length < 5 ? 'kwartały' : 'kwartałów'}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {quarters.map((quarter) => {
                            const info = quarterInfoMap[quarter];
                            const isSelected = selectedQuarters.includes(quarter);

                            return (
                                <button
                                    key={quarter}
                                    onClick={() => toggleQuarter(quarter)}
                                    className={`
                                        relative p-4 rounded-lg border-2 transition-all duration-200
                                        ${isSelected
                                            ? 'border-[#00BFA5] bg-[#C5FAEA] shadow-md'
                                            : 'border-gray-200 bg-white hover:border-[#00BFA5]/50 hover:bg-[#C5FAEA]/50'
                                        }
                                    `}
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <div className={`text-2xl font-bold ${isSelected ? 'text-[#008B7A]' : 'text-gray-700'}`}>
                                            {quarter}
                                        </div>
                                        <div className={`text-xs font-medium ${isSelected ? 'text-[#007A6A]' : 'text-gray-500'}`}>
                                            {info.startMonth}.{String(info.year).slice(2)} - {info.endMonth}.{String(info.year).slice(2)}
                                        </div>
                                        <div className={`
                                            text-xs px-2 py-1 rounded-full font-medium
                                            ${info.isComplete
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-amber-100 text-amber-700'
                                            }
                                        `}>
                                            Dane z: {info.year}
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <div className="absolute top-2 right-2">
                                            <svg className="w-5 h-5 text-[#00BFA5]" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-4 p-3 bg-[#C5FAEA]/30 rounded-lg border border-[#00BFA5]/30">
                        <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-[#00BFA5] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div className="text-sm text-[#00695C]">
                                <strong>Logika kwartałów:</strong> System automatycznie używa danych z ukończonych kwartałów.
                                Jeśli kwartał w bieżącym roku nie jest jeszcze zakończony, używane są dane z poprzedniego roku.
                            </div>
                        </div>
                    </div>
                </div>

                {/* History Chart Section */}
                {historyData.length > 0 && (
                    <div className="flex flex-col gap-8 mb-8">
                        {/* Trend Chart */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Trend średnich cen dla wybranych kwartałów
                                </h2>
                                <div className="flex gap-2 items-center">
                                    <div className="text-sm text-gray-600">
                                        {selectedQuarters.map(q => quarterInfoMap[q].year).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                                    </div>
                                </div>
                            </div>
                            <PriceHistoryChart
                                data={historyData}
                                onDateSelect={setSelectedDate}
                                selectedDate={selectedDate}
                                overallAverage={overallAverage}
                            />
                            <p className="text-sm text-gray-500 mt-4 text-center">
                                Kliknij na punkt na wykresie, aby zobaczyć szczegóły dla danego dnia.
                            </p>
                        </div>

                        {/* Hourly Profile Chart */}
                        {hourlyProfile.length > 0 && (
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-900 mb-6">
                                    Typowy profil dnia (średnia z wybranych kwartałów)
                                </h2>
                                <AverageHourlyProfileChart
                                    data={hourlyProfile}
                                    overallAverage={overallAverage}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Weekly Profile Chart */}
                {weeklyProfile.length > 0 && (
                    <>
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
                            <h2 className="text-lg font-semibold text-gray-900 mb-6">
                                Typowy tydzień (średnia z wybranych kwartałów)
                            </h2>
                            <PriceHeatMap
                                data={weeklyProfile}
                                overallAverage={overallAverage}
                                selectedShiftId={selectedShiftId}
                                weekendMode={weekendMode}
                                customStartHour={customStartHour}
                                customEndHour={customEndHour}
                            />
                        </div>

                        {/* Work Profile Calculator */}
                        <WorkProfileCalculator
                            weeklyProfile={weeklyProfile}
                            overallAverage={overallAverage}
                            selectedShiftId={selectedShiftId}
                            onShiftChange={setSelectedShiftId}
                            weekendMode={weekendMode}
                            onWeekendModeChange={setWeekendMode}
                            customStartHour={customStartHour}
                            setCustomStartHour={setCustomStartHour}
                            customEndHour={customEndHour}
                            setCustomEndHour={setCustomEndHour}
                        />
                    </>
                )}

                {availableDates.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <p className="text-gray-600 mb-4">Brak danych cenowych dla wybranych kwartałów.</p>
                        <Link
                            href="/admin/ceny-energii"
                            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Panel Admina
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
