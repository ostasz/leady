'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    BookmarkCheck,
    Download,
    Filter,
    Search,
    ChevronDown,
    Plus,
    Calendar,
    Building2,
    Phone,
    Globe,
    Edit,
    Trash2,
    ArrowUpDown
} from 'lucide-react';

type Lead = {
    id: string;
    companyName: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    nip: string | null;
    status: string;
    priority: string;
    notes: string | null;
    createdAt: string;
    ownerEmail?: string;
    ownerId?: string;
    user?: {
        name: string | null;
        email: string;
    };
};

export default function MyLeadsPage() {
    const { user, userData, loading: authLoading, getAuthHeaders } = useAuth();
    const router = useRouter();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'priority'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }
        fetchLeads();
    }, [user, authLoading, router]);

    useEffect(() => {
        applyFiltersAndSort();
    }, [leads, search, statusFilter, priorityFilter, sortBy, sortOrder]);

    const fetchLeads = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/leads', { headers });
            if (!res.ok) throw new Error('Failed to fetch leads');
            const data = await res.json();
            setLeads(data.leads);
        } catch (error) {
            console.error('Error fetching leads:', error);
            alert('Błąd przy pobieraniu leadów');
        } finally {
            setLoading(false);
        }
    };

    const applyFiltersAndSort = () => {
        let filtered = [...leads];

        // Search filter
        if (search) {
            filtered = filtered.filter(lead =>
                lead.companyName.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(lead => lead.status === statusFilter);
        }

        // Priority filter
        if (priorityFilter !== 'all') {
            filtered = filtered.filter(lead => lead.priority === priorityFilter);
        }

        // Sort
        filtered.sort((a, b) => {
            let comparison = 0;

            if (sortBy === 'date') {
                comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            } else if (sortBy === 'name') {
                comparison = a.companyName.localeCompare(b.companyName);
            } else if (sortBy === 'priority') {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                comparison = (priorityOrder[a.priority as keyof typeof priorityOrder] || 0) -
                    (priorityOrder[b.priority as keyof typeof priorityOrder] || 0);
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

        setFilteredLeads(filtered);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Czy na pewno chcesz usunąć ten lead?')) return;

        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/leads/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete');
            setLeads(leads.filter(l => l.id !== id));
        } catch (error) {
            alert('Błąd przy usuwaniu');
        }
    };

    const handleExport = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/leads/export', { headers });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        } catch (error) {
            alert('Błąd przy eksporcie');
        }
    };

    const getStatusBadge = (status: string) => {
        const colors = {
            new: 'bg-blue-100 text-blue-800',
            contacted: 'bg-yellow-100 text-yellow-800',
            interested: 'bg-green-100 text-green-800',
            closed: 'bg-gray-100 text-gray-800'
        };
        const labels = {
            new: 'Nowy',
            contacted: 'Skontaktowany',
            interested: 'Zainteresowany',
            closed: 'Zamknięty'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status as keyof typeof colors]}`}>
                {labels[status as keyof typeof labels]}
            </span>
        );
    };

    const getPriorityBadge = (priority: string) => {
        const colors = {
            high: 'bg-red-100 text-red-800',
            medium: 'bg-orange-100 text-orange-800',
            low: 'bg-gray-100 text-gray-800'
        };
        const labels = {
            high: 'Wysoki',
            medium: 'Średni',
            low: 'Niski'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[priority as keyof typeof colors]}`}>
                {labels[priority as keyof typeof labels]}
            </span>
        );
    };

    if (authLoading || loading) {
        return <div className="min-h-screen flex items-center justify-center">Ładowanie...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                            <BookmarkCheck className="text-green-600" />
                            Moje Leady
                        </h1>
                        <p className="text-gray-700 mt-1 font-medium">{filteredLeads.length} leadów</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <Download size={18} />
                            Eksportuj CSV
                        </button>
                        <Link
                            href="/"
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            <Plus size={18} />
                            Dodaj Leady
                        </Link>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-gray-600" size={18} />
                            <input
                                type="text"
                                placeholder="Szukaj firmy..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="all">Wszystkie statusy</option>
                            <option value="new">Nowy</option>
                            <option value="contacted">Skontaktowany</option>
                            <option value="interested">Zainteresowany</option>
                            <option value="closed">Zamknięty</option>
                        </select>

                        {/* Priority Filter */}
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="all">Wszystkie priorytety</option>
                            <option value="high">Wysoki</option>
                            <option value="medium">Średni</option>
                            <option value="low">Niski</option>
                        </select>

                        {/* Sort */}
                        <div className="flex gap-2">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="date">Data</option>
                                <option value="name">Nazwa</option>
                                <option value="priority">Priorytet</option>
                            </select>
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                title={sortOrder === 'asc' ? 'Rosnąco' : 'Malejąco'}
                            >
                                <ArrowUpDown size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Leads List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLeads.map((lead) => (
                        <div key={lead.id} className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-800 mb-2">{lead.companyName}</h3>
                                    <div className="flex gap-2 mb-3">
                                        {getStatusBadge(lead.status)}
                                        {getPriorityBadge(lead.priority)}
                                    </div>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-2 text-sm text-gray-700 mb-4">
                                {lead.address && (
                                    <div className="flex items-start gap-2">
                                        <Building2 size={16} className="mt-0.5 flex-shrink-0" />
                                        <span className="break-words">{lead.address}</span>
                                    </div>
                                )}
                                {lead.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone size={16} />
                                        <a href={`tel:${lead.phone}`} className="text-indigo-600 hover:underline">
                                            {lead.phone}
                                        </a>
                                    </div>
                                )}
                                {lead.website && (
                                    <div className="flex items-center gap-2">
                                        <Globe size={16} />
                                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate">
                                            {lead.website}
                                        </a>
                                    </div>
                                )}
                                {lead.nip && (
                                    <div className="text-xs bg-purple-50 px-2 py-1 rounded inline-block">
                                        <span className="font-semibold">NIP:</span> {lead.nip}
                                    </div>
                                )}
                                {/* Show owner for admin */}
                                {userData?.role === 'admin' && lead.ownerEmail && (
                                    <div className="text-xs bg-blue-50 px-2 py-1 rounded inline-block mt-2">
                                        <span className="font-semibold">Właściciel:</span> {lead.ownerEmail}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                <span className="text-xs text-gray-700 font-medium">
                                    {new Date(lead.createdAt).toLocaleDateString('pl-PL')}
                                </span>
                                <div className="flex gap-2">
                                    <Link
                                        href={`/my-leads/${lead.id}`}
                                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                        title="Edytuj"
                                    >
                                        <Edit size={16} />
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(lead.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                        title="Usuń"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {filteredLeads.length === 0 && (
                    <div className="text-center py-16">
                        <BookmarkCheck size={64} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">
                            {search || statusFilter !== 'all' || priorityFilter !== 'all'
                                ? 'Brak leadów spełniających kryteria'
                                : 'Brak zapisanych leadów'}
                        </h3>
                        <p className="text-gray-500">
                            {search || statusFilter !== 'all' || priorityFilter !== 'all'
                                ? 'Spróbuj zmienić filtry'
                                : 'Zacznij zapisywać ciekawe firmy podczas wyszukiwania'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
