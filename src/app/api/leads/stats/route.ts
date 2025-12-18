import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
    try {
        // Get Firebase Auth token from header
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        // Get user data to check role
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();

        let query: FirebaseFirestore.Query;

        if (userData?.role === 'admin') {
            // Admin: Count ALL leads from all users
            query = adminDb.collectionGroup('leads');
        } else {
            // User: Count only their own leads
            query = adminDb.collection('users').doc(uid).collection('leads');
        }

        // Count Total
        const totalSnapshot = await query.count().get();
        const total = totalSnapshot.data().count;

        // Count Unscheduled (where scheduledDate is null)
        // Note: collectionGroup queries with filters require a composite index. 
        // If index is missing, this will fail. We'll return 0 in that case to not break the dashboard.
        let unscheduled = 0;
        try {
            const unscheduledSnapshot = await query.where('scheduledDate', '==', null).count().get();
            unscheduled = unscheduledSnapshot.data().count;
        } catch (err: any) {
            console.error('MISSING INDEX URL:', err.message);
            console.warn('Failed to count unscheduled leads (likely missing index):', err);
            // Ignore error, return 0
        }

        return NextResponse.json({
            total,
            unscheduled
        });

    } catch (error: any) {
        console.error('SERVER ERROR fetching lead stats:', error);
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
