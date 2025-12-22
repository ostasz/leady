'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Trash2, Shield, User, DollarSign, Sparkles, ArrowUpDown, ArrowUp, ArrowDown, MapPin } from 'lucide-react';

export default function AdminPage() {
    const { user, userData, loading: authLoading, getAuthHeaders } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });

    useEffect(() => {
        if (authLoading) return;

        if (!user || userData?.role !== 'admin') {
            router.push('/');
            return;
        }

        fetchUsers();
    }, [user, userData, authLoading, router]);

    const fetchUsers = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/users', { headers });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Error ${res.status}: Failed to fetch users`);
            }

            const data = await res.json();
            setUsers(data.users);
        } catch (err: any) {
            console.error('Fetch users error:', err);
            setError(err.message || 'Błąd pobierania użytkowników');
        } finally {
            setLoading(false);
        }
    };

    const handleBlock = async (userId: string, currentStatus: boolean) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ id: userId, isBlocked: !currentStatus }),
            });
            if (!res.ok) throw new Error('Failed to update user');

            setUsers(users.map(u => u.id === userId ? { ...u, isBlocked: !currentStatus } : u));
        } catch (err) {
            alert('Błąd aktualizacji statusu użytkownika');
        }
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('Czy na pewno chcesz usunąć tego użytkownika?')) return;

        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/admin/users?id=${userId}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) throw new Error('Failed to delete user');
            setUsers(users.filter(u => u.id !== userId));
        } catch (err) {
            alert('Błąd usuwania użytkownika');
        }
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedUsers = [...users].sort((a, b) => {
        if (!sortConfig.key) return 0;

        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle specific fields
        if (sortConfig.key === 'lastLogin' || sortConfig.key === 'createdAt') {
            aValue = aValue ? new Date(aValue).getTime() : 0;
            bValue = bValue ? new Date(bValue).getTime() : 0;
        } else if (sortConfig.key === 'searchCount') {
            aValue = Number(aValue || 0);
            bValue = Number(bValue || 0);
        } else if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue ? bValue.toLowerCase() : '';
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    if (authLoading || loading) {
        return <div className="min-h-screen flex items-center justify-center">Ładowanie...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <Shield className="text-primary" />
                        Panel Administratora
                    </h1>
                    <div className="flex gap-4">
                        <button
                            onClick={() => router.push('/admin/costs')}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                            <DollarSign size={18} />
                            Koszty API
                        </button>
                        <button
                            onClick={() => router.push('/apps/ai-assistant')}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                        >
                            <Sparkles size={18} />
                            Asystent AI
                        </button>
                        <button
                            onClick={() => router.push('/admin/ceny-energii')}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <Shield size={18} />
                            Upload Ceny Energii
                        </button>
                        <button
                            onClick={() => router.push('/admin/geocoding')}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                        >
                            <MapPin size={18} />
                            Geokodowanie
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="text-gray-600 hover:text-gray-900"
                        >
                            Wróć do aplikacji
                        </button>
                    </div>
                </div>

                {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>}

                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-1">
                                        Użytkownik {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('email')}>
                                    <div className="flex items-center gap-1">
                                        Email {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('role')}>
                                    <div className="flex items-center gap-1">
                                        Rola {sortConfig.key === 'role' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('searchCount')}>
                                    <div className="flex items-center gap-1">
                                        Liczba wyszukiwań {sortConfig.key === 'searchCount' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('lastLogin')}>
                                    <div className="flex items-center gap-1">
                                        Ostatnie logowanie {sortConfig.key === 'lastLogin' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('createdAt')}>
                                    <div className="flex items-center gap-1">
                                        Data utworzenia {sortConfig.key === 'createdAt' && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedUsers.map((user) => (
                                <tr key={user.id}>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                                                <User size={20} className="text-gray-500" />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{user.name || 'Bez nazwy'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {user.role === 'admin' ? 'Admin' : 'User'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{user.searchCount || 0}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('pl-PL', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            timeZone: 'Europe/Warsaw'
                                        }) : '-'}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pl-PL', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            timeZone: 'Europe/Warsaw'
                                        }) : '-'}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleBlock(user.id, user.isBlocked || false)}
                                                className={`px-3 py-1 rounded ${user.isBlocked
                                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                                    }`}
                                            >
                                                {user.isBlocked ? 'Odblokuj' : 'Zablokuj'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
