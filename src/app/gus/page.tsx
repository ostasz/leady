'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import { Search, Loader2, Building2, MapPin, FileText, ArrowLeft, Globe, Users, TrendingUp, Info } from 'lucide-react';

// Types matching the API response
interface ClientData {
    source: {
        gus: boolean;
        ai: boolean;
    };
    data: {
        formal: {
            name: string;
            nip: string;
            regon: string;
            address: string;
            city: string;
            zipCode: string;
            province: string;
            email?: string;
            phone?: string;
            pkd?: string[];
            management?: string[];
        } | null;
        intelligence: {
            website: string | null;
            nip: string | null;
            socials: {
                linkedin: string | null;
                facebook: string | null;
                instagram: string | null;
            };
            people: {
                management: string[];
                supervisory: string[];
            };
            size_estimation: {
                revenue: string;
                employees: string;
            };
            summary: string;
            news: string[];
            technologies: string[];
            error?: string;
        };
    };
}

export default function ClientIntelligencePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [mode, setMode] = useState<'nip' | 'name'>('nip'); // 'nip' or 'name'
    const [nip, setNip] = useState('');
    const [name, setName] = useState('');
    const [city, setCity] = useState('');
    const [website, setWebsite] = useState(''); // Optional hint

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ClientData | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'formal' | 'people' | 'news'>('overview');

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    if (authLoading) return <div className="min-h-screen flex items-center justify-center">Ładowanie...</div>;
    if (!user) return null;

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setData(null);
        setLoading(true);

        try {
            const payload: any = {};
            if (mode === 'nip') {
                if (!nip) throw new Error('Wprowadź numer NIP');
                payload.nip = nip;
            } else {
                if (!name || !city) throw new Error('Wprowadź nazwę firmy i miasto');
                payload.name = name;
                payload.city = city;
                if (website) payload.website = website;
            }

            const res = await fetch('/api/client-intelligence', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await user.getIdToken()}`
                },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Błąd pobierania danych');

            setData(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <Link href="/apps/leads" className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Wróć do portalu
                    </Link>
                </div>

                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
                        <Globe className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Client Intelligence</h1>
                        <p className="text-gray-500">Weryfikacja klienta 360° (GUS + Web + AI)</p>
                    </div>
                </div>

                {/* Search Box */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                    <div className="flex gap-4 mb-4 border-b border-gray-100 dark:border-gray-700 pb-4">
                        <button
                            onClick={() => setMode('nip')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'nip' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            Szukaj po NIP
                        </button>
                        <button
                            onClick={() => setMode('name')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'name' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            Szukaj po Nazwie
                        </button>
                    </div>

                    <form onSubmit={handleSearch} className="space-y-4">
                        {mode === 'nip' ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Numer NIP</label>
                                <input
                                    type="text"
                                    value={nip}
                                    onChange={(e) => setNip(e.target.value)}
                                    placeholder="np. 5261040828"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa Firmy</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="np. Piekarnia Putka"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Miasto</label>
                                    <input
                                        type="text"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        placeholder="np. Warszawa"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Strona WWW (opcjonalnie - pomaga AI)</label>
                                    <input
                                        type="text"
                                        value={website}
                                        onChange={(e) => setWebsite(e.target.value)}
                                        placeholder="np. piekarniaputka.pl"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                                Rozpocznij Analizę
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}
                </div>

                {/* Results Dashboard */}
                {data && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Header Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                            {data.data.formal ? (
                                <div>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                                                {data.data.formal.name}
                                            </h2>
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <MapPin size={16} />
                                                {data.data.formal.address}, {data.data.formal.zipCode} {data.data.formal.city}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                                                ZWERYFIKOWANO (GUS)
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">NIP: {data.data.formal.nip}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <h2 className="text-xl font-bold text-gray-900">{mode === 'name' ? name : nip}</h2>
                                    <p className="text-orange-600 font-medium mt-1">
                                        Nie znaleziono w bazie GUS. Poniżej dane z analizy AI.
                                        {data.data.intelligence.nip && <span> (AI sugeruje NIP: {data.data.intelligence.nip})</span>}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mb-6 overflow-x-auto">
                            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<Info size={16} />} label="Przegląd" />
                            <TabButton active={activeTab === 'formal'} onClick={() => setActiveTab('formal')} icon={<Building2 size={16} />} label="Dane Formalne" disabled={!data.data.formal} />
                            <TabButton active={activeTab === 'people'} onClick={() => setActiveTab('people')} icon={<Users size={16} />} label="Ludzie" />
                            <TabButton active={activeTab === 'news'} onClick={() => setActiveTab('news')} icon={<TrendingUp size={16} />} label="Newsy & Tech" />
                        </div>

                        {/* Content */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 p-6">
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                            <Globe size={18} className="text-blue-500" /> O Firmie (AI Summary)
                                        </h3>
                                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                                            {data.data.intelligence.summary || "Brak opisu działalności."}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-4 border rounded-lg">
                                            <h4 className="text-sm font-semibold text-gray-500 mb-3">Szacowana Skala</h4>
                                            <div className="space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Przychody:</span>
                                                    <span className="font-medium">{data.data.intelligence.size_estimation.revenue || "Nieznane"}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Zatrudnienie:</span>
                                                    <span className="font-medium">{data.data.intelligence.size_estimation.employees || "Nieznane"}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 border rounded-lg">
                                            <h4 className="text-sm font-semibold text-gray-500 mb-3">Social Media & Web</h4>
                                            <div className="space-y-2 text-sm">
                                                <SocialLink label="Website" url={data.data.intelligence.website} />
                                                <SocialLink label="LinkedIn" url={data.data.intelligence.socials.linkedin} />
                                                <SocialLink label="Facebook" url={data.data.intelligence.socials.facebook} />
                                                <SocialLink label="Instagram" url={data.data.intelligence.socials.instagram} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'formal' && data.data.formal && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <InfoRow label="NIP" value={data.data.formal.nip} />
                                        <InfoRow label="REGON" value={data.data.formal.regon} />
                                        <InfoRow label="Email" value={data.data.formal.email || '-'} />
                                        <InfoRow label="Telefon" value={data.data.formal.phone || '-'} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-500 mb-2">Kody PKD</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {data.data.formal.pkd?.map((pkd, i) => (
                                                <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">{pkd}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'people' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="tex-sm font-semibold text-gray-500 mb-3">Zarząd / Reprezentacja (GUS)</h3>
                                        {data.data.formal?.management?.length ? (
                                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {data.data.formal.management.map((p, i) => (
                                                    <li key={i} className="p-3 bg-gray-50 rounded flex items-center gap-3 border">
                                                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{p.charAt(0)}</div>
                                                        <span className="font-medium text-gray-800">{p}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : <p className="text-gray-400 italic">Brak danych w GUS</p>}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-500 mb-3">Zarząd (AI / LinkedIn)</h3>
                                        {data.data.intelligence.people?.management?.length ? (
                                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                                {data.data.intelligence.people.management.map((p, i) => (
                                                    <li key={i} className="p-3 bg-indigo-50 rounded flex items-center gap-3 border border-indigo-100">
                                                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">{p.charAt(0)}</div>
                                                        <span className="font-medium text-gray-800">{p}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : <p className="text-gray-400 italic mb-6">Brak danych o Zarządzie z AI.</p>}

                                        <h3 className="text-sm font-semibold text-gray-500 mb-3">Rada Nadzorcza (AI / LinkedIn)</h3>
                                        {data.data.intelligence.people?.supervisory?.length ? (
                                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {data.data.intelligence.people.supervisory.map((p, i) => (
                                                    <li key={i} className="p-3 bg-purple-50 rounded flex items-center gap-3 border border-purple-100">
                                                        <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs">{p.charAt(0)}</div>
                                                        <span className="font-medium text-gray-800">{p}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : <p className="text-gray-400 italic">Brak danych o Radzie Nadzorczej z AI.</p>}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'news' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-500 mb-3">Wiadomości & Wydarzenia</h3>
                                        <ul className="space-y-2">
                                            {data.data.intelligence.news?.map((news, i) => (
                                                <li key={i} className="flex gap-2 items-start text-gray-700">
                                                    <span className="text-blue-500 mt-1">•</span>
                                                    <span className="text-sm">{news}</span>
                                                </li>
                                            ))}
                                            {!data.data.intelligence.news?.length && <p className="text-gray-400 italic">Brak nowych wiadomości.</p>}
                                        </ul>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-500 mb-3">Technologie</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {data.data.intelligence.technologies?.map((tech, i) => (
                                                <span key={i} className="px-2 py-1 border rounded text-xs text-gray-600 bg-gray-50">{tech}</span>
                                            ))}
                                            {!data.data.intelligence.technologies?.length && <p className="text-gray-400 italic">Brak danych o technologiach.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label, disabled }: any) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${active
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100 bg-white border border-gray-200'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {icon} {label}
        </button>
    );
}

function SocialLink({ label, url }: { label: string, url: string | null }) {
    if (!url) return null;
    return (
        <div className="flex justify-between items-center group">
            <span className="text-gray-600">{label}:</span>
            <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px]">
                {url}
            </a>
        </div>
    );
}

function InfoRow({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase">{label}</span>
            <span className="font-medium text-gray-900">{value}</span>
        </div>
    );
}
