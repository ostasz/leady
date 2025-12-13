'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Shield, ArrowLeft, Play, MapPin, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface Lead {
    id: string;
    companyName: string;
    address: string;
    latitude?: number | null;
    longitude?: number | null;
    status: string;
}

const GeocodingContent = () => {
    const { user, userData, getAuthHeaders } = useAuth();
    const router = useRouter();
    const geocoding = useMapsLibrary('geocoding');

    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, updated: 0, failed: 0 });
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
            setLogs(prev => [...prev, 'ERROR: Brak klucza API Google Maps (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)']);
        }
    }, []);

    useEffect(() => {
        if (userData && userData.role !== 'admin') {
            router.push('/');
            return;
        }
        if (user) {
            fetchLeads();
        }
    }, [user, userData]);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/leads', { headers });
            const data = await res.json();
            if (data.leads) {
                setLeads(data.leads);
            }
        } catch (e) {
            console.error(e);
            setLogs(prev => [...prev, 'Błąd pobierania leadów']);
        } finally {
            setLoading(false);
        }
    };

    const addLog = (msg: string) => {
        setLogs(prev => [msg, ...prev].slice(0, 100));
    };

    const handleStartGeocoding = async () => {
        if (!geocoding) return;
        const leadsToProcess = leads.filter(l => (!l.latitude || !l.longitude) && l.address);

        if (leadsToProcess.length === 0) {
            addLog('Brak leadów wymagających geokodowania.');
            return;
        }

        setProcessing(true);
        setProgress({ current: 0, total: leadsToProcess.length, updated: 0, failed: 0 });
        const geocoder = new window.google.maps.Geocoder();
        const headers = await getAuthHeaders();

        addLog(`Rozpoczynam geokodowanie ${leadsToProcess.length} leadów...`);

        for (let i = 0; i < leadsToProcess.length; i++) {
            const lead = leadsToProcess[i];

            // Rate limiting check
            if (i > 0 && i % 10 === 0) {
                addLog('Pauza 1s dla API rate limits...');
                await new Promise(r => setTimeout(r, 1000));
            }

            try {
                // 1. Geocode
                const result = await geocoder.geocode({ address: lead.address });

                if (result.results && result.results[0]) {
                    const loc = result.results[0].geometry.location;
                    const lat = loc.lat();
                    const lng = loc.lng();

                    // 2. Update Backend
                    const updateRes = await fetch(`/api/leads/${lead.id}`, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify({
                            latitude: lat,
                            longitude: lng
                        })
                    });

                    if (updateRes.ok) {
                        setProgress(prev => ({ ...prev, current: i + 1, updated: prev.updated + 1 }));
                        addLog(`✅ Zaktualizowano: ${lead.companyName}`);
                        // Update local state
                        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, latitude: lat, longitude: lng } : l));
                    } else {
                        throw new Error('API Update Failed');
                    }
                } else {
                    throw new Error('Geocoding Zero Results');
                }
            } catch (e: any) {
                console.error(e);
                setProgress(prev => ({ ...prev, current: i + 1, failed: prev.failed + 1 }));
                addLog(`❌ Błąd dla ${lead.companyName}: ${e.message || 'Unknown error'}`);
            }
        }

        addLog('Zakończono proces geokodowania.');
        setProcessing(false);
    };

    const leadsMissingCoords = leads.filter(l => !l.latitude || !l.longitude);
    const leadsWithAddressOnly = leadsMissingCoords.filter(l => l.address);

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 flex items-center gap-4">
                    <Link href="/admin" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <ArrowLeft size={20} className="text-gray-600" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <MapPin className="text-blue-600" />
                        Narzędzie Geokodowania Leadów
                    </h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Status Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-700 mb-4">Status Leadów</h2>
                        {loading ? (
                            <div className="flex items-center gap-2 text-gray-500">
                                <Loader2 className="animate-spin" size={20} /> Ładowanie danych...
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <span className="text-gray-600">Wszystkie leady</span>
                                    <span className="font-bold text-gray-900">{leads.length}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                                    <div className="flex items-center gap-2 text-red-700">
                                        <AlertCircle size={18} />
                                        <span>Bez współrzędnych</span>
                                    </div>
                                    <span className="font-bold text-red-700">{leadsMissingCoords.length}</span>
                                </div>
                                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <div className="flex items-center gap-2 text-blue-700">
                                        <CheckCircle size={18} />
                                        <span>Gotowe do geokodowania</span>
                                    </div>
                                    <span className="font-bold text-blue-700">{leadsWithAddressOnly.length}</span>
                                </div>

                                <button
                                    onClick={handleStartGeocoding}
                                    disabled={processing || leadsWithAddressOnly.length === 0 || !geocoding}
                                    className={`
                                        w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all
                                        ${processing || leadsWithAddressOnly.length === 0
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-blue-500/30'}
                                    `}
                                >
                                    {processing ? <Loader2 className="animate-spin" /> : <Play size={18} />}
                                    {processing ? 'Przetwarzanie...' : 'Rozpocznij Geokodowanie'}
                                </button>
                                {!geocoding && !loading && (
                                    <p className="text-xs text-center text-red-500">Biblioteka Geocoding niedostępna. Sprawdź API Key.</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Progress & Logs */}
                    <div className="bg-gray-900 rounded-xl shadow-lg p-6 text-gray-300 font-mono text-sm flex flex-col h-[400px]">
                        <div className="mb-4 flex justify-between items-end border-b border-gray-700 pb-2">
                            <span className="font-bold text-white">Konsola Systemowa</span>
                            {processing && (
                                <span className="text-blue-400">
                                    {Math.round((progress.current / progress.total) * 100)}%
                                </span>
                            )}
                        </div>

                        {processing && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs mb-1">
                                    <span>Postęp: {progress.current}/{progress.total}</span>
                                    <span className="text-green-400">Sukces: {progress.updated}</span>
                                    <span className="text-red-400">Błędy: {progress.failed}</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-600">
                            {logs.length === 0 && <span className="text-gray-600 italic">Oczekiwanie na zadania...</span>}
                            {logs.map((log, i) => (
                                <div key={i} className="break-words">
                                    <span className="text-gray-500 text-xs mr-2">[{new Date().toLocaleTimeString()}]</span>
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* List of Missing Coords */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-semibold text-gray-700">Leady wymagające aktualizacji ({leadsWithAddressOnly.length})</h3>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Firma</th>
                                    <th className="px-6 py-3">Adres</th>
                                    <th className="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {leadsWithAddressOnly.map(lead => (
                                    <tr key={lead.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 font-medium text-gray-900">{lead.companyName}</td>
                                        <td className="px-6 py-3 text-gray-600">{lead.address}</td>
                                        <td className="px-6 py-3">
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                                                Do pobrania
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {leadsWithAddressOnly.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
                                            Wszystkie leady mają poprawne współrzędne.
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
};

export default function GeocodingPage() {
    return (
        <APIProvider apiKey={API_KEY}>
            <GeocodingContent />
        </APIProvider>
    );
}
