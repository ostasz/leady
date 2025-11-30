import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

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
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const priority = searchParams.get('priority');
        const search = searchParams.get('search');

        // Build query
        let leadsQuery;

        if (userData?.role === 'admin') {
            // Admin can see all leads from all users
            const usersSnapshot = await adminDb.collection('users').get();
            const allLeads: any[] = [];

            for (const userDoc of usersSnapshot.docs) {
                const userLeadsRef = adminDb.collection('users').doc(userDoc.id).collection('leads');
                let userLeadsQuery: any = userLeadsRef;

                // Apply filters
                if (status) userLeadsQuery = userLeadsQuery.where('status', '==', status);
                if (priority) userLeadsQuery = userLeadsQuery.where('priority', '==', priority);

                const userLeadsSnapshot = await userLeadsQuery.orderBy('createdAt', 'desc').get();

                // Get user email
                const ownerEmail = userDoc.data()?.email || 'Unknown';

                userLeadsSnapshot.docs.forEach((doc: any) => {
                    const leadData = doc.data();
                    allLeads.push({
                        id: doc.id,
                        ...leadData,
                        createdAt: leadData.createdAt?.toDate().toISOString(),
                        updatedAt: leadData.updatedAt?.toDate().toISOString(),
                        ownerEmail: ownerEmail, // Add owner email for admin
                        ownerId: userDoc.id
                    });
                });
            }

            // Filter by search if needed
            const filteredLeads = search
                ? allLeads.filter(lead =>
                    lead.companyName?.toLowerCase().includes(search.toLowerCase())
                )
                : allLeads;

            return NextResponse.json({ leads: filteredLeads });
        } else {
            // Regular users see only their own leads
            const uid = decodedToken.uid;
            const userRef = adminDb.collection('users').doc(uid);
            const userLeadsRef = userRef.collection('leads');
            let userLeadsQuery: any = userLeadsRef;

            // Apply filters
            if (status) userLeadsQuery = userLeadsQuery.where('status', '==', status);
            if (priority) userLeadsQuery = userLeadsQuery.where('priority', '==', priority);

            const leadsSnapshot = await userLeadsQuery.orderBy('createdAt', 'desc').get();

            const leads: any[] = [];
            leadsSnapshot.docs.forEach((doc: any) => {
                const data = doc.data();
                leads.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
                    updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null
                });
            });

            // Filter by search if needed (Firestore doesn't support case-insensitive search)
            const filteredLeads = search
                ? leads.filter((lead: any) =>
                    lead.companyName?.toLowerCase().includes(search.toLowerCase())
                )
                : leads;

            return NextResponse.json({ leads: filteredLeads });
        }
    } catch (error: any) {
        console.error('Error fetching leads:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        // Get Firebase Auth token
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const body = await request.json();
        const {
            companyName,
            address,
            phone,
            website,
            nip,
            status = 'new',
            priority = 'medium',
            notes,
            keyPeople = [],
            revenue,
            employees,
            socials,
            description,
            technologies = []
        } = body;

        if (!companyName) {
            return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
        }

        // Create lead in user's subcollection
        const leadData = {
            companyName,
            address: address || null,
            phone: phone || null,
            website: website || null,
            nip: nip || null,
            status,
            priority,
            notes: notes || null,
            keyPeople,
            revenue: revenue || null,
            employees: employees || null,
            socials: socials || null,
            description: description || null,
            technologies,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        const leadsRef = adminDb.collection('users').doc(uid).collection('leads');
        const leadDoc = await leadsRef.add(leadData);

        const lead = {
            id: leadDoc.id,
            ...leadData,
            createdAt: leadData.createdAt.toDate().toISOString(),
            updatedAt: leadData.updatedAt.toDate().toISOString()
        };

        return NextResponse.json({ lead }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating lead:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
