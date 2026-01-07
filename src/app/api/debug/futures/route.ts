import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
    // Enforce Authentication
    const auth = await verifyAuth(request);
    if (!auth.authorized) return auth.error!;

    try {
        console.log('Debug: List futures_data');
        const snapshot = await adminDb.collection('futures_data')
            .limit(50)
            .get();

        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({
            count: snapshot.size,
            data
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
