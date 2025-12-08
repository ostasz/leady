'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, DollarSign, TrendingUp, Activity, Download } from 'lucide-react';

export default function CostsPage() {
    const { user, userData, loading: authLoading, getAuthHeaders } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCost, setTotalCost] = useState(0);

    useEffect(() => {
        if (authLoading) return;
        if (!user || userData?.role !== 'admin') {
            router.push('/');
            return;
        }

        // We'll fetch users and aggregate their stats locally for now
        // A dedicated endpoint /api/admin/usage would be better but reusing /api/admin/users
        // is faster if user usageStats are synced there.
        // Wait, I implemented logUsage to update `usageStats` on user doc!
        // So I can just fetch users and sum it up.
        fetchUsageStats();
    }, [user, userData, authLoading, router]);

    const fetchUsageStats = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/users', { headers }); // Fetch all users
            if (!res.ok) throw new Error('Failed to fetch stats');
            const data = await res.json();

            // Process users to extract usage stats
            const usersWithUsage = data.users.filter((u: any) => u.usageStats);

            let total = 0;
            const formattedStats = usersWithUsage.map((u: any) => {
                const costMicros = u.usageStats.totalCost || 0;
                total += costMicros;
                return {
                    email: u.email,
                    name: u.name,
                    queries: u.usageStats.queryCount || 0,
                    cost: (costMicros / 1000000).toFixed(4), // Convert micros to USD/PLN
                    details: u.usageStats
                };
            });

            setStats(formattedStats);
            setTotalCost(total / 1000000);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) return <div className="p-8">Ładowanie raportu...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => router.push('/admin')}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <DollarSign className="text-green-600" />
                        Raport Kosztów API
                    </h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-gray-500 font-medium">Całkowity Koszt (Est.)</h3>
                            <DollarSign className="text-green-500" size={20} />
                        </div>
                        <div className="text-3xl font-bold text-gray-900">${totalCost.toFixed(4)}</div>
                        <div className="text-xs text-gray-400 mt-1">Przybliżony koszt zewnętrzny</div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-gray-800">Użycie wg Użytkowników</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-sm">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Użytkownik</th>
                                    <th className="px-6 py-4 font-medium">Liczba Zapytań</th>
                                    <th className="px-6 py-4 font-medium text-right">Szacowany Koszt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {stats.length > 0 ? stats.map((stat, i) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{stat.name || 'Brak nazwy'}</div>
                                            <div className="text-sm text-gray-500">{stat.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{stat.queries}</td>
                                        <td className="px-6 py-4 text-right font-mono text-gray-900">${stat.cost}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                                            Brak danych o użyciu. Wykonaj zapytania API aby zobaczyć statystyki.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
