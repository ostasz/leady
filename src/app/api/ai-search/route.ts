import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { scrapeCompanyData } from '@/utils/scraper';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logUsage } from '@/lib/usage';

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
            model: "gemini-2.5-flash-lite",
            // @ts-ignore
            tools: [{ googleSearch: {} }],
        });

        const searchChat = searchModel.startChat({ history: [] });

        const searchPrompt = `
Jesteś ekspertem ds. analizy rynku energetycznego i wyszukiwania leadów B2B.
Twoim celem jest znalezienie firm, które zużywają dużo energii elektrycznej (duży wolumen MWh) i mogą być zainteresowane zmianą sprzedawcy prądu.

Użytkownik podał zapytanie: "${address}"

Twoje zadanie:
1. Na podstawie wyników wyszukiwania Google znajdź firmy w podanej lokalizacji.
2. Dla każdej potencjalnej firmy:
   - przeczytaj opis działalności (wizytówka Google, meta-opis, fragment strony),
   - zaklasyfikuj typ działalności (np. "fabryka mebli", "chłodnia", "galeria handlowa", "hotel", "sklep spożywczy").
3. Oceń każdą firmę w dwóch skalach:

   SKALA 1: energy_intensity_score (1-10) - Potencjał zużycia energii:
   - 1: Mikro punkty: kioski, małe biura, paczkomaty.
   - 2: Małe usługi: fryzjer, kosmetyczka, mały warsztat.
   - 3: Mały handel: sklep osiedlowy, mała gastronomia, apteka.
   - 4: Średni handel: supermarket, większa restauracja, stacja paliw.
   - 5: Mała produkcja/magazyn: piekarnia, mała drukarnia, hurtownia.
   - 6: Średnie obiekty: biurowiec, hotel, obiekt sportowy.
   - 7: Duże obiekty komercyjne: galeria handlowa, duży hotel.
   - 8: Średnia produkcja: fabryka mebli, zakład przetwórczy.
   - 9: Duża produkcja: duża fabryka, zakład chemiczny, cementownia.
   - 10: Przemysł ciężki/energochłonny: huta, odlewnia, chłodnia przemysłowa, data center.

   SKALA 2: lead_fit_score (0-100) - Ogólna atrakcyjność leada:
   - 80-100: HOT (Bardzo dobry kandydat)
   - 50-79: WARM (Dobry kandydat)
   - 0-49: COLD (Słaby kandydat)

4. ZASADY FILTROWANIA I JAKOŚCI:
   - Zwróć MAKSYMALNIE 30 firm.
   - Jeśli w danej lokalizacji jest mniej firm spełniających kryteria, zwróć mniej. NIE obniżaj kryteriów na siłę.
   - Do wyników dodawaj TYLKO firmy z energy_intensity_score >= 4 ORAZ lead_fit_score >= 50.
   - BEZWZGLĘDNIE ODRZUCAJ: szpitale, przychodnie, placówki medyczne (nawet jeśli są duże).
   - Nie wymyślaj firm – zwracaj tylko takie, które faktycznie istnieją i pojawiły się w wynikach.

5. Dla każdej firmy spróbuj znaleźć NIP. Jeśli nie masz pewności, ustaw null.

Zwróć ODPOWIEDŹ WYŁĄCZNIE jako poprawny JSON w formacie:

{
  "companies": [
    {
      "name": "Pełna nazwa firmy",
      "address": "Pełny adres",
      "phone": "numer telefonu lub null",
      "website": "https://... lub null",
      "nip": "NIP lub null",
      "source_url": "link do źródła (np. wizytówka Google, strona www)",
      "business_type": "np. fabryka mebli",
      "energy_intensity_score": 8,
      "lead_fit_score": 85,
      "reason": "Krótkie uzasadnienie dlaczego to dobry klient (np. 'Duża hala produkcyjna, praca na 3 zmiany')."
    }
  ],
  "summary": "Krótkie podsumowanie znalezionych firm i specyfiki lokalizacji."
}

WAŻNE: Zwróć TYLKO czysty JSON.
`;

        const searchResult = await searchChat.sendMessage(searchPrompt);

        // Log Gemini Usage
        await logUsage(uid, 'gemini', 'generate_content', 1, { query: address });

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

            // Backend Filtering (Double Check)
            companiesFromModel = companiesFromModel.filter(company => {
                const score = company.energy_intensity_score || 0;
                const fit = company.lead_fit_score || 0;

                // Filter out duplicates based on name (simple normalization)
                // This is a basic check, ideally we'd check against DB or more complex logic

                // Filter by score as requested (reject 3 and lower means keep >= 4)
                return score >= 4 && fit >= 50;
            });

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
                                // Log Place Details Usage
                                await logUsage(uid, 'google_maps', 'place_details', 1, { placeId });

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

                        // Log Text Search Usage
                        await logUsage(uid, 'google_maps', 'text_search', 1, { query });

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
