import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function DELETE(request: NextRequest) {
    try {
        // Verify admin authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        // Only allow ostasz@mac.com to delete all data
        if (decodedToken.email !== 'ostasz@mac.com') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Delete all documents
        const snapshot = await adminDb.collection('energy_prices').get();
        const batchSize = 100;
        let deleted = 0;

        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
            const batch = adminDb.batch();
            const docsToDelete = snapshot.docs.slice(i, i + batchSize);

            docsToDelete.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            deleted += docsToDelete.length;
        }

        return NextResponse.json({
            success: true,
            deleted,
            message: `Deleted ${deleted} documents`
        });

    } catch (error: any) {
        console.error('Error deleting energy prices:', error);
        return NextResponse.json(
            { error: 'Delete failed', details: error.message },
            { status: 500 }
        );
    }
}
