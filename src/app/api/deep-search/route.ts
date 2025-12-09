import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { GusClient } from '@/lib/gus-client';
import { logUsage } from '@/lib/usage';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function extractCity(address: string): string | undefined {
    if (!address) return undefined;
    // Remove "Polska" or "Poland"
    let clean = address.replace(/,?\s*(Polska|Poland)$/i, '');
    // Split by comma
    const parts = clean.split(',');
    // Take the last part
    let last = parts[parts.length - 1].trim();
    // Remove zip code (XX-XXX)
    last = last.replace(/\d{2}-\d{3}\s*/, '');
    return last;
}

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
            model: "gemini-2.5-flash-lite",
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
1. Numer NIP (Numer Identyfikacji Podatkowej) - BARDZO WAŻNE. Skup się na firmie pod wskazanym adresem. Jeśli jest kilka firm o tej nazwie, wybierz tę z miasta "${extractCity(address) || ''}".
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

Jeśli jakiejś informacji nie uda się znaleźć, wpisz null lub "brak danych".
Jeśli nie jesteś pewien która to firma (np. jest wiele o tej nazwie), zwróć null w polu NIP, a w opisie napisz "Niejednoznaczne wyniki".
WAŻNE: Zwróć TYLKO czysty JSON, bez markdown.
`;

        const result = await searchChat.sendMessage(prompt);
        await logUsage(uid, 'gemini', 'generate_content', 1, { query: name }); // Log Gemini usage
        const response = result.response;
        const text = response.text();

        let data: any = {};
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

        // --- GUS Integration ---
        const gusClient = new GusClient();
        let gusData = null;

        // 1. Try to search by NIP if Gemini found it
        if (data.nip) {
            const cleanNip = data.nip.replace(/[^0-9]/g, '');
            if (cleanNip.length === 10) {
                console.log(`[DeepSearch] Searching GUS by NIP: ${cleanNip}`);
                gusData = await gusClient.searchByNip(cleanNip);
                await logUsage(uid, 'gus', 'search', 1, { type: 'nip', query: cleanNip });
            }
        }

        // 2. Fallback: Search by Name + City if NIP failed or wasn't found
        if (!gusData) {
            const city = extractCity(address);
            console.log(`[DeepSearch] Searching GUS by Name: "${name}", City: "${city}"`);
            gusData = await gusClient.searchByName(name, city);
            await logUsage(uid, 'gus', 'search', 1, { type: 'name', query: name });
        }

        // Merge GUS data
        if (gusData) {
            data.gus = gusData;
            // Overwrite NIP if GUS found it (authoritative)
            if (gusData.nip) data.nip = gusData.nip;

            // Merge management if Gemini missed it
            if (gusData.management && gusData.management.length > 0) {
                const existingPeople = new Set(data.keyPeople || []);
                gusData.management.forEach((p: string) => existingPeople.add(p));
                data.keyPeople = Array.from(existingPeople);
            }
        } else if (!data.nip) {
            // If both AI and GUS failed to find NIP/Data
            data.description = "Brak szczegółowych danych (GUS/CEIDG nie zwrócił wyników dla tej nazwy i lokalizacji).";
            data.error = "Brak szczegółowych danych"; // Optional: trigger error UI if preferred, or just show description
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
