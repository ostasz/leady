import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { scrapeCompanyData } from '@/utils/scraper';
import { auth } from '@/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (session?.user?.id) {
            prisma.user.update({
                where: { id: session.user.id },
                data: { searchCount: { increment: 1 } }
            }).catch(err => console.error('Failed to update search count', err));
        }

        const { address } = await request.json();

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(API_KEY || '');

        // Stage 1: Search with grounding - REQUEST JSON FORMAT
        const searchModel = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            // @ts-ignore
            tools: [{ googleSearch: {} }],
        });

        const searchChat = searchModel.startChat({
            history: [],
        });

        const searchPrompt = `
Jesteś asystentem sprzedażowym pomagającym znaleźć potencjalnych klientów dla Spółki Obrotu Energią (sprzedaż prądu i gazu).

Użytkownik podał zapytanie: "${address}"

Twoje zadanie:
1. ZANALIZUJ zapytanie użytkownika:
   - Jeśli użytkownik wpisał konkretną branżę (np. "fabryki", "hotele", "szkoły"), szukaj WYŁĄCZNIE firm z tej kategorii. Nie pokazuj innych!
   - Jeśli użytkownik wpisał tylko miasto/obszar (np. "Radomsko"), szukaj firm z dużym zużyciem energii (fabryki, zakłady produkcyjne, chłodnie, duże hotele, galerie handlowe).

2. Używając narzędzia googleSearch znajdź MINIMUM 20-25 firm pasujących do powyższych kryteriów.
   - WAŻNE: Znajdź jak NAJWIĘCEJ firm (20-30), nie ograniczaj się do pierwszych wyników!
   - Szukamy firm, które płacą wysokie rachunki za prąd i mogą szukać tańszego sprzedawcy energii.
   - Jeśli narzędzie zwraca mniej niż 20 firm, spróbuj różnych fraz wyszukiwania.

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

Znajdź 10-15 najlepszych potencjalnych klientów.
WAŻNE: Zwróć TYLKO czysty JSON, bez markdown, bez \`\`\`json, bez dodatkowego tekstu.
`;

        const searchResult = await searchChat.sendMessage(searchPrompt);
        const searchResponse = searchResult.response;
        const responseText = searchResponse.text();

        // Parse JSON response
        let companiesFromModel: any[] = [];
        let summary = '';

        try {
            // Remove markdown code blocks if present
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
            // Fallback to empty array
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
                                // Try to find matching company from model response
                                const matchingCompany = companiesFromModel.find(c =>
                                    c.name && place.name &&
                                    c.name.toLowerCase().includes(place.name.toLowerCase().split(' ')[0])
                                );

                                // Use website from Maps, or fallback to Gemini's finding
                                const website = place.website || matchingCompany?.website || null;

                                // Use NIP from model if available, otherwise try scraping
                                let nip = matchingCompany?.nip || null;
                                let phone = place.formatted_phone_number || matchingCompany?.phone || null;

                                // ENRICHMENT: Scrape website if we have one
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
                                    nip: nip, // NEW FIELD
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
            console.log(`Grounding metadata returned ${groundingMetadata.groundingChunks.length} chunks, mapped to ${places.length} places.`);
        }

        // FALLBACK: If grounding didn't return places (or not enough), try to geocode companies from the model
        if (places.length === 0 && companiesFromModel.length > 0) {
            console.log('Grounding failed, falling back to Text Search for locations...');

            let index = 0;
            for (const company of companiesFromModel) {
                index++;
                try {
                    // Check if we already have this place from grounding
                    const existingPlace = places.find(p => p.name.toLowerCase().includes(company.name.toLowerCase()));
                    if (existingPlace) {
                        // Enrich existing place
                        if (!existingPlace.nip && company.nip) existingPlace.nip = company.nip;
                        if (!existingPlace.phone && company.phone) existingPlace.phone = company.phone;
                        if (!existingPlace.website && company.website) existingPlace.website = company.website;
                        if (!existingPlace.summary && company.summary) existingPlace.summary = company.summary;
                        continue;
                    }

                    // Fallback: if not found in grounding, try Text Search
                    // Only if we have < 25 places to ensure we show something
                    if (places.length < 25) {
                        const query = `${company.name} ${address}`;
                        const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;

                        const res = await fetch(textSearchUrl);
                        const data = await res.json();

                        if (data.results && data.results.length > 0) {
                            const location = data.results[0].geometry.location;
                            const placeId = data.results[0].place_id;

                            places.push({
                                id: placeId || `fallback-${index}`, // Ensure ID exists
                                name: company.name,
                                address: data.results[0].formatted_address || company.address,
                                location: { lat: location.lat, lng: location.lng },
                                rating: data.results[0].rating,
                                user_ratings_total: data.results[0].user_ratings_total,
                                website: company.website,
                                phone: company.phone,
                                nip: company.nip,
                                reason: company.reason,
                                summary: company.summary
                            });
                        } else {
                            // Even if not found in Maps, add it to list if we have data from AI
                            places.push({
                                id: `ai-only-${index}`,
                                name: company.name,
                                address: company.address,
                                location: { lat: 51.065, lng: 19.445 }, // Default to Radomsko center or user location if possible, but better to omit marker than crash
                                website: company.website,
                                phone: company.phone,
                                nip: company.nip,
                                reason: company.reason,
                                summary: company.summary
                            });
                        }
                    }
                } catch (e) {
                    console.error(`Error geocoding ${company.name}:`, e);
                }
            }
        }

        // Scrape data for NIP/Phone if missing
        // Only scrape if we have a valid URL (not "brak", not null)
        for (const place of places) {
            if ((!place.nip || !place.phone) && place.website && place.website.toLowerCase() !== 'brak' && place.website.startsWith('http')) {
                try {
                    const scrapedData = await scrapeCompanyData(place.website);
                    if (scrapedData) {
                        if (!place.nip && scrapedData.nip) place.nip = scrapedData.nip;
                        if (!place.phone && scrapedData.phone) place.phone = scrapedData.phone;
                        // If we found a better email/contact, we could add it here too
                    }
                } catch (e) {
                    console.error(`Error scraping ${place.website}:`, e);
                }
            }
        }

        // Generate text report from JSON for backward compatibility
        // If we have places from Maps, use them. If not, fallback to model data.
        const displayCompanies = places.length > 0 ? places : companiesFromModel;

        const report = displayCompanies.map(c =>
            `**${c.name}** - ${c.summary || c.reason || 'Brak opisu'}\nTelefon: ${c.phone || 'Brak'}\nNIP: ${c.nip || 'Brak'}\nWWW: ${c.website || 'Brak'}\n`
        ).join('\n---\n\n') + `\n\n${summary}`;

        // Deduplicate places based on ID to prevent React key errors
        const uniquePlaces = Array.from(new Map(places.map(place => [place.id, place])).values());

        console.log(`Found ${companiesFromModel.length} companies from AI.`);
        console.log(`Mapped to ${places.length} places before deduplication.`);
        console.log(`Returning ${uniquePlaces.length} unique places.`);

        return NextResponse.json({
            results: uniquePlaces,
            status: "OK"
        });

    } catch (error: any) {
        console.error('AI Search Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
