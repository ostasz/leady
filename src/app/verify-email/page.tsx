'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { sendEmailVerification } from 'firebase/auth';
import { Mail, RefreshCw } from 'lucide-react';

export default function VerifyEmailPage() {
    const { user, signOut } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!user) {
            router.push('/login');
        } else if (user.emailVerified) {
            router.push('/');
        }
    }, [user, router]);

    const handleResendEmail = async () => {
        if (!user) return;

        try {
            await sendEmailVerification(user);
            alert('Email weryfikacyjny został wysłany ponownie! Sprawdź swoją skrzynkę.');
        } catch (error) {
            console.error('Error sending verification email:', error);
            alert('Nie udało się wysłać emaila. Spróbuj ponownie za chwilę.');
        }
    };

    const handleRefresh = async () => {
        if (!user) return;

        await user.reload();
        if (user.emailVerified) {
            router.push('/');
        } else {
            alert('Email jeszcze nie został zweryfikowany. Sprawdź swoją skrzynkę pocztową.');
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <div className="flex flex-col items-center">
                    <Mail className="text-primary mb-4" size={64} />
                    <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">
                        Zweryfikuj swój adres email
                    </h1>
                    <p className="text-gray-600 text-center mb-6">
                        Wysłaliśmy wiadomość weryfikacyjną na adres:
                    </p>
                    <p className="text-primary font-semibold mb-6">{user.email}</p>
                    <p className="text-gray-600 text-center mb-8">
                        Kliknij link w emailu aby zweryfikować swoje konto. Po kliknięciu linku wróć tutaj i kliknij "Odśwież".
                    </p>

                    <div className="flex flex-col gap-3 w-full">
                        <button
                            onClick={handleRefresh}
                            className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors font-semibold flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={18} />
                            Odśwież status
                        </button>

                        <button
                            onClick={handleResendEmail}
                            className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                        >
                            Wyślij email ponownie
                        </button>

                        <button
                            onClick={() => signOut()}
                            className="w-full text-red-500 hover:text-red-700 mt-2 underline text-sm"
                        >
                            Wyloguj się
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
