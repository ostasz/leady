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

        // Get user data to check role
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        const allLeads: any[] = [];

        if (userData?.role === 'admin') {
            // Admin can export all leads
            const usersSnapshot = await adminDb.collection('users').get();

            for (const userDoc of usersSnapshot.docs) {
                const leadsSnapshot = await adminDb.collection('users').doc(userDoc.id).collection('leads')
                    .orderBy('createdAt', 'desc')
                    .get();

                leadsSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    allLeads.push({
                        ...data,
                        createdAt: data.createdAt?.toDate?.()?.toISOString() || '',
                        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || ''
                    });
                });
            }
        } else {
            // Regular user - only their leads
            const leadsSnapshot = await adminDb.collection('users').doc(uid).collection('leads')
                .orderBy('createdAt', 'desc')
                .get();

            leadsSnapshot.docs.forEach(doc => {
                const data = doc.data();
                allLeads.push({
                    ...data,
                    createdAt: data.createdAt?.toDate?.()?.toISOString() || '',
                    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || ''
                });
            });
        }

        // Convert to CSV
        const headers = [
            'Company Name',
            'Address',
            'Phone',
            'Website',
            'NIP',
            'Status',
            'Priority',
            'Notes',
            'Key People',
            'Revenue',
            'Employees',
            'Description',
            'Technologies',
            'Created At',
            'Updated At'
        ];

        const rows = allLeads.map(lead => [
            lead.companyName || '',
            lead.address || '',
            lead.phone || '',
            lead.website || '',
            lead.nip || '',
            lead.status || '',
            lead.priority || '',
            lead.notes || '',
            Array.isArray(lead.keyPeople) ? lead.keyPeople.join('; ') : '',
            lead.revenue || '',
            lead.employees || '',
            lead.description || '',
            Array.isArray(lead.technologies) ? lead.technologies.join('; ') : '',
            lead.createdAt,
            lead.updatedAt
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="leads_${new Date().toISOString().split('T')[0]}.csv"`
            }
        });
    } catch (error: any) {
        console.error('Error exporting leads:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
