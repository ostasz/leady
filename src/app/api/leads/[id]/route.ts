import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;

        const lead = await prisma.lead.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // @ts-ignore
        if (lead.userId !== session.user.id && session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ lead });
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
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;

        const existingLead = await prisma.lead.findUnique({
            where: { id }
        });

        if (!existingLead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // @ts-ignore
        if (existingLead.userId !== session.user.id && session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const {
            status,
            priority,
            notes,
            companyName,
            address,
            phone,
            website,
            nip
        } = body;

        const lead = await prisma.lead.update({
            where: { id },
            data: {
                ...(status && { status }),
                ...(priority && { priority }),
                ...(notes !== undefined && { notes }),
                ...(companyName && { companyName }),
                ...(address !== undefined && { address }),
                ...(phone !== undefined && { phone }),
                ...(website !== undefined && { website }),
                ...(nip !== undefined && { nip })
            }
        });

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
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params;

        const existingLead = await prisma.lead.findUnique({
            where: { id }
        });

        if (!existingLead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // @ts-ignore
        if (existingLead.userId !== session.user.id && session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.lead.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting lead:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
