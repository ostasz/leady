import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { GusClient } from '@/lib/gus-client';
import { logUsage } from '@/lib/usage';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function cleanNip(nip: string): string {
    return nip.replace(/[^0-9]/g, '');
}

export async function POST(request: Request) {
    try {
        // --- 1. Authentication ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;


        // --- 2. Input Parsing ---
        const body = await request.json();
        let { nip, name, city, website } = body;

        // Cleanup
        if (nip) nip = cleanNip(nip);
        if (name) name = name.trim();
        if (city) city = city.trim();

        if (!nip && !name) {
            return NextResponse.json({ error: 'Provide either "nip" or "name".' }, { status: 400 });
        }


        // --- 3. Data Collection Strategies ---
        const gusClient = new GusClient();
        let gusData: any = null;
        let aiInput = { name, city, website, description: '' };

        // STRATEGY A: Input is NIP -> GUS First -> AI Enrichment
        if (nip) {
            console.log(`[ClientIntelligence] Strategy A: NIP ${nip}`);

            // A1. GUS Lookup
            gusData = await gusClient.searchByNip(nip);
            await logUsage(uid, 'gus', 'search', 1, { type: 'nip', query: nip });

            if (gusData) {
                // Populate AI input from GUS data
                aiInput.name = gusData.name;
                aiInput.city = gusData.city;
                if (!website) {
                    // Try to guess or leave empty for AI to find
                }
            } else {
                // NIP provided but not found in GUS? Rare, but possible.
                // We continue to AI to see if it finds anything online about this NIP.
                aiInput.description = `Szukamy firmy o NIP: ${nip}`;
            }
        }
        // STRATEGY B: Input is Name -> AI Find/GUS -> AI Enrichment
        else {
            console.log(`[ClientIntelligence] Strategy B: Name "${name}" City "${city}"`);

            // B1. Try GUS by Name first? Or AI first? 
            // GUS search by name is tricky (exact match often needed).
            // Let's try GUS search by name+city first as it's cheaper/faster.
            if (city) {
                gusData = await gusClient.searchByName(name, city);
                await logUsage(uid, 'gus', 'search', 1, { type: 'name', query: name });
            }

            if (gusData) {
                // Found in GUS!
                console.log(`[ClientIntelligence] Found in GUS by name`);
            } else {
                console.log(`[ClientIntelligence] Not found in GUS by name, proceeding to AI discovery`);
            }
        }

        // --- 4. AI Enrichment (Gemini) ---
        // If we found GUS data, we have a concrete name/address to search for.
        // If not, we search broadly.

        const genAI = new GoogleGenerativeAI(API_KEY || '');
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            // @ts-ignore
            tools: [{ googleSearch: {} }],
        });

        const chat = model.startChat({ history: [] });

        const prompt = `
        Jesteś analitykiem wywiadu gospodarczego (OSINT). Analizujesz firmę:
        Nazwa: "${aiInput.name || name || 'Nieznana'}"
        Miasto: "${aiInput.city || city || 'Nieznane'}"
        NIP: "${gusData?.nip || nip || 'Nieznany'}"
        WWW: "${website || 'Szukaj w sieci'}"

        Twoje zadanie:
        1. Znajdź stronę WWW firmy (jeśli nie podano).
        2. Znajdź profile społecznościowe (LinkedIn, Facebook).
        3. Znajdź informacje o kluczowych osobach.
           CRITICAL RULES FOR PEOPLE:
           - Precyzyjnie rozróżniaj "Zarząd" (Management Board) od "Rady Nadzorczej" (Supervisory Board).
           - Tytuł "Członek" jest mylący. JEŚLI występuje fraza "Rada Nadzorcza" (lub Supervisory), wpisz do "supervisory".
           - "Prezes", "Wiceprezes", "Członek Zarządu", "Prokurent" -> "management".
           - "Przewodniczący Rady", "Członek Rady", "Sekretarz Rady" -> "supervisory".
           - Jeśli nie masz pewności, czy to Zarząd czy Rada, ale są to osoby nadzorujące -> "supervisory".
        4. Oszacuj wielkość firmy (przychody, zatrudnienie) na podstawie dostępnych danych (KRS, newsy, LinkedIn).
        5. Streść krótko czym firma się zajmuje (branża, produkty).
        6. Jeśli nie mamy NIPu (nie znaleziono w GUS), spróbuj go znaleźć w sieci.
        7. Wyszukaj 3 ostatnie lub najważniejsze newsy/wydarzenia związane z firmą.

        Zwróć odpowiedź WYŁĄCZNIE jako JSON:
        {
           "website": "url lub null",
           "nip": "znaleziony nip lub null (jeśli inny niż podany)",
           "socials": { "linkedin": "url...", "facebook": "url...", "instagram": "url..." },
           "people": {
               "management": ["Jan Kowalski - Prezes", "Anna Nowak - Członek Zarządu"],
               "supervisory": ["Marek Iksiński - Przewodniczący Rady Nadzorczej"]
           },
           "size_estimation": { "revenue": "np. 10m+", "employees": "np. 50-100" },
           "summary": "krótki opis...",
           "news": ["tytuł 1", "tytuł 2"],
           "technologies": ["tech1", "tech2"]
        }
        `;

        const result = await chat.sendMessage(prompt);
        await logUsage(uid, 'gemini', 'generate_content', 1, { query: aiInput.name });

        const responseText = result.response.text();
        let aiData: any = {};

        try {
            const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            aiData = JSON.parse(cleanJson);
        } catch (e) {
            console.error('AI JSON Parse Error', e);
            aiData = { error: 'Failed to parse', raw: responseText };
        }

        // --- 5. Reconsolidation ---
        // If we didn't have GUS data initially, but AI found NIP, try GUS again.
        if (!gusData && aiData.nip) {
            const foundNip = cleanNip(aiData.nip);
            if (foundNip.length === 10) {
                console.log(`[ClientIntelligence] AI found NIP ${foundNip}, checking GUS...`);
                gusData = await gusClient.searchByNip(foundNip);
                await logUsage(uid, 'gus', 'search', 1, { type: 'nip', query: foundNip });
            }
        }

        // --- 6. Save/Update Search History (Optional but good for caching) ---
        // For now, just return.

        return NextResponse.json({
            status: 'OK',
            source: {
                gus: !!gusData,
                ai: true
            },
            data: {
                formal: gusData, // Authoritative
                intelligence: aiData // Soft/Web data
            }
        });

    } catch (error: any) {
        console.error('[ClientIntelligence] Error:', error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}
