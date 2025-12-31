import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { parseBusinessCard } from '@/lib/card-parser';
import { logInfo, logError } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        // 1. Auth Check (Admin Only)
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        // Strict Admin Check
        if (!decodedToken.admin && decodedToken.role !== 'admin' && decodedToken.email !== 'ostasz@mac.com') {
            return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
        }

        const requestId = crypto.randomUUID();
        logInfo('[ParseText] Request start', { requestId, uid: decodedToken.uid });

        // 2. Input Parsing & Validation
        const { text, language = 'pl' } = await request.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'No text provided' }, { status: 400 });
        }

        // Limit text length to prevent abuse/errors (e.g. 10k chars should be plenty for a footer)
        if (text.length > 10000) {
            return NextResponse.json({ error: 'Text too long (max 10k chars)' }, { status: 413 });
        }

        if (language !== 'pl' && language !== 'en') {
            return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
        }

        // 3. AI Processing
        const languageHints = language === 'pl' ? ['pl', 'en'] : ['en'];

        // Reuse the logic from card-parser (Vertex AI Gemini 2.5)
        const parsedData = await parseBusinessCard(text, languageHints);

        logInfo('[ParseText] Success', { requestId, model: parsedData.modelName });

        return NextResponse.json({
            success: true,
            data: parsedData
        });

    } catch (error: any) {
        logError('[ParseText] Error', { error: error.message });
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
