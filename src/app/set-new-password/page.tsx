'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const auth = getAuth(app);

function SetNewPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');

    useEffect(() => {
        const oobCode = searchParams.get('oobCode');

        if (!oobCode) {
            setError('Nieprawidłowy link resetowania hasła');
            return;
        }

        // Verify the code and get the email
        verifyPasswordResetCode(auth, oobCode)
            .then((email) => {
                setEmail(email);
            })
            .catch((error) => {
                console.error('Error verifying reset code:', error);
                if (error.code === 'auth/expired-action-code') {
                    setError('Link resetowania hasła wygasł. Poproś o nowy link.');
                } else {
                    setError('Nieprawidłowy lub wygasły link.');
                }
            });
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Hasło musi mieć minimum 6 znaków');
            return;
        }

        if (password !== confirmPassword) {
            setError('Hasła nie są identyczne');
            return;
        }

        const oobCode = searchParams.get('oobCode');
        if (!oobCode) {
            setError('Nieprawidłowy link');
            return;
        }

        setLoading(true);

        try {
            await confirmPasswordReset(auth, oobCode, password);
            setSuccess(true);
            // Redirect to login after 3 seconds
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        } catch (err: any) {
            console.error('Password reset error:', err);
            if (err.code === 'auth/weak-password') {
                setError('Hasło jest zbyt słabe. Użyj minimum 6 znaków.');
            } else if (err.code === 'auth/expired-action-code') {
                setError('Link wygasł. Poproś o nowy link resetowania hasła.');
            } else {
                setError('Wystąpił błąd. Spróbuj ponownie.');
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
                        <CheckCircle className="text-green-500 mb-4" size={64} />
                        <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">
                            Hasło zmienione!
                        </h1>
                        <p className="text-gray-600 text-center mb-6">
                            Twoje hasło zostało pomyślnie zmienione.
                        </p>
                        <p className="text-gray-500 text-sm text-center mb-6">
                            Za chwilę zostaniesz przekierowany do strony logowania...
                        </p>
                        <Link
                            href="/login"
                            className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors font-semibold text-center"
                        >
                            Przejdź do logowania
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Ustaw nowe hasło</h1>
                {email && (
                    <p className="text-gray-600 text-center mb-6">
                        Resetowanie hasła dla: <span className="font-semibold">{email}</span>
                    </p>
                )}
                {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nowe hasło</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Minimum 6 znaków"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Potwierdź hasło</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                placeholder="Powtórz hasło"
                                required
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-2 rounded-lg hover:bg-primary-dark transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Zmieniam hasło...' : 'Zmień hasło'}
                    </button>
                </form>
                <p className="mt-4 text-center text-sm text-gray-600">
                    <Link href="/login" className="text-primary hover:underline">
                        Wróć do logowania
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default function SetNewPasswordPage() {
    return (
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Ładowanie...</div>}>
            <SetNewPasswordContent />
        </Suspense>
    );
}
