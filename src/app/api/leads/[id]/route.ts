import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // Get Firebase Auth token
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const { id } = await context.params;

        // Get user data to check role
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();

        // Try to find lead in user's subcollection first
        const leadDoc = await adminDb.collection('users').doc(uid).collection('leads').doc(id).get();

        if (leadDoc.exists) {
            // Found in user's leads
            const leadData = leadDoc.data();
            const lead = {
                id: leadDoc.id,
                ...leadData,
                createdAt: leadData?.createdAt?.toDate?.()?.toISOString() || null,
                updatedAt: leadData?.updatedAt?.toDate?.()?.toISOString() || null,
                user: {
                    name: userData?.name,
                    email: userData?.email
                }
            };
            return NextResponse.json({ lead });
        }

        // If not found and user is admin, search all users
        if (userData?.role === 'admin') {
            const usersSnapshot = await adminDb.collection('users').get();

            for (const userDoc of usersSnapshot.docs) {
                const leadDoc = await adminDb.collection('users').doc(userDoc.id).collection('leads').doc(id).get();
                if (leadDoc.exists) {
                    const leadData = leadDoc.data();
                    const lead = {
                        id: leadDoc.id,
                        ...leadData,
                        createdAt: leadData?.createdAt?.toDate?.()?.toISOString() || null,
                        updatedAt: leadData?.updatedAt?.toDate?.()?.toISOString() || null,
                        user: {
                            name: userDoc.data().name,
                            email: userDoc.data().email
                        }
                    };
                    return NextResponse.json({ lead });
                }
            }
        }

        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    } catch (error: any) {
        console.error('Error fetching lead:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // Get Firebase Auth token
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const { id } = await context.params;

        // Get user data to check role
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();

        // Check if lead exists in user's subcollection
        const leadRef = adminDb.collection('users').doc(uid).collection('leads').doc(id);
        const leadDoc = await leadRef.get();

        if (!leadDoc.exists) {
            // If not found and user is admin, search all users
            if (userData?.role === 'admin') {
                const usersSnapshot = await adminDb.collection('users').get();

                for (const userDoc of usersSnapshot.docs) {
                    const adminLeadRef = adminDb.collection('users').doc(userDoc.id).collection('leads').doc(id);
                    const adminLeadDoc = await adminLeadRef.get();

                    if (adminLeadDoc.exists) {
                        const body = await request.json();
                        const updateData: any = {
                            updatedAt: Timestamp.now()
                        };

                        if (body.status) updateData.status = body.status;
                        if (body.priority) updateData.priority = body.priority;
                        if (body.notes !== undefined) updateData.notes = body.notes;
                        if (body.companyName) updateData.companyName = body.companyName;
                        if (body.address !== undefined) updateData.address = body.address;
                        if (body.phone !== undefined) updateData.phone = body.phone;
                        if (body.website !== undefined) updateData.website = body.website;
                        if (body.nip !== undefined) updateData.nip = body.nip;

                        await adminLeadRef.update(updateData);

                        const updatedDoc = await adminLeadRef.get();
                        const leadData = updatedDoc.data();
                        const lead = {
                            id: updatedDoc.id,
                            ...leadData,
                            createdAt: leadData?.createdAt?.toDate?.()?.toISOString() || null,
                            updatedAt: leadData?.updatedAt?.toDate?.()?.toISOString() || null
                        };

                        return NextResponse.json({ lead });
                    }
                }
            }
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        const body = await request.json();
        const updateData: any = {
            updatedAt: Timestamp.now()
        };

        if (body.status) updateData.status = body.status;
        if (body.priority) updateData.priority = body.priority;
        if (body.notes !== undefined) updateData.notes = body.notes;
        if (body.companyName) updateData.companyName = body.companyName;
        if (body.address !== undefined) updateData.address = body.address;
        if (body.phone !== undefined) updateData.phone = body.phone;
        if (body.website !== undefined) updateData.website = body.website;
        if (body.nip !== undefined) updateData.nip = body.nip;

        await leadRef.update(updateData);

        const updatedDoc = await leadRef.get();
        const leadData = updatedDoc.data();
        const lead = {
            id: updatedDoc.id,
            ...leadData,
            createdAt: leadData?.createdAt?.toDate?.()?.toISOString() || null,
            updatedAt: leadData?.updatedAt?.toDate?.()?.toISOString() || null
        };

        return NextResponse.json({ lead });
    } catch (error: any) {
        console.error('Error updating lead:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        // Get Firebase Auth token
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const { id } = await context.params;

        // Get user data to check role
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();

        // Check if lead exists in user's subcollection
        const leadRef = adminDb.collection('users').doc(uid).collection('leads').doc(id);
        const leadDoc = await leadRef.get();

        if (!leadDoc.exists) {
            // If not found and user is admin, search all users
            if (userData?.role === 'admin') {
                const usersSnapshot = await adminDb.collection('users').get();

                for (const userDoc of usersSnapshot.docs) {
                    const adminLeadRef = adminDb.collection('users').doc(userDoc.id).collection('leads').doc(id);
                    const adminLeadDoc = await adminLeadRef.get();

                    if (adminLeadDoc.exists) {
                        await adminLeadRef.delete();
                        return NextResponse.json({ success: true });
                    }
                }
            }
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        await leadRef.delete();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting lead:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
