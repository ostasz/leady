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

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const priority = searchParams.get('priority');
        const search = searchParams.get('search');

        const where: any = {};

        // @ts-ignore
        if (session.user.role !== 'admin') {
            where.userId = session.user.id;
        }

        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (search) {
            where.companyName = {
                contains: search,
                mode: 'insensitive'
            };
        }

        const leads = await prisma.lead.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        return NextResponse.json({ leads });
    } catch (error: any) {
        console.error('Error fetching leads:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        const lead = await prisma.lead.create({
            data: {
                userId: session.user.id,
                companyName,
                address,
                phone,
                website,
                nip,
                status,
                priority,
                notes,
                keyPeople,
                revenue,
                employees,
                socials,
                description,
                technologies
            }
        });

        return NextResponse.json({ lead }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating lead:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
