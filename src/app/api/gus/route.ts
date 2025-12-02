import { NextRequest, NextResponse } from 'next/server';
import { GusClient } from '@/lib/gus-client';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const nip = searchParams.get('nip');

    if (!nip) {
        return NextResponse.json({ error: 'NIP parameter is required' }, { status: 400 });
    }

    try {
        const client = new GusClient();
        const data = await client.searchByNip(nip);

        if (!data) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
