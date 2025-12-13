import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        if (!date) {
            return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
        }

        const docRef = adminDb
            .collection('users')
            .doc(uid)
            .collection('planner_settings')
            .doc(date);

        const doc = await docRef.get();

        if (doc.exists) {
            return NextResponse.json(doc.data());
        } else {
            // Default settings if no data found for this date
            // User requested default is "Warszawa"
            return NextResponse.json({
                start: 'Warszawa',
                end: 'Warszawa',
                order: []
            });
        }
    } catch (error: any) {
        console.error('Error fetching planner settings:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const body = await request.json();
        const { date, start, end, order } = body;

        if (!date) {
            return NextResponse.json({ error: 'Date is required' }, { status: 400 });
        }

        const docRef = adminDb
            .collection('users')
            .doc(uid)
            .collection('planner_settings')
            .doc(date);

        // Treat empty strings as 'Warszawa' if desired, but frontend usually handles display.
        // For persistence, we save what is given, or defaults if completely missing.
        const dataToSave = {
            start: start || 'Warszawa',
            end: end || 'Warszawa',
            order: order || [],
            updatedAt: new Date().toISOString()
        };

        await docRef.set(dataToSave, { merge: true });

        return NextResponse.json({ success: true, data: dataToSave });
    } catch (error: any) {
        console.error('Error saving planner settings:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
