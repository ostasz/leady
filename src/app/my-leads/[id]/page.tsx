'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Building2, Phone, Globe, MapPin, Users, DollarSign, Code, Home } from 'lucide-react';

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
    keyPeople: string[];
    revenue: string | null;
    employees: string | null;
    description: string | null;
    technologies: string[];
    openingHours: string[] | null;
    socials: any;
    createdAt: string;
    updatedAt: string;
};

export default function LeadDetailPage() {
    const { user, loading: authLoading, getAuthHeaders } = useAuth();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const id = params?.id as string;
    const source = searchParams?.get('source');

    const backLink = source === 'planner' ? '/apps/planner' : '/my-leads';

    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Editable fields
    const [statusValue, setStatusValue] = useState('');
    const [priorityValue, setPriorityValue] = useState('');
    const [notes, setNotes] = useState('');
    const [nipValue, setNipValue] = useState('');

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }
        if (id) {
            fetchLead();
        }
    }, [user, authLoading, router, id]);

    const fetchLead = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/leads/${id}`, { headers });
            if (!res.ok) throw new Error('Failed to fetch lead');
            const data = await res.json();
            setLead(data.lead);
            setStatusValue(data.lead.status);
            setPriorityValue(data.lead.priority);
            setNotes(data.lead.notes || '');
            setNipValue(data.lead.nip || '');
        } catch (error) {
            console.error('Error fetching lead:', error);
            alert('Błąd przy pobieraniu leada');
            router.push('/my-leads');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/leads/${id}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                    status: statusValue,
                    priority: priorityValue,
                    notes: notes || null,
                    nip: nipValue || null
                })
            });

            if (!res.ok) throw new Error('Failed to update');
            alert('Lead zaktualizowany!');
            fetchLead();
        } catch (error) {
            alert('Błąd przy zapisywaniu');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return <div className="min-h-screen flex items-center justify-center">Ładowanie...</div>;
    }

    if (!lead) {
        return <div className="min-h-screen flex items-center justify-center">Lead nie znaleziony</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 transition-colors">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <Link
                            href={backLink}
                            className="p-3 bg-primary hover:bg-primary-dark rounded-xl text-white shadow-sm transition-all hover:shadow-md hover:scale-105 active:scale-95 flex items-center justify-center"
                        >
                            <ArrowLeft size={24} />
                        </Link>
                        <Link
                            href="/"
                            className="p-3 bg-white border border-gray-200 hover:border-primary hover:text-primary rounded-xl text-gray-500 shadow-sm transition-all hover:shadow-md hover:scale-105 active:scale-95 flex items-center justify-center"
                            title="Strona główna"
                        >
                            <Home size={24} />
                        </Link>
                    </div>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{lead.companyName}</h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                            Dodano: {new Date(lead.createdAt).toLocaleString('pl-PL')}
                        </p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        <Save size={18} />
                        {saving ? 'Zapisywanie...' : 'Zapisz'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Company Info Card */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm transition-colors">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Informacje o firmie</h2>
                            <div className="space-y-3">
                                {lead.address && (
                                    <div className="flex items-start gap-3">
                                        <MapPin size={20} className="text-gray-400 dark:text-gray-500 mt-1" />
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Adres</p>
                                            <p className="font-medium text-gray-900 dark:text-gray-100">{lead.address}</p>
                                        </div>
                                    </div>
                                )}
                                {lead.phone && (
                                    <div className="flex items-center gap-3">
                                        <Phone size={20} className="text-gray-400 dark:text-gray-500" />
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Telefon</p>
                                            <a href={`tel:${lead.phone}`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                                                {lead.phone}
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {lead.website && (
                                    <div className="flex items-center gap-3">
                                        <Globe size={20} className="text-gray-400 dark:text-gray-500" />
                                        <div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Strona WWW</p>
                                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                                                {lead.website}
                                            </a>
                                        </div>
                                    </div>
                                )}
                                {lead.nip && (
                                    <div className="flex items-center gap-3">
                                        <Building2 size={20} className="text-gray-400 dark:text-gray-500" />
                                        <div className="w-full">
                                            <p className="text-sm text-gray-600 dark:text-gray-400">NIP</p>
                                            <input
                                                type="text"
                                                value={nipValue}
                                                onChange={(e) => setNipValue(e.target.value)}
                                                className="font-medium font-mono text-gray-900 dark:text-gray-100 bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-indigo-500 outline-none w-full"
                                                placeholder="Brak NIP"
                                            />
                                        </div>
                                    </div>
                                )}
                                {lead.openingHours && lead.openingHours.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-300 mb-2">Godziny otwarcia</h3>
                                        <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                                            {lead.openingHours.map((hour, idx) => (
                                                <li key={idx}>{hour}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Deep Search Data */}
                        {(lead.description || lead.keyPeople.length > 0 || lead.revenue || lead.employees) && (
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm transition-colors">
                                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Dodatkowe informacje (AI)</h2>

                                {lead.description && (
                                    <div className="mb-4">
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Opis działalności</p>
                                        <p className="text-gray-800 dark:text-gray-200">{lead.description}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    {lead.revenue && (
                                        <div className="flex items-center gap-2">
                                            <DollarSign size={18} className="text-green-600 dark:text-green-400" />
                                            <div>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">Przychody</p>
                                                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{lead.revenue}</p>
                                            </div>
                                        </div>
                                    )}
                                    {lead.employees && (
                                        <div className="flex items-center gap-2">
                                            <Users size={18} className="text-blue-600 dark:text-blue-400" />
                                            <div>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">Pracownicy</p>
                                                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{lead.employees}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {lead.keyPeople.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                                            <Users size={16} />
                                            Kluczowe osoby
                                        </p>
                                        <ul className="list-disc list-inside space-y-1">
                                            {lead.keyPeople.map((person, idx) => (
                                                <li key={idx} className="text-sm text-gray-800 dark:text-gray-200">{person}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {lead.technologies.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                                            <Code size={16} />
                                            Technologie
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {lead.technologies.map((tech, idx) => (
                                                <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded">
                                                    {tech}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {lead.socials && (
                                    <div className="mt-4">
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Media społecznościowe</p>
                                        <div className="flex gap-3">
                                            {lead.socials.linkedin && (
                                                <a href={lead.socials.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                                                    LinkedIn
                                                </a>
                                            )}
                                            {lead.socials.facebook && (
                                                <a href={lead.socials.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                                                    Facebook
                                                </a>
                                            )}
                                            {lead.socials.instagram && (
                                                <a href={lead.socials.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-600 dark:text-pink-400 hover:underline text-sm">
                                                    Instagram
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar - Editable */}
                    <div className="space-y-6">
                        {/* Status & Priority */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm transition-colors">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Zarządzanie</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                                    <select
                                        value={statusValue}
                                        onChange={(e) => setStatusValue(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="new">Nowy</option>
                                        <option value="contacted">Skontaktowany</option>
                                        <option value="interested">Zainteresowany</option>
                                        <option value="closed">Zamknięty</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priorytet</label>
                                    <select
                                        value={priorityValue}
                                        onChange={(e) => setPriorityValue(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="high">Wysoki</option>
                                        <option value="medium">Średni</option>
                                        <option value="low">Niski</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg shadow-sm transition-colors border border-yellow-100 dark:border-yellow-800/30">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                Notatki
                                <span className="text-xs font-normal bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">Notatka</span>
                            </h2>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={8}
                                placeholder="Dodaj notatki o tym leadzie..."
                                className="w-full px-3 py-2 border border-yellow-200 dark:border-yellow-800/50 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none bg-yellow-100/50 dark:bg-yellow-900/40 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
