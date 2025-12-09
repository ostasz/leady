import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { to, subject, text } = body;

        if (!to || !subject || !text) {
            return NextResponse.json(
                { error: 'Missing required fields: to, subject, text' },
                { status: 400 }
            );
        }

        const result = await sendEmail({
            to,
            subject,
            text,
        });

        return NextResponse.json({ success: true, result }, { status: 200 });
    } catch (error: any) {
        console.error('Email sending error:', error);
        return NextResponse.json(
            { error: 'Failed to send email', details: error.message },
            { status: 500 }
        );
    }
}
