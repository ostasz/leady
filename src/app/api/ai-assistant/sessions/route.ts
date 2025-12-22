
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

        const snapshot = await adminDb.collection('admin_chat_sessions')
            .where('userId', '==', uid)
            .orderBy('updatedAt', 'desc')
            .get();

        const sessions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert timestamps to ISO strings for JSON serialization
            createdAt: doc.data().createdAt?.toDate().toISOString(),
            updatedAt: doc.data().updatedAt?.toDate().toISOString()
        }));

        return NextResponse.json(sessions);

    } catch (error: any) {
        console.error('[AdminAI Sessions] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
