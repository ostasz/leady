'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { signIn } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        console.log('[LOGIN] Starting login process...');

        // Check email domain (allow @ekovoltis.pl or whitelisted emails)
        const allowedEmails = ['ostasz@mac.com'];
        if (!email.endsWith('@ekovoltis.pl') && !allowedEmails.includes(email.toLowerCase())) {
            setError('Logowanie dostępne tylko dla pracowników Ekovoltis (@ekovoltis.pl)');
            setLoading(false);
            return;
        }

        try {
            console.log('[LOGIN] Calling signIn...');
            await signIn(email, password);
            console.log('[LOGIN] signIn completed successfully');
            console.log('[LOGIN] Attempting redirect to /');
            window.location.href = '/';
            console.log('[LOGIN] window.location.href set');
        } catch (err: any) {
            console.error('[LOGIN] Login error:', err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('Nieprawidłowy email lub hasło');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Zbyt wiele prób. Spróbuj ponownie później.');
            } else {
                setError('Wystąpił błąd podczas logowania');
            }
        } finally {
            console.log('[LOGIN] Setting loading to false');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md transition-colors">
                <div className="flex justify-center mb-6">
                    <img src="/ekovoltis-logo.png" alt="Ekovoltis" className="h-12" />
                </div>
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-white">Logowanie</h1>
                {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hasło</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                                required
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-2 rounded-lg hover:bg-primary-dark transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Logowanie...' : 'Zaloguj się'}
                    </button>
                </form>
                <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                    <Link href="/reset-password" className="text-primary hover:underline">
                        Zapomniałeś hasła?
                    </Link>
                </p>
                <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                    Nie masz konta?{' '}
                    <Link href="/register" className="text-primary hover:underline">
                        Zarejestruj się
                    </Link>
                </p>
            </div>
        </div>
    );
}
