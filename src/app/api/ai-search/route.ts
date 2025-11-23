import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!API_KEY) {
    console.error('Missing Google Maps API Key for Gemini');
}

const genAI = new GoogleGenerativeAI(API_KEY || '');

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { address, query } = body;

        if (!address) {
            return NextResponse.json({ error: 'Address is required' }, { status: 400 });
        }

        // STAGE 1: Discovery (Google Maps)
        // Find businesses and get their locations for the map.
        const mapsModel = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            // @ts-ignore
            tools: [{ googleMaps: {} }],
        });

        const mapsChat = mapsModel.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "Jesteś asystentem sprzedaży B2B. Twoim celem jest znajdowanie potencjalnych klientów." }],
                },
            ],
        });

        const mapsPrompt = `
      Analizuj zapytanie użytkownika: "${address}".
      
      Twoim celem jest znalezienie najlepszych potencjalnych klientów B2B (Business to Business).

      Zasady filtrowania:
      1. JEŚLI zapytanie zawiera konkretną branżę (np. "restauracje", "hotele", "mechanik"):
         - Szukaj DOKŁADNIE tej branży w podanej lokalizacji.
      2. JEŚLI zapytanie to TYLKO miasto/obszar (np. "Włocławek", "Warszawa", "pomorskie"):
         - Szukaj domyślnie: "duże zakłady produkcyjne", "fabryki", "duże przedsiębiorstwa", "hurtownie".
         - Ignoruj małe sklepy detaliczne, szkoły, urzędy, chyba że pasują do profilu dużego zużycia energii.

      Instrukcje wykonania:
      1. Użyj Google Maps, aby znaleźć firmy zgodnie z powyższymi zasadami.
      2. Znajdź co najmniej 10-15 firm, jeśli to możliwe.
      3. Wypisz je w liście, podając: Nazwa, Adres, **Telefon** (jeśli dostępny).
    `;

        const mapsResult = await mapsChat.sendMessage(mapsPrompt);
        const mapsResponse = mapsResult.response;
        const mapsText = mapsResponse.text();
        const groundingMetadata = mapsResponse.candidates?.[0]?.groundingMetadata;

        // STAGE 2: Enrichment (Google Search)
        // Use the list of found companies to find their NIPs using Google Search.
        const searchModel = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            // @ts-ignore
            tools: [{ googleSearch: {} }],
        });

        const searchChat = searchModel.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "Jesteś asystentem sprzedaży B2B. Twoim zadaniem jest wzbogacanie danych o firmach." }],
                },
            ],
        });

        const searchPrompt = `
      Oto lista firm, które znalazłem w Google Maps (może zawierać już numery telefonów):
      ${mapsText}

      Twoim zadaniem jest wzbogacenie tej listy o dane kontaktowe, A W SZCZEGÓLNOŚCI O NUMER TELEFONU i NIP.

      Instrukcje PRIORYTETOWE:
      1. **TELEFON**:
         - **JEŚLI telefon jest już na liście wejściowej**: PRZEPISZ GO. Nie szukaj na siłę innego, chyba że ten wygląda na błędny.
         - **JEŚLI telefonu BRAK**: Wpisz w Google: "Nazwa Firmy kontakt", "Nazwa Firmy telefon". Szukaj w nagłówkach/stopkach stron www oraz w katalogach (Panorama Firm, Aleo).
         - Dopiero jeśli po 3 różnych próbach nie znajdziesz numeru, wpisz "Brak".
      
      2. **NIP**: Znajdź NIP w KRS, CEIDG lub na stronie firmy.
      
      3. **WWW**: Znajdź oficjalną stronę www.

      Format wyjściowy (Markdown) - TRZYMAJ SIĘ GO ŚCIŚLE:
      Dla każdej firmy stwórz wpis:
      *   **Nazwa Firmy** - Krótki opis (branża).
          *   📞 Telefon: [Numer telefonu]
          *   🆔 NIP: [Numer NIP]
          *   🌐 WWW: [Adres strony]

      Na koniec podsumuj krótko, jakiego typu firmy znaleziono.
    `;

        const searchResult = await searchChat.sendMessage(searchPrompt);
        const searchResponse = searchResult.response;
        const finalText = searchResponse.text();

        // Process grounding metadata from Stage 1 to create map markers
        let places: any[] = [];

        if (groundingMetadata?.groundingChunks) {
            const chunks = groundingMetadata.groundingChunks;

            // Extract unique Place IDs
            const placeIds = new Set<string>();
            chunks.forEach((chunk: any) => {
                if (chunk.web?.uri) {
                    // Web chunks don't have place IDs usually, but let's check if we have any map chunks
                }
                // The structure of grounding metadata for Maps tool usually contains 'groundingSupports' or similar
                // But for simplicity, if we can't get Place IDs easily from the new tool format without types,
                // we might skip the detailed fetch.
                // HOWEVER, the previous code used `chunk.maps?.placeId`. Let's assume that exists.
                // If not, we might need to rely on the text or just not show markers if metadata is missing.
                // Let's try to inspect the chunk structure safely.
            });

            // Note: The previous code block for parsing Place IDs was:
            /*
            chunks.forEach((chunk: any) => {
                if (chunk.maps?.placeId) {
                    const pid = chunk.maps.placeId.replace('places/', '');
                    placeIds.add(pid);
                }
            });
            */
            // We will restore this logic.

            // Check if 'maps' property exists on chunk (it might be dynamic)
            chunks.forEach((chunk: any) => {
                // @ts-ignore
                if (chunk.maps?.placeId) {
                    // @ts-ignore
                    const pid = chunk.maps.placeId.replace('places/', '');
                    placeIds.add(pid);
                }
            });

            // Fetch details for each place to get location
            const placesPromises = Array.from(placeIds).map(async (placeId) => {
                try {
                    const fields = 'name,geometry,formatted_address,photos';
                    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`;

                    const res = await fetch(url);
                    const data = await res.json();

                    if (data.status === 'OK' && data.result) {
                        return {
                            id: placeId,
                            name: data.result.name,
                            address: data.result.formatted_address,
                            location: data.result.geometry.location,
                        };
                    }
                } catch (e) {
                    console.error(`Failed to fetch details for ${placeId}`, e);
                }
                return null;
            });

            const results = await Promise.all(placesPromises);
            places = results.filter(p => p !== null);
        }

        return NextResponse.json({
            report: finalText,
            groundingMetadata: groundingMetadata,
            places: places
        });

    } catch (error: any) {
        console.error('AI Search Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
