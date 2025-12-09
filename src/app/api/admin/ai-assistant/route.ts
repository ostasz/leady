import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logUsage } from '@/lib/usage';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function POST(request: Request) {
    try {
        // --- 1. Authentication & Admin Check ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        const userDoc = await adminDb.collection('users').doc(uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // --- 2. Chat Logic ---
        const { messages } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(API_KEY || '');
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        // Construct history from previous messages, excluding the last one which is the new prompt
        const history = messages.slice(0, -1).map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        }));

        const lastMessage = messages[messages.length - 1].content;

        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{
                        text: `
                        Jesteś ekspertem rynku energii i asystentem sprzedaży w firmie Ekovoltis.
                        Twoim zadaniem jest pomagać handlowcom i administratorom w:
                        1. Pisaniu skutecznych maili sprzedażowych (cold mailing).
                        2. Tłumaczeniu zjawisk rynkowych (np. dlaczego RDN rośnie) w prosty sposób.
                        3. Zbijaniu obiekcji klientów (negocjacje).
                        4. Analizie danych o klientach.

                        Styl wypowiedzi: Profesjonalny, ale przystępny. Konkretny. Skupiony na korzyściach dla klienta końcowego.
                        Firma Ekovoltis zajmuje się sprzedażą energii elektrycznej, stawiając na transparentność i doradztwo.
                    ` }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'Zrozumiałem. Jestem gotowy pomagać jako ekspert Ekovoltis. W czym mogę pomóc?' }]
                },
                ...history
            ]
        });

        const result = await chat.sendMessage(lastMessage);
        const response = result.response.text();

        // --- 3. Logging ---
        await logUsage(uid, 'gemini', 'admin_chat', 1, { length: lastMessage.length });

        return NextResponse.json({ response });

    } catch (error: any) {
        console.error('[AdminAI] Error:', error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}
