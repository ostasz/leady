import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { admin, adminAuth, adminDb } from '@/lib/firebase-admin';
import { logUsage } from '@/lib/usage';

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

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



        // --- 2. Chat Logic ---
        const { messages, sessionId } = await request.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(API_KEY || '');
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        // Construct history from previous messages, excluding the last one which is the new prompt
        const history = messages.slice(0, -1).map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        }));

        const lastMessageContent = messages[messages.length - 1].content;

        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{
                        text: `
                        Jesteś ekspertem rynku energii i asystentem sprzedaży w firmie Ekovoltis.
                        Twoim zadaniem jest pomagać handlowcom i administratorom.
                        Styl wypowiedzi: Profesjonalny, konkretny.
                    ` }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'Zrozumiałem. Jestem gotowy do pracy.' }]
                },
                ...history
            ]
        });

        const result = await chat.sendMessage(lastMessageContent);
        const responseText = result.response.text();

        // --- 3. Persistence Logic ---
        const sessionsRef = adminDb.collection('admin_chat_sessions');
        let finalSessionId = sessionId;
        let title = '';

        const userMsgObj = { role: 'user', content: lastMessageContent };
        const aiMsgObj = { role: 'assistant', content: responseText };

        if (sessionId) {
            // Update existing session
            await sessionsRef.doc(sessionId).update({
                messages: admin.firestore.FieldValue.arrayUnion(userMsgObj, aiMsgObj),
                updatedAt: new Date()
            });
        } else {
            // Create New Session
            // Generate title from first 50 chars of prompt
            title = lastMessageContent.substring(0, 50) + (lastMessageContent.length > 50 ? '...' : '');

            const newDoc = await sessionsRef.add({
                userId: uid,
                title: title,
                messages: [userMsgObj, aiMsgObj], // We only save the new interaction if it's a "fresh" start from the UI's perspective
                // Note: If UI sent history but no ID, we might lose previous context in DB if we don't save 'messages' payload.
                // But assuming "no sessionId" means "New Thread" on UI, so messages should only be the prompt.
                createdAt: new Date(),
                updatedAt: new Date()
            });
            finalSessionId = newDoc.id;
        }

        // --- 4. Logging ---
        await logUsage(uid, 'gemini', 'admin_chat', 1, { length: lastMessageContent.length });

        return NextResponse.json({
            response: responseText,
            sessionId: finalSessionId,
            title: title || undefined
        });

    } catch (error: any) {
        console.error('[AdminAI] Error:', error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}
