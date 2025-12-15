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
    ArrowUpDown,
    FileText,
    ArrowLeft,
    Home,
    MapPin
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { robotoRegular } from '@/lib/fonts/roboto-regular';

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
    ownerName?: string;
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
    const [loadingMore, setLoadingMore] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'priority'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Pagination State
    const [lastCreatedAt, setLastCreatedAt] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }
        // Initial fetch
        fetchLeads();
    }, [user, authLoading, router]);

    // Re-fetch when filters change (debounced for search would be better, but strict dependency allows simplicity)
    // We want to re-fetch from server when status or priority changes to use server indexes
    // Search is handled client-side for now or mixed? 
    // The API supports text search but only on the fetched page (if implementing 1 and 2 only).
    // Actually, to make pagination useful, we should rely on server filters for Status/Priority.
    useEffect(() => {
        if (!loading) { // Avoid double fetch on mount
            fetchLeads(false);
        }
    }, [statusFilter, priorityFilter]);

    useEffect(() => {
        // Local filtering/sorting for the currently loaded data
        applyLocalFiltersAndSort();
    }, [leads, search, sortBy, sortOrder]);

    const fetchLeads = async (loadMore = false) => {
        try {
            if (loadMore) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }

            const headers = await getAuthHeaders();
            const params = new URLSearchParams();

            // Limit per page
            params.set('limit', '50');

            // Server-side filters
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (priorityFilter !== 'all') params.set('priority', priorityFilter);

            // Cursor for pagination
            if (loadMore && lastCreatedAt) {
                params.set('lastCreatedAt', lastCreatedAt);
            }

            const res = await fetch(`/api/leads?${params.toString()}`, { headers });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.details || err.error || 'Failed to fetch leads');
            }

            const data = await res.json();

            if (loadMore) {
                setLeads(prev => [...prev, ...data.leads]);
            } else {
                setLeads(data.leads);
            }

            setLastCreatedAt(data.lastCreatedAt);
            setHasMore(data.hasMore);

        } catch (error: any) {
            console.error('Error fetching leads:', error);
            alert(`Błąd: ${error.message}`);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const applyLocalFiltersAndSort = () => {
        let filtered = [...leads];

        // Search filter (Client-side for loaded items)
        // Ideally search should be server-side too, but requires full text search engine or expensive query
        if (search) {
            filtered = filtered.filter(lead =>
                lead.companyName.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Note: Status/Priority are already filtered on server, 
        // but we keep local logic if user changes filters rapidly or for consistency/safety
        if (statusFilter !== 'all') {
            filtered = filtered.filter(lead => lead.status === statusFilter);
        }
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

    const handleExportPDF = () => {
        const doc = new jsPDF();

        // Add custom font
        doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular);
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');

        // Add title
        doc.setFontSize(18);
        doc.text('Lista Leadów', 14, 22);
        doc.setFontSize(11);
        doc.text(`Data: ${new Date().toLocaleDateString('pl-PL')}`, 14, 30);

        // Prepare data
        const tableData = filteredLeads.map(lead => [
            lead.companyName,
            lead.status === 'new' ? 'Nowy' :
                lead.status === 'contacted' ? 'Skontaktowany' :
                    lead.status === 'interested' ? 'Zainteresowany' : 'Zamknięty',
            lead.priority === 'high' ? 'Wysoki' :
                lead.priority === 'medium' ? 'Średni' : 'Niski',
            [lead.phone, lead.website].filter(Boolean).join('\n'),
            lead.address || '-'
        ]);

        // Generate table
        autoTable(doc, {
            head: [['Firma', 'Status', 'Priorytet', 'Kontakt', 'Adres']],
            body: tableData,
            startY: 40,
            styles: {
                fontSize: 8,
                font: 'Roboto',
                fontStyle: 'normal'
            },
            headStyles: {
                fillColor: [79, 70, 229], // Indigo-600
                font: 'Roboto',
                fontStyle: 'normal'
            }
        });

        doc.save(`leads_${new Date().toISOString().split('T')[0]}.pdf`);
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
        <div className="flex flex-col min-h-screen bg-gray-50">
            {/* Header - Matching Planner Style */}
            <header className="h-16 border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 bg-white shrink-0 z-10 sticky top-0">
                <div className="flex items-center gap-4">
                    <Link
                        href="/"
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                        title="Strona główna"
                    >
                        <Home size={20} />
                    </Link>
                    <div className="h-6 w-px bg-gray-200 hidden lg:block"></div>
                    <h1 className="text-lg lg:text-xl font-bold text-gray-800 flex items-center gap-2">
                        <BookmarkCheck className="text-primary hidden lg:block" size={24} />
                        Moje Leady
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full ml-2">
                            {filteredLeads.length}
                        </span>
                    </h1>
                </div>

                <div className="flex items-center gap-2 lg:gap-3">
                    <div className="hidden md:flex gap-2">
                        <button
                            onClick={handleExport}
                            className="p-2 text-gray-600 hover:text-primary hover:bg-green-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                            title="Eksportuj do CSV"
                        >
                            <Download size={18} />
                            <span className="hidden lg:inline">CSV</span>
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                            title="Eksportuj do PDF"
                        >
                            <FileText size={18} />
                            <span className="hidden lg:inline">PDF</span>
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-200 hidden md:block"></div>

                    <Link
                        href="/"
                        className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm hover:shadow"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">Dodaj Lead</span>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Filters - Cleaner Look */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            {/* Search - Larger Area */}
                            <div className="md:col-span-12 lg:col-span-5 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Szukaj po nazwie firmy..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-lg focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm"
                                />
                            </div>

                            {/* Filters Group */}
                            <div className="md:col-span-12 lg:col-span-7 flex flex-wrap gap-2 lg:justify-end">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-3 py-2 bg-gray-50 border-0 rounded-lg text-sm focus:ring-2 focus:ring-primary cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                    <option value="all">Status: Wszystkie</option>
                                    <option value="new">Nowy</option>
                                    <option value="contacted">Skontaktowany</option>
                                    <option value="interested">Zainteresowany</option>
                                    <option value="closed">Zamknięty</option>
                                </select>

                                <select
                                    value={priorityFilter}
                                    onChange={(e) => setPriorityFilter(e.target.value)}
                                    className="px-3 py-2 bg-gray-50 border-0 rounded-lg text-sm focus:ring-2 focus:ring-primary cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                    <option value="all">Priorytet: Wszystkie</option>
                                    <option value="high">Wysoki</option>
                                    <option value="medium">Średni</option>
                                    <option value="low">Niski</option>
                                </select>

                                <div className="h-8 w-px bg-gray-200 mx-1 self-center hidden sm:block"></div>

                                <div className="flex bg-gray-50 rounded-lg p-1">
                                    <button
                                        onClick={() => setSortBy('date')}
                                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${sortBy === 'date' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Data
                                    </button>
                                    <button
                                        onClick={() => setSortBy('name')}
                                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${sortBy === 'name' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Nazwa
                                    </button>
                                    <button
                                        onClick={() => setSortBy('priority')}
                                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${sortBy === 'priority' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Priorytet
                                    </button>
                                </div>

                                <button
                                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                    className="p-2 bg-gray-50 hover:bg-white hover:text-primary rounded-lg transition-all shadow-sm"
                                    title={sortOrder === 'asc' ? 'Rosnąco' : 'Malejąco'}
                                >
                                    <ArrowUpDown size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Leads List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredLeads.map((lead) => (
                            <div key={lead.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-primary/20 transition-all group">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-bold text-gray-800 truncate group-hover:text-primary transition-colors cursor-pointer" onClick={() => router.push(`/my-leads/${lead.id}`)}>
                                            {lead.companyName}
                                        </h3>
                                        <div className="flex gap-2 mt-1.5">
                                            {getStatusBadge(lead.status)}
                                            {getPriorityBadge(lead.priority)}
                                        </div>
                                    </div>
                                    {userData?.role === 'admin' && (lead.ownerEmail || lead.ownerName) && (
                                        <div className="text-[10px] text-gray-500 bg-gray-100/80 px-2 py-1 rounded-md border border-gray-200/50 flex flex-col items-end max-w-[120px]" title={`Właściciel: ${lead.ownerEmail || 'Nieznany'}`}>
                                            <span className="font-semibold text-gray-700 truncate w-full text-right">
                                                {lead.ownerName || lead.ownerEmail?.split('@')[0]}
                                            </span>
                                            {lead.ownerName && lead.ownerEmail && (
                                                <span className="text-[9px] text-gray-400 truncate w-full text-right opacity-80">
                                                    {lead.ownerEmail}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Details */}
                                <div className="space-y-2 text-sm text-gray-600 mb-4 min-h-[80px]">
                                    {lead.address ? (
                                        <div className="flex items-start gap-2">
                                            <MapPin size={15} className="mt-0.5 flex-shrink-0 text-gray-400" />
                                            <span className="break-words line-clamp-2 text-xs">{lead.address}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <MapPin size={15} />
                                            <span className="text-xs italic">Brak adresu</span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 pt-1">
                                        {lead.phone ? (
                                            <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary transition-colors bg-gray-50 px-2 py-1 rounded-md">
                                                <Phone size={12} />
                                                {lead.phone}
                                            </a>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md opacity-50 cursor-not-allowed">
                                                <Phone size={12} />
                                                -
                                            </span>
                                        )}
                                        {lead.website ? (
                                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary transition-colors bg-gray-50 px-2 py-1 rounded-md max-w-[140px] truncate">
                                                <Globe size={12} />
                                                WWW
                                            </a>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md opacity-50 cursor-not-allowed">
                                                <Globe size={12} />
                                                -
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex justify-between items-center pt-3 border-t border-gray-50 mt-auto">
                                    <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                        <Calendar size={10} />
                                        {new Date(lead.createdAt).toLocaleDateString('pl-PL')}
                                    </span>
                                    <div className="flex gap-1">
                                        <Link
                                            href={`/my-leads/${lead.id}`}
                                            className="p-1.5 text-primary hover:text-primary-dark hover:bg-green-50 rounded-lg transition-colors"
                                            title="Edytuj"
                                        >
                                            <Edit size={16} />
                                        </Link>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(lead.id);
                                            }}
                                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
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
                        <div className="text-center py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-gray-200">
                            <div className="bg-green-50 p-4 rounded-full mb-4">
                                <BookmarkCheck size={40} className="text-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">
                                {search || statusFilter !== 'all' || filteredLeads.length > 0
                                    ? 'Nie znaleziono leadów'
                                    : 'Twoja lista leadów jest pusta'}
                            </h3>
                            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                                {search || statusFilter !== 'all'
                                    ? 'Spróbuj zmienić kryteria wyszukiwania lub filtry, aby znaleźć to, czego szukasz.'
                                    : 'Zacznij budować swoją bazę klientów! Wyszukaj firmy na mapie lub dodaj je ręcznie.'}
                            </p>
                            {filteredLeads.length === 0 && !search && statusFilter === 'all' && (
                                <Link
                                    href="/"
                                    className="bg-primary hover:bg-primary-dark text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-green-200"
                                >
                                    Znajdź firmy na mapie
                                </Link>
                            )}
                        </div>
                    )}
                    {/* Load More Button */}
                    {hasMore && filteredLeads.length > 0 && (
                        <div className="flex justify-center py-6">
                            <button
                                onClick={() => fetchLeads(true)}
                                disabled={loadingMore}
                                className="bg-white border border-gray-200 text-gray-700 hover:text-primary hover:border-primary px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loadingMore ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                                        Ładowanie...
                                    </>
                                ) : (
                                    <>
                                        Wczytaj więcej
                                        <ChevronDown size={16} />
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
