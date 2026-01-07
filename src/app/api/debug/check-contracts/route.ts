import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
    // Enforce Authentication
    const auth = await verifyAuth(request);
    if (!auth.authorized) return auth.error!;

    try {
        const snap = await adminDb.collection('futures_data').select('contract').get();
        const contracts = new Set(snap.docs.map(d => d.data().contract));

        // Filter and sort for clarity
        const sorted = Array.from(contracts).sort();
        const peakContracts = sorted.filter(c => c.toUpperCase().includes('PEAK'));
        const baseContracts = sorted.filter(c => c.toUpperCase().includes('BASE')).slice(0, 10); // Check first 10

        return NextResponse.json({
            totalUnique: contracts.size,
            peakCount: peakContracts.length,
            peakSamples: peakContracts.slice(0, 50), // Show samples
            baseSamples: baseContracts
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
