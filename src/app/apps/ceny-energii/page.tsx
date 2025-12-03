/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { EnergyPriceEntry, DailyPriceSummary, groupPricesByDate, calculateDailySummary } from '@/types/energy-prices';
import EnergyPriceChart from '@/components/EnergyPriceChart';
import PriceStatistics from '@/components/PriceStatistics';
import { ArrowLeft, Calendar, Lightbulb, Download } from 'lucide-react';
import Link from 'next/link';

export default function EnergyPricesDashboard() {
    const { user, userData, loading: authLoading, getAuthHeaders } = useAuth();
    const router = useRouter();
    const [prices, setPrices] = useState<EnergyPriceEntry[]>([]);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [dailySummary, setDailySummary] = useState<DailyPriceSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Auth guard - admin only for now
    useEffect(() => {
        if (!authLoading && (!user || userData?.role !== 'admin')) {
            router.push('/');
        }
    }, [user, userData, authLoading, router]);

    // Fetch prices
    useEffect(() => {
        if (!user) return;

        const fetchPrices = async () => {
            try {
                setLoading(true);
                const headers = await getAuthHeaders();
                const response = await fetch('/api/energy-prices', { headers });

                if (!response.ok) {
                    throw new Error('Failed to fetch prices');
                }

                const data = await response.json();
                setPrices(data.prices || []);

                // Extract unique dates
                const grouped = groupPricesByDate(data.prices || []);
                const dates = Array.from(grouped.keys()).sort().reverse();
                setAvailableDates(dates);

                // Select most recent date by default
                if (dates.length > 0 && !selectedDate) {
                    setSelectedDate(dates[0]);
                }

                setError('');
            } catch (err: any) {
                setError(err.message || 'Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        fetchPrices();
    }, [user, getAuthHeaders]);

    // Calculate daily summary when date changes
    useEffect(() => {
        if (!selectedDate || prices.length === 0) return;

        const dayPrices = prices.filter(p => p.date === selectedDate);
        const summary = calculateDailySummary(dayPrices);
        setDailySummary(summary);
    }, [selectedDate, prices]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user || userData?.role !== 'admin') return null;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-xl font-semibold text-gray-900">
                            Ceny Energii - Rynek Dnia Następnego
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

                {availableDates.length === 0 && !loading && (
                    <div className="text-center py-12">
                        <p className="text-gray-600 mb-4">Brak danych cenowych. Przejdź do panelu admina aby wgrać dane.</p>
                        <Link
                            href="/admin/ceny-energii"
                            className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                        >
                            Panel Admina
                        </Link>
                    </div>
                )}

                {availableDates.length > 0 && (
                    <>
                        {/* Date Selector */}
                        <div className="mb-6 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Calendar size={20} className="text-gray-600" />
                                <label className="text-sm font-medium text-gray-700">Wybierz dzień:</label>
                            </div>
                            <select
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                            >
                                {availableDates.map(date => (
                                    <option key={date} value={date}>{date}</option>
                                ))}
                            </select>
                        </div>

                        {/* Statistics Cards */}
                        {dailySummary && <PriceStatistics data={dailySummary} />}

                        {/* Chart */}
                        {dailySummary && (
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-8">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                    Ceny godzinowe - {selectedDate}
                                </h2>
                                <EnergyPriceChart data={dailySummary} />
                            </div>
                        )}

                        {/* Smart Insights */}
                        {dailySummary && (
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                                <div className="flex items-start gap-3">
                                    <Lightbulb size={24} className="text-blue-600 flex-shrink-0" />
                                    <div>
                                        <h3 className="font-semibold text-blue-900 mb-2">Smart Insights</h3>
                                        <div className="space-y-2 text-sm text-blue-800">
                                            <p>
                                                💡 <strong>Najlepszy moment na zakup:</strong> Godzina {dailySummary.statistics.minHour}:00
                                                ({dailySummary.statistics.minPrice.toFixed(2)} PLN/MWh)
                                            </p>
                                            <p>
                                                ⚡ <strong>Unikaj godziny:</strong> {dailySummary.statistics.maxHour}:00
                                                ({dailySummary.statistics.maxPrice.toFixed(2)} PLN/MWh)
                                            </p>
                                            <p>
                                                💰 <strong>Potencjalne oszczędności:</strong> Przesuwając zużycie z godziny {dailySummary.statistics.maxHour}:00
                                                na {dailySummary.statistics.minHour}:00 można zaoszczędzić {dailySummary.statistics.savings.toFixed(2)} PLN/MWh
                                            </p>
                                            <p>
                                                📊 <strong>Ocena dnia:</strong> {dailySummary.statistics.avgPrice < 300 ? 'Korzystne ceny ✅' : 'Podwyższone ceny ⚠️'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
