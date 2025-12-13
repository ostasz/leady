'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import { Search, Shield, LogOut, User, Building2, Zap, Cloud, Briefcase, Map as MapIcon } from 'lucide-react';
import DashboardWidgets from '@/components/DashboardWidgets';

export default function Dashboard() {
    const { user, userData, loading, signOut } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <img src="/ekovoltis-logo.png" alt="Ekovoltis" className="h-8" />
                        <span className="text-xl font-semibold text-gray-700">| Portal Handlowca</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-gray-600">
                            <User size={18} />
                            <span className="text-sm font-medium">{user.displayName || user.email}</span>
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                            title="Wyloguj"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Witaj, {user.displayName?.split(' ')[0] || user.email || 'Pracowniku'}! 👋</h1>
                    <p className="text-gray-600 mt-2">Wybierz aplikację, z której chcesz skorzystać.</p>
                </div>

                <DashboardWidgets />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Sales App Card */}
                    <Link
                        href="/apps/leads"
                        className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-primary/20"
                    >
                        <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                            <Search size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Leady Sprzedażowe</h3>
                        <p className="text-gray-500 text-sm">
                            Wyszukiwanie potencjalnych klientów, analiza AI i zarządzanie bazą kontaktów.
                        </p>
                    </Link>

                    {/* My Leads Card */}
                    <Link
                        href="/my-leads"
                        className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-indigo-500/20"
                    >
                        <div className="h-12 w-12 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                            <Briefcase size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Moje Leady</h3>
                        <p className="text-gray-500 text-sm">
                            Baza zapisanych klientów, statusy i notatki.
                        </p>
                    </Link>

                    {/* Route Planner Card */}
                    <Link
                        href="/apps/planner"
                        className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-green-500/20"
                    >
                        <div className="h-12 w-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600 mb-4 group-hover:scale-110 transition-transform">
                            <MapIcon size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Planer Tras</h3>
                        <p className="text-gray-500 text-sm">
                            Kalendarz spotkań, optymalizacja trasy i mapa.
                        </p>
                    </Link>

                    {/* Admin Panel Card (Visible to everyone, but protected inside) */}
                    {userData?.role === 'admin' && (
                        <Link
                            href="/admin"
                            className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-purple/20"
                        >
                            <div className="h-12 w-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                                <Shield size={24} />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Panel Administratora</h3>
                            <p className="text-gray-500 text-sm">
                                Zarządzanie użytkownikami, uprawnieniami i ustawieniami systemu.
                            </p>
                        </Link>
                    )}


                    {/* Energy Prices Card (Visible to everyone) */}
                    <Link
                        href="/apps/ceny-energii"
                        className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-yellow-500/20"
                    >
                        <div className="h-12 w-12 bg-yellow-50 rounded-lg flex items-center justify-center text-yellow-600 mb-4 group-hover:scale-110 transition-transform">
                            <Zap size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Obliczenie kosztu energii po RDN (FLEX)</h3>
                        <p className="text-gray-500 text-sm">
                            Ceny energii na rynku dnia następnego. Analizy i rekomendacje dla klientów.
                        </p>
                    </Link>



                    {/* GUS Data Checker Card (Admin Only) */}
                    {userData?.role === 'admin' && (
                        <Link
                            href="/gus"
                            className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-blue-500/20"
                        >
                            <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                                <Building2 size={24} />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">GUS Data Checker</h3>
                            <p className="text-gray-500 text-sm">
                                Weryfikacja danych firm w bazie GUS (NIP/REGON).
                            </p>
                        </Link>
                    )}

                    {/* Weather App Card (Visible to everyone) */}
                    <Link
                        href="/apps/weather"
                        className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-cyan-500/20"
                    >
                        <div className="h-12 w-12 bg-cyan-50 rounded-lg flex items-center justify-center text-cyan-600 mb-4 group-hover:scale-110 transition-transform">
                            <Cloud size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Prognoza Pogody</h3>
                        <p className="text-gray-500 text-sm">
                            Szczegółowa prognoza pogody dla dowolnej lokalizacji.
                        </p>
                    </Link>

                    {/* Placeholder for future apps */}
                    <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-center opacity-75">
                        <div className="h-12 w-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 mb-4">
                            <span className="text-xl font-bold">+</span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-500">Wkrótce więcej aplikacji</h3>
                    </div>
                </div>
            </main >
        </div >
    );
}
