import { NextResponse } from 'next/server';
import { checkEmailsAndImport } from '@/lib/gmail';

// Vercel Cron logic usually requires a GET request
export async function GET() {
    try {
        const results = await checkEmailsAndImport();

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
