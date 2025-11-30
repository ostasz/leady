import { NextResponse } from 'next/server';

export async function GET() {
    const vars = [
        'FIREBASE_ADMIN_PROJECT_ID',
        'FIREBASE_ADMIN_CLIENT_EMAIL',
        'FIREBASE_ADMIN_PRIVATE_KEY',
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
    ];

    const status: Record<string, string> = {};

    vars.forEach(v => {
        const val = process.env[v];
        if (!val) {
            status[v] = '❌ MISSING';
        } else if (val.length < 10) {
            status[v] = '⚠️ TOO SHORT (Invalid?)';
        } else {
            status[v] = '✅ PRESENT';
        }
    });

    // Check private key format specifically
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    if (privateKey) {
        if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
            status['PRIVATE_KEY_FORMAT'] = '✅ VALID PEM HEADER';
        } else {
            status['PRIVATE_KEY_FORMAT'] = '❌ MISSING PEM HEADER';
        }

        if (privateKey.includes('\\n')) {
            status['PRIVATE_KEY_NEWLINES'] = '⚠️ CONTAINS LITERAL \\n (Should be handled by code)';
        } else if (privateKey.includes('\n')) {
            status['PRIVATE_KEY_NEWLINES'] = '✅ CONTAINS REAL NEWLINES';
        }
    }

    return NextResponse.json({
        environment: process.env.NODE_ENV,
        status
    });
}
