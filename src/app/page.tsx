'use client';

import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search, Shield, LogOut, User, Building2, Zap, Cloud, Briefcase, Map as MapIcon, Bot } from 'lucide-react';
import DashboardWidgets from '@/components/DashboardWidgets';
import CardScanner from '@/components/admin/CardScanner';
import { ScanLine } from 'lucide-react';

export default function Dashboard() {
    const { user, userData, loading, signOut } = useAuth();
    const router = useRouter();
    const [leadStats, setLeadStats] = useState({ total: 0, unscheduled: 0 });

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
        if (user) {
            fetchLeadStats();
        }
    }, [user, loading, router]);

    const fetchLeadStats = async () => {
        try {
            const res = await fetch('/api/leads/stats', {
                headers: {
                    'Authorization': `Bearer ${await user?.getIdToken()}`
                }
            });
            const data = await res.json();
            if (data) {
                setLeadStats({
                    total: data.total || 0,
                    unscheduled: data.unscheduled || 0
                });
            }
        } catch (e) {
            console.error('Failed to fetch lead stats', e);
        }
    };

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
                        <span className="text-xl font-semibold text-gray-700 hidden md:inline">| Portal Handlowca</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-gray-600">
                            <User size={18} />
                            <span className="text-sm font-medium hidden sm:inline">{user.displayName || user.email}</span>
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
                {/* Hero Banner */}
                <div className="relative rounded-2xl overflow-hidden mb-8 shadow-sm group h-48">
                    <Image
                        src="/dashboard-cover.png"
                        alt="Ekovoltis Cover"
                        fill
                        className="object-cover object-center"
                        priority
                    />
                    <div className="absolute inset-0 flex flex-col justify-center px-8">
                        <div className="backdrop-blur-md bg-white/10 border border-white/20 p-6 rounded-2xl shadow-lg max-w-xl">
                            <h1 className="text-3xl font-bold text-white mb-2 drop-shadow-md">
                                Witaj, {user.displayName?.split(' ')[0] || user.email || 'Pracowniku'}!
                            </h1>
                            <p className="text-gray-100 text-lg drop-shadow">
                                Wybierz aplikację, z której chcesz skorzystać.
                            </p>
                        </div>
                    </div>
                </div>

                <DashboardWidgets />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">


                    {/* Sales App Card */}
                    <Link
                        href="/apps/leads"
                        className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-primary/20"
                    >
                        <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 mb-4 group-hover:bg-[#C5FAEA] transition-all duration-300">
                            <img src="/call-center-icon.png" alt="Leady" className="h-10 w-10 object-contain" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Leady Sprzedażowe</h3>
                        <p className="text-gray-500 text-sm">
                            Wyszukiwanie potencjalnych klientów, analiza AI i zarządzanie bazą kontaktów.
                        </p>
                    </Link>

                    {/* My Leads Card */}
                    <Link
                        href="/my-leads"
                        className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-primary/20"
                    >
                        <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 mb-4 group-hover:bg-[#C5FAEA] transition-all duration-300">
                            <img src="/case-icon.png" alt="Moje Leady" className="h-10 w-10 object-contain" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Moje Leady</h3>
                        <p className="text-gray-500 text-sm">
                            Baza zapisanych klientów, statusy i notatki.
                        </p>
                    </Link>

                    {/* Route Planner Card */}
                    <Link
                        href="/apps/planner"
                        className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-primary/20"
                    >
                        <div className="flex justify-between items-start">
                            <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 mb-4 group-hover:bg-[#C5FAEA] transition-all duration-300">
                                <img src="/map-icon.png" alt="Planer Tras" className="h-10 w-10 object-contain" />
                            </div>
                            {leadStats.total > 0 && (
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Leady</span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-lg font-bold text-green-600">{leadStats.total}</span>
                                        <span className="text-xs text-gray-400">/</span>
                                        <span className="text-sm font-medium text-[#FF5500]" title="Nie zaplanowane">{leadStats.unscheduled}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-400">zapisane / do planowania</span>
                                </div>
                            )}
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
                            className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-primary/20"
                        >
                            <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 mb-4 group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all duration-300">
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
                        className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-primary/20"
                    >
                        <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 mb-4 group-hover:bg-[#C5FAEA] transition-all duration-300">
                            <img src="/rdn-trend-icon.png" alt="Ceny Energii" className="h-10 w-10 object-contain" />
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
                            className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-primary/20"
                        >
                            <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 mb-4 group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all duration-300">
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
                        className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-primary/20"
                    >
                        <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 mb-4 group-hover:bg-[#C5FAEA] transition-all duration-300">
                            <img src="/weather-icon.png" alt="Prognoza Pogody" className="h-10 w-10 object-contain" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Prognoza Pogody</h3>
                        <p className="text-gray-500 text-sm">
                            Szczegółowa prognoza pogody dla dowolnej lokalizacji.
                        </p>
                    </Link>

                    {/* AI Assistant Card */}
                    <Link
                        href="/apps/ai-assistant"
                        className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-primary/20"
                    >
                        <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 mb-4 group-hover:bg-[#C5FAEA] transition-all duration-300">
                            <img src="/ai-icon.png" alt="Asystent AI" className="h-10 w-10 object-contain" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Asystent AI</h3>
                        <p className="text-gray-500 text-sm">
                            Twój osobisty asystent do codziennej pracy.
                        </p>
                    </Link>

                    {/* Business Card Scanner (Admin Only) */}
                    {userData?.role === 'admin' && (
                        <CardScanner customTrigger={
                            <div className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100 hover:border-primary/20 cursor-pointer h-full">
                                <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 mb-4 group-hover:bg-[#C5FAEA] transition-all duration-300">
                                    <img src="/scan-icon.png" alt="Skaner Wizytówek" className="h-10 w-10 object-contain" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Skaner Wizytówek</h3>
                                <p className="text-gray-500 text-sm">
                                    Szybkie dodawanie kontaktów przez zdjęcie wizytówki.
                                </p>
                            </div>
                        } />
                    )}

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
