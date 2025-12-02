'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, Building2, MapPin, FileText, ArrowLeft } from 'lucide-react';

interface CompanyData {
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
}

export default function GusPage() {
    const [nip, setNip] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CompanyData | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nip) return;

        setLoading(true);
        setError(null);
        setData(null);

        try {
            const response = await fetch(`/api/gus?nip=${nip}`);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to fetch data');
            }

            setData(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <Link href="/apps/leads" className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                        Wróć do portalu
                    </Link>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-2">
                    <Building2 className="h-8 w-8 text-blue-600" />
                    GUS Data Checker
                </h1>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <form onSubmit={handleSearch} className="flex gap-4">
                        <div className="flex-1">
                            <label htmlFor="nip" className="sr-only">NIP Number</label>
                            <input
                                type="text"
                                id="nip"
                                value={nip}
                                onChange={(e) => setNip(e.target.value)}
                                placeholder="Enter NIP (e.g., 5261040828)"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !nip}
                            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Search className="h-5 w-5" />
                            )}
                            Search
                        </button>
                    </form>
                    {error && (
                        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}
                </div>

                {data && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-xl font-semibold text-gray-900">{data.name}</h2>
                        </div>
                        <div className="p-6 grid gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <div className="text-sm text-gray-500 flex items-center gap-1">
                                        <FileText className="h-4 w-4" /> NIP
                                    </div>
                                    <div className="font-medium text-gray-900">{data.nip}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-sm text-gray-500 flex items-center gap-1">
                                        <FileText className="h-4 w-4" /> REGON
                                    </div>
                                    <div className="font-medium text-gray-900">{data.regon}</div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                    <MapPin className="h-4 w-4" /> Address
                                </div>
                                <div className="font-medium text-gray-900">
                                    {data.address}<br />
                                    {data.zipCode} {data.city}<br />
                                    {data.province}
                                </div>
                            </div>

                            {(data.email || data.phone) && (
                                <div className="space-y-1 pt-2 border-t border-gray-100 mt-2">
                                    {data.email && (
                                        <div className="text-sm flex items-center gap-2">
                                            <span className="text-gray-500">Email:</span>
                                            <a href={`mailto:${data.email}`} className="text-blue-600 hover:underline">{data.email}</a>
                                        </div>
                                    )}
                                    {data.phone && (
                                        <div className="text-sm flex items-center gap-2">
                                            <span className="text-gray-500">Phone:</span>
                                            <a href={`tel:${data.phone}`} className="text-gray-900 hover:text-blue-600">{data.phone}</a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* PKD Section */}
                        {data.pkd && data.pkd.length > 0 && (
                            <div className="p-6 border-t border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-500 mb-3">PKD Codes</h3>
                                <div className="flex flex-wrap gap-2">
                                    {data.pkd.map((code, index) => (
                                        <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {code}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Management Section */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50/50">
                            <h3 className="text-sm font-semibold text-gray-500 mb-3">Management / Representation</h3>
                            {data.management && data.management.length > 0 ? (
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {data.management.map((person, index) => (
                                        <li key={index} className="flex items-center gap-2 text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                                            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-medium text-xs">
                                                {person.charAt(0)}
                                            </div>
                                            {person}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-400 italic">
                                    Management data not available via public API for this entity.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
