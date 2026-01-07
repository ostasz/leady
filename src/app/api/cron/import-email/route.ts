import { NextRequest, NextResponse } from 'next/server';
import { checkEmailsAndImport } from '@/lib/gmail';
import { verifyCronSecret } from '@/lib/auth-middleware';

// Vercel Cron logic usually requires a GET request
export async function GET(request: NextRequest) {
    // Try CRON_SECRET first (for Vercel Cron Jobs)
    const cronAuth = await verifyCronSecret(request);

    // If CRON_SECRET fails, try Firebase ID Token (for admin UI)
    if (!cronAuth.authorized) {
        const { verifyAuth } = await import('@/lib/auth-middleware');
        const firebaseAuth = await verifyAuth(request);
        if (!firebaseAuth.authorized) {
            // Both auth methods failed
            return cronAuth.error!;
        }
    }

    try {
        const { searchParams } = new URL(request.url);
        const typeParam = searchParams.get('type');
        const targetType = (typeParam === 'RDN' || typeParam === 'FUTURES') ? typeParam : undefined;

        const results = await checkEmailsAndImport(targetType);

        return NextResponse.json({
            success: true,
            processed: results.length,
            details: results
        });
    } catch (error: any) {
        console.error('Gmail Import Cron Job Failed:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
