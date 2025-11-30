'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth, applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

const auth = getAuth(app);

function AuthActionContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const [mode, setMode] = useState<'verifyEmail' | 'resetPassword' | null>(null);

    useEffect(() => {
        const actionMode = searchParams.get('mode');
        const oobCode = searchParams.get('oobCode');

        if (!actionMode || !oobCode) {
            setStatus('error');
            setErrorMessage('Nieprawidłowy link');
            return;
        }

        if (actionMode === 'verifyEmail') {
            setMode('verifyEmail');
            handleVerifyEmail(oobCode);
        } else if (actionMode === 'resetPassword') {
            setMode('resetPassword');
            // For password reset, redirect to a page where user can set new password
            router.push(`/set-new-password?oobCode=${oobCode}`);
        } else {
            setStatus('error');
            setErrorMessage('Nieobsługiwana akcja');
        }
    }, [searchParams, router]);

    const handleVerifyEmail = async (code: string) => {
        try {
            await applyActionCode(auth, code);
            setStatus('success');
            // Auto redirect to login after 3 seconds
            setTimeout(() => {
                router.push('/login');
            }, 3000);
        } catch (error: any) {
            console.error('Email verification error:', error);
            setStatus('error');

            if (error.code === 'auth/invalid-action-code') {
                setErrorMessage('Link weryfikacyjny wygasł lub jest nieprawidłowy');
            } else if (error.code === 'auth/expired-action-code') {
                setErrorMessage('Link weryfikacyjny wygasł. Zaloguj się i wyślij nowy link.');
            } else {
                setErrorMessage('Wystąpił błąd podczas weryfikacji. Spróbuj ponownie.');
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <div className="flex flex-col items-center">
                    {status === 'loading' && (
                        <>
                            <Loader2 className="text-primary mb-4 animate-spin" size={64} />
                            <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">
                                Weryfikacja adresu email...
                            </h1>
                            <p className="text-gray-600 text-center">
                                Proszę czekać, weryfikujemy Twój adres email.
                            </p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <CheckCircle className="text-green-500 mb-4" size={64} />
                            <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">
                                Email zweryfikowany!
                            </h1>
                            <p className="text-gray-600 text-center mb-6">
                                Twój adres email został pomyślnie zweryfikowany.
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
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <XCircle className="text-red-500 mb-4" size={64} />
                            <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">
                                Błąd weryfikacji
                            </h1>
                            <p className="text-red-600 text-center mb-6">
                                {errorMessage}
                            </p>
                            <div className="flex flex-col gap-3 w-full">
                                <Link
                                    href="/login"
                                    className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors font-semibold text-center"
                                >
                                    Przejdź do logowania
                                </Link>
                                <Link
                                    href="/register"
                                    className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors font-semibold text-center"
                                >
                                    Zarejestruj się ponownie
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AuthActionPage() {
    return (
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Ładowanie...</div>}>
            <AuthActionContent />
        </Suspense>
    );
}
