import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/auth';

const prisma = new PrismaClient();

export async function GET() {
    const session = await auth();
    // @ts-ignore
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isBlocked: true,
                createdAt: true,
            },
        });
        return NextResponse.json({ users });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const session = await auth();
    // @ts-ignore
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    try {
        // Prevent deleting self (optional but good practice)
        if (id === session?.user?.id) {
            return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
        }

        await prisma.user.delete({
            where: { id },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const session = await auth();
    // @ts-ignore
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, isBlocked } = body;

        if (!id || typeof isBlocked !== 'boolean') {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        // Prevent blocking self
        // @ts-ignore
        if (id === session.user.id) {
            return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
        }

        const user = await prisma.user.update({
            where: { id },
            data: { isBlocked },
        });

        return NextResponse.json({ user });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

