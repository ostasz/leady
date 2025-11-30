import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function POST(request: Request) {
    try {
        // Get Firebase Auth token
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        // Update search count
        const userDoc = await adminDb.collection('users').doc(uid).get();
        const currentCount = userDoc.data()?.searchCount || 0;
        await adminDb.collection('users').doc(uid).update({
            searchCount: currentCount + 1
        }).catch(() => { });

        const { name, address, website } = await request.json();

        if (!name) {
            return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(API_KEY || '');
        const searchModel = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            // @ts-ignore
            tools: [{ googleSearch: {} }],
        });

        const searchChat = searchModel.startChat({ history: [] });

        const prompt = `
Jesteś ekspertem od wywiadu gospodarczego (OSINT). Twoim zadaniem jest znalezienie szczegółowych informacji o firmie:
Nazwa: "${name}"
Adres: "${address || 'nieznany'}"
Strona WWW: "${website || 'nieznana'}"

Używając Google Search, znajdź następujące informacje:
1. Numer NIP (Numer Identyfikacji Podatkowej) - BARDZO WAŻNE.
2. Kluczowe osoby (Właściciel, Prezes, Dyrektorzy, Osoby decyzyjne).
3. Szacowane przychody lub wielkość firmy (mała/średnia/duża).
4. Liczba pracowników (przybliżona).
5. Profile w mediach społecznościowych (LinkedIn, Facebook, Instagram - podaj linki).
6. Krótki opis działalności (czym się dokładnie zajmują).
7. Ostatnie istotne wydarzenia/newsy o firmie (jeśli są).
8. Technologie, których używają (jeśli uda się ustalić).

Zwróć odpowiedź WYŁĄCZNIE jako poprawny JSON w formacie:
{
  "nip": "10-cyfrowy NIP lub null",
  "keyPeople": ["Jan Kowalski - Prezes", "Anna Nowak - Dyrektor Handlowy"],
  "revenue": "szacunek np. 10-50 mln PLN",
  "employees": "szacunek np. 50-100",
  "socials": {
    "linkedin": "url lub null",
    "facebook": "url lub null",
    "instagram": "url lub null"
  },
  "description": "krótki opis działalności...",
  "news": ["tytuł newsa 1", "tytuł newsa 2"],
  "technologies": ["tech 1", "tech 2"]
}

Jeśli jakiejś informacji nie uda się znaleźć, wpisz null lub "brak danych". Nie zmyślaj.
WAŻNE: Zwróć TYLKO czysty JSON, bez markdown.
`;

        const result = await searchChat.sendMessage(prompt);
        const response = result.response;
        const text = response.text();

        let data = {};
        try {
            const cleanJson = text
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            data = JSON.parse(cleanJson);
        } catch (e) {
            console.error('Failed to parse Deep Search JSON:', e);
            data = { error: 'Failed to parse AI response', raw: text };
        }

        return NextResponse.json({
            data: data,
            status: "OK"
        });

    } catch (error: any) {
        console.error('Deep Search Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
