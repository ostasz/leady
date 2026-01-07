import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

/**
 * Verify Firebase authentication token from request headers
 * @returns Object with authorization status, userId, and error response if unauthorized
 */
export async function verifyAuth(request: NextRequest): Promise<{
    authorized: boolean;
    userId?: string;
    error?: NextResponse;
}> {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
            authorized: false,
            error: NextResponse.json({ error: 'Unauthorized - Missing or invalid Authorization header' }, { status: 401 })
        };
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        return {
            authorized: true,
            userId: decodedToken.uid
        };
    } catch (error) {
        console.error('Token verification failed:', error);
        return {
            authorized: false,
            error: NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
        };
    }
}

/**
 * Verify Vercel Cron Secret for scheduled jobs
 * Accepts either CRON_SECRET (for manual calls) or x-vercel-cron header (for Vercel Cron)
 * @returns Object with authorization status and error response if unauthorized
 */
export async function verifyCronSecret(request: NextRequest): Promise<{
    authorized: boolean;
    error?: NextResponse;
}> {
    // Check for Vercel Cron header (automatic cron jobs)
    const vercelCronHeader = request.headers.get('x-vercel-cron');
    if (vercelCronHeader === '1') {
        return { authorized: true };
    }

    // Check for manual CRON_SECRET (for testing/manual calls)
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        console.error('CRON_SECRET not configured in environment variables');
        return {
            authorized: false,
            error: NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        };
    }

    if (authHeader === `Bearer ${expectedSecret}`) {
        return { authorized: true };
    }

    return {
        authorized: false,
        error: NextResponse.json({ error: 'Unauthorized - Invalid cron secret' }, { status: 401 })
    };
}

/**
 * Check if request is from development environment
 */
export function isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
}
