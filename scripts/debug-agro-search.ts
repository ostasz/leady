
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Mock LEAD_PROFILES for Agro
const AGRO_KEYWORDS = [
    "farm", "dairy farm", "poultry farm", "pig farm",
    "cattle farm", "greenhouse", "vegetable farm", "orchard",
    "gospodarstwo rolne", "ferma drobiu", "ferma kur",
    "ferma trzody", "ferma bydła", "obora",
    "kurnik", "szklarnia", "uprawa warzyw", "sad", "gospodarstwo ogrodnicze"
];

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

async function geocode(address: string) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK') {
        return data.results[0].geometry.location;
    }
    throw new Error(data.error_message || 'Geocoding failed');
}

async function runDebug() {
    const address = 'Radom';
    console.log(`Geocoding ${address}...`);
    const location = await geocode(address);
    console.log(`Location: ${location.lat}, ${location.lng}`);

    const radius = 20000; // 20km

    const executeSearch = async (queryStr: string) => {
        let results: any[] = [];
        let nextToken = '';
        console.log(`\nExecuting search: "${queryStr}"`);

        for (let i = 0; i < 3; i++) { // Try 3 pages
            let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(queryStr)}&location=${location.lat},${location.lng}&radius=${radius}&key=${API_KEY}`;

            if (nextToken) {
                url += `&pagetoken=${nextToken}`;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            const res = await fetch(url);
            const data = await res.json();

            console.log(`Page ${i + 1}: Status ${data.status}, Results: ${data.results?.length || 0}`);

            if (data.results) {
                results = [...results, ...data.results];
            }

            nextToken = data.next_page_token;
            if (!nextToken) break;
        }
        return results;
    };

    // 1. Specific Search
    const specificQuery = `(${AGRO_KEYWORDS.join(' OR ')}) ${address}`;
    let allResults = await executeSearch(specificQuery);

    // 2. Fallback
    if (allResults.length === 0) {
        console.log('\nSpecific search returned 0 results. Trying broad search...');
        const broadQuery = AGRO_KEYWORDS.join(' OR ');
        allResults = await executeSearch(broadQuery);
    }

    console.log(`\nTotal raw results: ${allResults.length}`);

    // Filter
    console.log('\nApplying Distance Filter (20km):');
    const filtered = allResults.filter((place: any) => {
        const dist = calculateDistance(
            location.lat,
            location.lng,
            place.geometry.location.lat,
            place.geometry.location.lng
        );
        const isWithin = dist <= (radius / 1000);

        if (!isWithin) {
            console.log(`[DROP] "${place.name}" - ${dist.toFixed(2)}km`);
        } else {
            console.log(`[KEEP] "${place.name}" - ${dist.toFixed(2)}km`);
        }
        return isWithin;
    });

    console.log(`\nFinal results count: ${filtered.length}`);
}

runDebug().catch(console.error);
