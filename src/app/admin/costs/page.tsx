'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { ArrowLeft, DollarSign, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';

interface UserCost {
    id: string;
    name: string;
    email: string;
    queryCount: number;
    totalCost: number;
    chatCost?: number;
    searchCost?: number;
    [key: string]: any;
}

type Period = 'all' | 'this_month' | 'last_month' | 'today';

export default function AdminCostsPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const router = useRouter();
    const [costs, setCosts] = useState<UserCost[]>([]);
    const [totalSystemCost, setTotalSystemCost] = useState(0);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('all');
    const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: 'totalCost', direction: 'desc' });

    useEffect(() => {
        if (!authLoading) {
            if (!user || userData?.role !== 'admin') {
                router.push('/');
            } else {
                fetchCosts();
            }
        }
    }, [user, userData, authLoading, router, period]);

    const fetchCosts = async () => {
        setLoading(true);
        try {
            const token = await user?.getIdToken();
            let url = '/api/admin/costs';

            if (period !== 'all') {
                const now = new Date();
                let fromStr = '';
                let toStr = now.toISOString();

                if (period === 'this_month') {
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    fromStr = firstDay.toISOString();
                } else if (period === 'last_month') {
                    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                    fromStr = firstDayLastMonth.toISOString();
                    toStr = lastDayLastMonth.toISOString();
                } else if (period === 'today') {
                    const today = new Date(now.setHours(0, 0, 0, 0));
                    fromStr = today.toISOString();
                }

                if (fromStr) {
                    url += `?from=${fromStr}&to=${toStr}`;
                }
            }

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCosts(data.users);
                setTotalSystemCost(data.totalSystemCost);
            }
        } catch (error) {
            console.error('Failed to fetch costs', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedCosts = [...costs].sort((a, b) => {
        if (!sortConfig.key) return 0;
        const aValue = a[sortConfig.key] || 0;
        const bValue = b[sortConfig.key] || 0;

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    if (authLoading) {
        return <div className="min-h-screen flex items-center justify-center">Ładowanie...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
                            <ArrowLeft size={24} />
                        </Link>
                        <div className="flex items-center gap-2">
                            <DollarSign className="text-green-600" size={28} />
                            <h1 className="text-2xl font-bold text-gray-900">Raport Kosztów API</h1>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Total Cost Card */}
                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                        <h2 className="text-gray-500 font-medium mb-2">Całkowity Koszt (Est.)</h2>
                        <div className="flex items-center justify-between">
                            <span className="text-4xl font-bold text-gray-900">
                                {loading ? '...' : `$${totalSystemCost.toFixed(4)}`}
                            </span>
                            <DollarSign className="text-green-500" size={32} />
                        </div>
                        <p className="text-xs text-gray-400 mt-4">Przybliżony koszt zewnętrzny</p>
                    </div>

                    {/* Filters Card */}
                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 col-span-2 flex items-center">
                        <div className="w-full">
                            <h2 className="text-gray-500 font-medium mb-4 flex items-center gap-2">
                                <Calendar size={18} />
                                Zakres Danych
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPeriod('all')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === 'all' ? 'bg-green-100 text-green-700 ring-1 ring-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    Cały Czas
                                </button>
                                <button
                                    onClick={() => setPeriod('this_month')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === 'this_month' ? 'bg-green-100 text-green-700 ring-1 ring-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    Ten Miesiąc
                                </button>
                                <button
                                    onClick={() => setPeriod('last_month')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === 'last_month' ? 'bg-green-100 text-green-700 ring-1 ring-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    Poprzedni Miesiąc
                                </button>
                                <button
                                    onClick={() => setPeriod('today')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === 'today' ? 'bg-green-100 text-green-700 ring-1 ring-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                    Dzisiaj
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* User Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900">Użycie wg Użytkowników</h2>
                    </div>
                    {loading ? (
                        <div className="p-12 text-center text-gray-500">Odświeżanie danych...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                                            <div className="flex items-center gap-1">
                                                Użytkownik {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('queryCount')}>
                                            <div className="flex items-center justify-end gap-1">
                                                Liczba Zapytań {sortConfig.key === 'queryCount' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('searchCost')}>
                                            <div className="flex items-center justify-end gap-1">
                                                Koszt Szukania {sortConfig.key === 'searchCost' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('chatCost')}>
                                            <div className="flex items-center justify-end gap-1">
                                                Koszt Chat {sortConfig.key === 'chatCost' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('totalCost')}>
                                            <div className="flex items-center justify-end gap-1">
                                                Całkowity Koszt {sortConfig.key === 'totalCost' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedCosts.map((userCost) => (
                                        <tr key={userCost.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900">{userCost.name}</span>
                                                    <span className="text-sm text-gray-500">{userCost.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 font-mono">
                                                {userCost.queryCount}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-600">
                                                ${(userCost.searchCost || 0).toFixed(4)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-600">
                                                ${(userCost.chatCost || 0).toFixed(4)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-medium text-gray-900">
                                                ${userCost.totalCost.toFixed(4)}
                                            </td>
                                        </tr>
                                    ))}
                                    {sortedCosts.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                Brak danych o użyciu w wybranym okresie.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
