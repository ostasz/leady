import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
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
