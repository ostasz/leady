import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const where: any = {};
        // @ts-ignore
        if (session.user.role !== 'admin') {
            where.userId = session.user.id;
        }

        const leads = await prisma.lead.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

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

        const rows = leads.map(lead => [
            lead.companyName,
            lead.address || '',
            lead.phone || '',
            lead.website || '',
            lead.nip || '',
            lead.status,
            lead.priority,
            lead.notes || '',
            lead.keyPeople.join('; '),
            lead.revenue || '',
            lead.employees || '',
            lead.description || '',
            lead.technologies.join('; '),
            lead.createdAt.toISOString(),
            lead.updatedAt.toISOString()
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
