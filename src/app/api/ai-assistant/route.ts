import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { admin, adminAuth, adminDb } from '@/lib/firebase-admin';
import { logUsage } from '@/lib/usage';

// Initialize Vertex AI (Service Account) - Same as card-parser.ts
const vertexAI = new VertexAI({
    project: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_PROJECT_ID || 'ekovoltis-portal',
    location: 'europe-central2',
    googleAuthOptions: {
        credentials: {
            client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL,
            private_key: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
        }
    }
});

// Funkcja czyszcząca tekst z "iPhone'owych" znaków
function sanitizeText(text: string): string {
    if (!text) return "";
    return text
        .replace(/[\u2018\u2019]/g, "'") // Zamień krzywe apostrofy na proste
        .replace(/[\u201C\u201D]/g, '"') // Zamień krzywe cudzysłowy na proste
        .trim();
}

export async function POST(request: Request) {
    try {
        // --- 1. Authentication Check (Bezpieczniejszy) ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        let uid = '';

        try {
            const decodedToken = await adminAuth.verifyIdToken(token);
            uid = decodedToken.uid;
        } catch (authError: any) {
            console.error('[AdminAI] Auth Error:', authError.message);
            return NextResponse.json({ error: 'Session expired', details: authError.message }, { status: 401 });
        }

        // --- 2. Chat Logic ---
        const body = await request.json();
        const { messages, sessionId } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // Czyścimy input z iPhone'a
        const rawLastContent = messages[messages.length - 1].content;
        const lastMessageContent = sanitizeText(rawLastContent);

        console.log(`[AdminAI] Processing msg length: ${lastMessageContent.length} for UID: ${uid}`);

        let responseText = '';

        const runChat = async (modelName: string) => {
            console.log(`[AdminAI] Trying model (Vertex): ${modelName}`);

            // Przygotowanie historii dla Vertex AI
            // Vertex wymaga 'user' lub 'model'. Nasz frontend wysyła 'user'/'assistant'.
            const history = messages.slice(0, -1).map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: sanitizeText(msg.content) }],
            }));

            const model = vertexAI.getGenerativeModel({ model: modelName });

            const chat = model.startChat({
                history: [
                    {
                        role: 'user',
                        parts: [{
                            text: `
                            Jesteś ekspertem rynku energii i asystentem sprzedaży w firmie Ekovoltis.
                            Twoim zadaniem jest pomagać handlowcom i administratorom.
                            Styl wypowiedzi: Profesjonalny, konkretny.

                            ZASADY PISANIA MAILI:
                            1. Twoim celem jest ZACHĘCENIE do kontaktu/rozmowy, a nie sprzedaż w mailu.
                            2. ABSOLUTNIE NIE generuj żadnych ofert cenowych, stawek, ani warunków umowy.
                            3. NIE wymyślaj cenników.
                            4. Skup się na korzyściach (oszczędność, stabilność) i Call to Action (prośba o spotkanie/telefon).

                            WAŻNE INSTRUKCJE DOTYCZĄCE WYKRESÓW:
                            Jeśli użytkownik prosi o wykres, wizualizację danych lub analitykę:
                            1. NIE PISZ KODU PYTHON (matplotlib itp).
                            2. Zamiast tego, wygeneruj obiekt JSON wewnątrz bloku kodu \`\`\`json z następującą strukturą:
                            {
                                "type": "chart",
                                "chartType": "line" lub "bar",
                                "title": "Tytuł wykresu",
                                "data": [
                                    { "label": "Etykieta osi X (np. data)", "value": 123.45 (liczba) },
                                    ...
                                ],
                                "xAxisLabel": "Opis osi X",
                                "yAxisLabel": "Opis osi Y"
                            }
                            3. Dodaj krótki komentarz tekstowy pod wykresem.
                            `
                        }]
                    },
                    { role: 'model', parts: [{ text: 'Zrozumiałem.' }] },
                    ...history
                ]
            });

            // Timeout dla żądania Vertex (dłuższy dla Vertexa)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("AI Timeout")), 25000)
            );

            // Vertex AI: sendMessage returns { response: { candidates: [...] } }
            const result: any = await Promise.race([
                chat.sendMessage(lastMessageContent),
                timeoutPromise
            ]);

            const candidates = result.response.candidates;
            const parts = candidates?.[0]?.content?.parts ?? [];
            const text = parts.map((p: any) => p.text ?? '').join('').trim();

            if (!text) throw new Error("Empty response from Vertex AI");
            return text;
        };

        // Retry Logic - Vertex Models Only (EU)
        try {
            // First Try: Gemini 2.5 Flash
            responseText = await runChat("gemini-2.5-flash");
        } catch (errorFirst: any) {
            console.warn(`[AdminAI] Primary model failed (${errorFirst.message}). Fallback...`);
            try {
                // Fallback: Gemini 2.5 Flash-Lite (cheaper/faster/backup)
                responseText = await runChat("gemini-2.5-flash-lite");
            } catch (errorSecond: any) {
                console.warn(`[AdminAI] Secondary model failed. Trying Pro...`);
                try {
                    // Last Resort: Gemini 2.5 Pro
                    responseText = await runChat("gemini-2.5-pro");
                } catch (errorFinal: any) {
                    console.error('[AdminAI] All Vertex models failed:', errorFinal);
                    throw new Error(`AI Service Unavailable: ${errorFinal.message}`);
                }
            }
        }

        // --- 3. Persistence & Logs ---
        const sessionsRef = adminDb.collection('admin_chat_sessions');
        let finalSessionId = sessionId;
        let title = '';

        const userMsgObj = { role: 'user', content: lastMessageContent };
        const aiMsgObj = { role: 'assistant', content: responseText };

        if (sessionId) {
            await sessionsRef.doc(sessionId).update({
                messages: admin.firestore.FieldValue.arrayUnion(userMsgObj, aiMsgObj),
                updatedAt: new Date()
            });
        } else {
            title = lastMessageContent.substring(0, 50) + (lastMessageContent.length > 50 ? '...' : '');
            const newDoc = await sessionsRef.add({
                userId: uid,
                title: title,
                messages: [userMsgObj, aiMsgObj],
                createdAt: new Date(),
                updatedAt: new Date()
            });
            finalSessionId = newDoc.id;
        }

        // Log usage with 'vertex' provider
        await logUsage(uid, 'vertex-gemini', 'admin_chat', 1, { length: lastMessageContent.length });

        return NextResponse.json({
            response: responseText,
            sessionId: finalSessionId,
            title: title || undefined
        });

    } catch (error: any) {
        console.error('[AdminAI] CRITICAL ERROR:', error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}
