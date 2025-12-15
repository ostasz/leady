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
        const limit = parseInt(searchParams.get('limit') || '50');
        const lastDocId = searchParams.get('lastDocId');

        console.log('API: leads/GET called. Params:', { status, priority, search, limit, lastDocId });

        let query: FirebaseFirestore.Query;

        if (userData?.role === 'admin') {
            // OPTIMIZATION 1: Use collectionGroup for Admin
            // This fetches from ALL 'leads' collections across the database in one query
            query = adminDb.collectionGroup('leads');
        } else {
            // Regular users see only their own leads
            query = adminDb.collection('users').doc(uid).collection('leads');
        }

        // TEMPORARY FIX: Remove server-side filters to avoid "Missing Index" errors 
        // until indexes are created in Firebase Console.
        // if (status && status !== 'all') query = query.where('status', '==', status);
        // if (priority && priority !== 'all') query = query.where('priority', '==', priority);

        // Sorting
        query = query.orderBy('createdAt', 'desc');

        // Note: Searching for 'companyName' via simple query is limited in Firestore. 
        // We might need to filter manually if search term is provided, OR rely on a dedicated search index (Algolia/Typesense)
        // For now, we will fetch and filter on server if search is present, potentially breaking pagination consistency.
        // A better approach for scalability is a dedicated search solution.
        // If no search is present, we use native pagination.

        // OPTIMIZATION 2: Pagination
        if (!search) {
            if (lastDocId && lastDocId !== 'null') {
                // We need to get the actual document snapshot to start after
                // Trying to start after ID directly requires finding that doc first or using values
                // For simplified cursor pagination if we sort by createdAt + ID:
                // However, getting the doc snapshot is safer.

                // Optimized approach: Use the document snapshot if possible, or fetch it.
                // Since this is a server environemnt, fetching the single doc for cursor is fast.
                // BUT collectionGroup cursors are tricky because we don't know the path easily.
                // We'll rely on the frontend sending the *full* data needed for cursor if complex,
                // or just efficient fetching.

                // Simplest robust method for 'startAfter' with ID for an arbitrary query is tricky without the snapshot.
                // Let's assume the client sends the last createdAt string if we sort by that.
                // But simplified: We'll implement basic limit for now, and if cursor needed we fetch it.
                // Given we are refactoring, let's try to keep it simple first.
                // If we have lastDocId, we need to find that doc to use as cursor.
                // If it's a collectionGroup query, `doc(lastDocId)` won't work directly without path.

                // Let's stick to 'limit' for now to solve the "load ALL" problem.
                // True infinite scroll requires holding the 'lastVisible' snapshot on the client (not possible with API) 
                // or passing sort values (createdAt).
                const lastCreatedAt = searchParams.get('lastCreatedAt');
                if (lastCreatedAt && lastCreatedAt !== 'null') {
                    query = query.startAfter(Timestamp.fromDate(new Date(lastCreatedAt)));
                }
            }
            query = query.limit(limit);
        }

        const snapshot = await query.get();

        // If searching, we currently have to do it in memory if we don't have a search engine
        // This negates the pagination benefit if search is active on a huge dataset, 
        // but solves the main "dashboard load" use case.
        let results: any[] = [];
        const ownerIds = new Set<string>();

        snapshot.docs.forEach((doc: any) => {
            const data = doc.data();
            const ownerId = userData?.role === 'admin' ? doc.ref.path.split('/')[1] : uid;
            if (userData?.role === 'admin') {
                ownerIds.add(ownerId);
            }
            results.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate().toISOString(),
                updatedAt: data.updatedAt?.toDate().toISOString(),
                // If admin, we might want owner info. collectionGroup docs have `.ref.parent.parent` which is the user doc.
                ownerId
            });
        });

        // Enrich with owner info for admins
        if (userData?.role === 'admin' && ownerIds.size > 0) {
            try {
                const userDocs = await Promise.all(
                    Array.from(ownerIds).map(id => adminDb.collection('users').doc(id).get())
                );

                const userMap = new Map();
                userDocs.forEach(doc => {
                    if (doc.exists) {
                        userMap.set(doc.id, doc.data());
                    }
                });

                results = results.map(lead => {
                    if (lead.ownerId && userMap.has(lead.ownerId)) {
                        const user = userMap.get(lead.ownerId);
                        return {
                            ...lead,
                            ownerEmail: user.email,
                            ownerName: user.name || user.displayName // Handle potential naming differences
                        };
                    }
                    return lead;
                });
            } catch (err) {
                console.error('Error fetching owner details:', err);
                // Continue without owner info if fetch fails
            }
        }


        // Client-side filtering (Server filters disabled for stability)
        if (status && status !== 'all') results = results.filter(l => l.status === status);
        if (priority && priority !== 'all') results = results.filter(l => l.priority === priority);

        if (search) {
            results = results.filter(lead =>
                lead.companyName?.toLowerCase().includes(search.toLowerCase())
            );
        }

        const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
        let nextCreatedAt = null;
        if (lastVisible) {
            const data = lastVisible.data();
            nextCreatedAt = data.createdAt?.toDate().toISOString();
        }

        return NextResponse.json({
            leads: results,
            lastDocId: lastVisible ? lastVisible.id : null,
            lastCreatedAt: nextCreatedAt,
            hasMore: snapshot.docs.length === limit // Rough estimate
        });

    } catch (error: any) {
        console.error('SERVER ERROR fetching leads:', error);
        // Return 500 but with message
        return NextResponse.json({
            error: error.message,
            details: error.code === 9 ? 'Missing Firestore Index. Check server terminal for link.' : 'Unknown error'
        }, { status: 500 });
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
            regon,
            pkd,
            status = 'new',
            priority = 'medium',
            notes,
            keyPeople = [],
            revenue,
            employees,
            socials,
            description,
            technologies = [],
            openingHours,
            scheduledDate,
            latitude,
            longitude
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
            regon: regon || null,
            pkd: pkd || [],
            status,
            priority,
            notes: notes || null,
            keyPeople,
            revenue: revenue || null,
            employees: employees || null,
            socials: socials || null,
            description: description || null,
            technologies,
            openingHours: openingHours || null,
            scheduledDate: scheduledDate || null,
            latitude: latitude || null,
            longitude: longitude || null,
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
