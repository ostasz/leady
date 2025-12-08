import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
    try {
        // Get Firebase Auth token
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        // Check if user is admin
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        // Get all users
        const usersSnapshot = await adminDb.collection('users')
            .orderBy('createdAt', 'desc')
            .get();

        const users = usersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                email: data.email,
                role: data.role,
                isBlocked: data.isBlocked,
                searchCount: data.searchCount,
                lastLogin: data.lastLogin?.toDate?.()?.toISOString() || null,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                usageStats: data.usageStats
            };
        });

        return NextResponse.json({ users });
    } catch (error: any) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        // Get Firebase Auth token
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        // Check if user is admin
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        // Prevent deleting self
        if (id === uid) {
            return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
        }

        // Delete user from Firestore
        await adminDb.collection('users').doc(id).delete();

        // Delete user from Firebase Auth
        try {
            await adminAuth.deleteUser(id);
        } catch (authError) {
            console.warn('User not found in Auth or already deleted:', authError);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting user:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        // Get Firebase Auth token
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        // Check if user is admin
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        const body = await request.json();
        const { id, isBlocked } = body;

        if (!id || typeof isBlocked !== 'boolean') {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        // Prevent blocking self
        if (id === uid) {
            return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
        }

        // Update user in Firestore
        await adminDb.collection('users').doc(id).update({
            isBlocked,
            updatedAt: new Date()
        });

        // Optionally disable user in Firebase Auth
        if (isBlocked) {
            try {
                await adminAuth.updateUser(id, { disabled: true });
            } catch (authError) {
                console.warn('Could not disable user in Auth:', authError);
            }
        } else {
            try {
                await adminAuth.updateUser(id, { disabled: false });
            } catch (authError) {
                console.warn('Could not enable user in Auth:', authError);
            }
        }

        const updatedDoc = await adminDb.collection('users').doc(id).get();
        const data = updatedDoc.data();
        const user = {
            id: updatedDoc.id,
            ...data,
            createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
            updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null
        };

        return NextResponse.json({ user });
    } catch (error: any) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}
