import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { scrapeCompanyData } from '@/utils/scraper';
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

        const { address } = await request.json();

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(API_KEY || '');
        const searchModel = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            // @ts-ignore
            tools: [{ googleSearch: {} }],
        });

        const searchChat = searchModel.startChat({ history: [] });

        const searchPrompt = `
Jesteś asystentem sprzedażowym pomagającym znaleźć potencjalnych klientów dla Spółki Obrotu Energią (sprzedaż prądu i gazu).

Użytkownik podał zapytanie: "${address}"

Twoje zadanie:
1. ZANALIZUJ zapytanie użytkownika:
   - Jeśli użytkownik wpisał konkretną branżę (np. "fabryki", "hotele", "szkoły"), szukaj WYŁĄCZNIE firm z tej kategorii.
   - Jeśli użytkownik wpisał tylko miasto/obszar (np. "Radomsko"), szukaj firm z dużym zużyciem energii (fabryki, zakłady produkcyjne, chłodnie, duże hotele, galerie handlowe).

2. Używając narzędzia googleSearch znajdź MINIMUM 20-25 firm pasujących do powyższych kryteriów.
   - WAŻNE: Znajdź jak NAJWIĘCEJ firm (20-30), nie ograniczaj się do pierwszych wyników!
   - Szukamy firm, które płacą wysokie rachunki za prąd i mogą szukać tańszego sprzedawcy energii.

3. Dla każdej firmy spróbuj znaleźć NIP w wiarygodnych źródłach.
   - Jeśli NIE masz wysokiej pewności co do NIP, ustaw pole "nip" na null.

Zwróć ODPOWIEDŹ WYŁĄCZNIE jako poprawny JSON w formacie:

{
  "companies": [
    {
      "name": "Pełna nazwa firmy",
      "address": "Pełny adres z kodem pocztowym",
      "phone": "numer telefonu lub null",
      "website": "https://... lub null",
      "nip": "10-cyfrowy NIP lub null",
      "reason": "krótkie uzasadnienie dlaczego to dobry klient",
      "mapsUrl": "link do Google Maps lub null"
    }
  ],
  "summary": "krótkie podsumowanie znalezionych firm"
}

Znajdź 20-30 najlepszych potencjalnych klientów.
WAŻNE: Zwróć TYLKO czysty JSON, bez markdown, bez \`\`\`json, bez dodatkowego tekstu.
`;

        const searchResult = await searchChat.sendMessage(searchPrompt);
        const searchResponse = searchResult.response;
        const responseText = searchResponse.text();

        let companiesFromModel: any[] = [];
        let summary = '';

        try {
            const cleanJson = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            const parsed = JSON.parse(cleanJson);
            companiesFromModel = parsed.companies || [];
            summary = parsed.summary || '';
        } catch (e) {
            console.error('Cannot parse model JSON', e);
            console.log('Response text:', responseText);
            companiesFromModel = [];
        }

        // Process grounding metadata to create map markers
        let places: any[] = [];
        // @ts-ignore - groundingMetadata exists but not in TypeScript definitions
        const groundingMetadata = searchResponse.groundingMetadata;

        if (groundingMetadata?.groundingChunks) {
            const placesPromises = groundingMetadata.groundingChunks.map(async (chunk: any) => {
                if (chunk.web?.uri) {
                    const placeIdMatch = chunk.web.uri.match(/maps\/place\/([^\/]+)/);
                    if (placeIdMatch) {
                        const placeId = placeIdMatch[1];

                        try {
                            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,formatted_phone_number,website,rating,user_ratings_total,editorial_summary&key=${API_KEY}`;
                            const detailsRes = await fetch(detailsUrl);
                            const detailsData = await detailsRes.json();

                            if (detailsData.status === 'OK') {
                                const place = detailsData.result;
                                const matchingCompany = companiesFromModel.find(c =>
                                    c.name && place.name &&
                                    c.name.toLowerCase().includes(place.name.toLowerCase().split(' ')[0])
                                );

                                const website = place.website || matchingCompany?.website || null;
                                let nip = matchingCompany?.nip || null;
                                let phone = place.formatted_phone_number || matchingCompany?.phone || null;

                                // Scrape website if available
                                if (website) {
                                    const scrapedData = await scrapeCompanyData(website);
                                    if (!nip && scrapedData.nip) nip = scrapedData.nip;
                                    if (!phone && scrapedData.phone) phone = scrapedData.phone;
                                }

                                return {
                                    id: placeId,
                                    name: place.name,
                                    address: place.formatted_address,
                                    location: {
                                        lat: place.geometry.location.lat,
                                        lng: place.geometry.location.lng,
                                    },
                                    phone: phone,
                                    website: website,
                                    nip: nip,
                                    rating: place.rating,
                                    user_ratings_total: place.user_ratings_total,
                                    summary: place.editorial_summary?.overview || matchingCompany?.reason,
                                };
                            }
                        } catch (error) {
                            console.error('Error fetching place details:', error);
                        }
                    }
                }
                return null;
            });

            const results = await Promise.all(placesPromises);
            places = results.filter((p: any) => p !== null);
        }

        // Fallback: geocode companies from model if no grounding
        if (places.length === 0 && companiesFromModel.length > 0) {
            let index = 0;
            for (const company of companiesFromModel) {
                index++;
                try {
                    const existingPlace = places.find(p => p.name.toLowerCase().includes(company.name.toLowerCase()));
                    if (existingPlace) {
                        if (!existingPlace.nip && company.nip) existingPlace.nip = company.nip;
                        if (!existingPlace.phone && company.phone) existingPlace.phone = company.phone;
                        if (!existingPlace.website && company.website) existingPlace.website = company.website;
                        continue;
                    }

                    if (places.length < 25) {
                        const query = `${company.name} ${address}`;
                        const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;

                        const res = await fetch(textSearchUrl);
                        const data = await res.json();

                        if (data.results && data.results.length > 0) {
                            const location = data.results[0].geometry.location;
                            const placeId = data.results[0].place_id;

                            places.push({
                                id: placeId || `fallback-${index}`,
                                name: company.name,
                                address: data.results[0].formatted_address || company.address,
                                location: { lat: location.lat, lng: location.lng },
                                rating: data.results[0].rating,
                                user_ratings_total: data.results[0].user_ratings_total,
                                website: company.website,
                                phone: company.phone,
                                nip: company.nip,
                                reason: company.reason,
                                summary: company.reason
                            });
                        } else {
                            places.push({
                                id: `ai-only-${index}`,
                                name: company.name,
                                address: company.address,
                                location: { lat: 51.065, lng: 19.445 },
                                website: company.website,
                                phone: company.phone,
                                nip: company.nip,
                                reason: company.reason,
                                summary: company.reason
                            });
                        }
                    }
                } catch (e) {
                    console.error(`Error geocoding ${company.name}:`, e);
                }
            }
        }

        // Scrape for missing NIP/Phone
        for (const place of places) {
            if ((!place.nip || !place.phone) && place.website && place.website.toLowerCase() !== 'brak' && place.website.startsWith('http')) {
                try {
                    const scrapedData = await scrapeCompanyData(place.website);
                    if (scrapedData) {
                        if (!place.nip && scrapedData.nip) place.nip = scrapedData.nip;
                        if (!place.phone && scrapedData.phone) place.phone = scrapedData.phone;
                    }
                } catch (e) {
                    console.error(`Error scraping ${place.website}:`, e);
                }
            }
        }

        // Deduplicate
        const uniquePlaces = Array.from(new Map(places.map(place => [place.id, place])).values());

        return NextResponse.json({
            results: uniquePlaces,
            status: "OK"
        });

    } catch (error: any) {
        console.error('AI Search Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
