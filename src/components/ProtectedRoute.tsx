'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const PUBLIC_ROUTES = [
    '/login',
    '/register',
    '/verify-email',
    '/reset-password',
    '/set-new-password',
    '/auth-action'
];

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading) return;

        // Check if current path is public
        const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));

        if (!user && !isPublicRoute) {
            router.push('/login');
        }
    }, [user, loading, pathname, router]);

    // If loading, show spinner (or nothing to avoid flash)
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#009D8F]"></div>
            </div>
        );
    }

    // If not logged in and not public, don't render content (will redirect)
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));
    if (!user && !isPublicRoute) {
        return null; // Or return loading state
    }

    return <>{children}</>;
}
