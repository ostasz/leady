'use client';

import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Mail } from 'lucide-react';
import Link from 'next/link';

export default function ResetPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Check email domain (allow @ekovoltis.pl or whitelisted emails)
        const allowedEmails = ['ostasz@mac.com'];
        if (!email.endsWith('@ekovoltis.pl') && !allowedEmails.includes(email.toLowerCase())) {
            setError('Resetowanie hasła dostępne tylko dla pracowników Ekovoltis (@ekovoltis.pl)');
            setLoading(false);
            return;
        }

        try {
            const actionCodeSettings = {
                url: window.location.origin + '/auth-action',
                handleCodeInApp: false,
            };

            await sendPasswordResetEmail(auth, email, actionCodeSettings);
            setSuccess(true);
        } catch (err: any) {
            console.error('Password reset error:', err);
            if (err.code === 'auth/user-not-found') {
                setError('Nie znaleziono użytkownika z tym adresem email');
            } else if (err.code === 'auth/invalid-email') {
                setError('Nieprawidłowy format adresu email');
            } else if (err.code === 'auth/unauthorized-continue-uri') {
                setError('Domena nie jest autoryzowana w Firebase. Dodaj ją w konsoli Firebase (Authentication -> Settings -> Authorized domains).');
            } else {
                setError(`Wystąpił błąd: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                    <div className="flex flex-col items-center">
                        <Mail className="text-primary mb-4" size={64} />
                        <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">
                            Email wysłany!
                        </h1>
                        <p className="text-gray-600 text-center mb-6">
                            Jeśli konto z adresem <span className="font-semibold">{email}</span> istnieje,
                            wysłaliśmy na nie link do resetowania hasła.
                        </p>
                        <p className="text-gray-500 text-sm text-center mb-6">
                            Sprawdź swoją skrzynkę pocztową i kliknij link aby zresetować hasło.
                        </p>
                        <Link
                            href="/login"
                            className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors font-semibold text-center"
                        >
                            Wróć do logowania
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Resetuj hasło</h1>
                <p className="text-gray-600 text-center mb-6">
                    Podaj swój adres email, a wyślemy Ci link do resetowania hasła.
                </p>
                {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                required
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-2 rounded-lg hover:bg-primary-dark transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Wysyłanie...' : 'Wyślij link resetujący'}
                    </button>
                </form>
                <p className="mt-4 text-center text-sm text-gray-600">
                    Pamiętasz hasło?{' '}
                    <Link href="/login" className="text-primary hover:underline">
                        Zaloguj się
                    </Link>
                </p>
            </div>
        </div>
    );
}
