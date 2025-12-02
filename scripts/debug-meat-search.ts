
import { config } from 'dotenv';
import { resolve } from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const LEAD_PROFILES = {
    agro_meat: {
        id: 'agro_meat',
        label: 'Przetwórstwo mięsne / Masarnie',
        base_score: 35,
        keywords: [
            "masarnia", "zakład mięsny", "ubojnia", "przetwórstwo mięsne",
            "rzeźnia", "wędliniarstwo", "skup żywca"
        ]
    }
};

async function geocode(address: string) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
    const res = await fetch(url, { headers: { 'Referer': 'http://localhost:3000/' } });
    const data = await res.json();
    if (!data.results?.[0]) {
        console.error("Geocode Error:", JSON.stringify(data, null, 2));
    }
    return data.results[0]?.geometry.location;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

async function runDebug() {
    const address = "Radom";
    const profileKey = "agro_meat";
    const profile = LEAD_PROFILES[profileKey];
    const allKeywords = profile.keywords;

    console.log(`--- DEBUG START: ${address} [${profileKey}] ---`);

    const location = await geocode(address);
    console.log(`Geocoded Location:`, location);

    const radius = 50000; // 50km

    const executeSearch = async (queryStr: string, label: string) => {
        let results: any[] = [];
        let nextToken = '';
        console.log(`\n[${label}] Query: "${queryStr}"`);

        for (let i = 0; i < 3; i++) {
            let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(queryStr)}&location=${location.lat},${location.lng}&radius=${radius}&key=${API_KEY}`;

            if (nextToken) {
                url += `&pagetoken=${nextToken}`;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log(`  Fetching Page ${i + 1}... URL: ${url.replace(API_KEY!, 'KEY')}`);
            const res = await fetch(url, { headers: { 'Referer': 'http://localhost:3000/' } });
            const data = await res.json();

            console.log(`  Status: ${data.status}, Results: ${data.results?.length || 0}`);

            if (data.results) {
                results = [...results, ...data.results];
                // Log first 3 results names
                data.results.slice(0, 3).forEach((r: any) => console.log(`    - Found: ${r.name} (${r.formatted_address})`));
            }

            nextToken = data.next_page_token;
            if (!nextToken) break;
        }
        return results;
    };

    const filterResults = (results: any[]) => {
        console.log(`\n[Filtering] Checking ${results.length} results against radius ${radius / 1000}km...`);
        return results.filter((place: any) => {
            const dist = calculateDistance(
                location.lat,
                location.lng,
                place.geometry.location.lat,
                place.geometry.location.lng
            );
            const isWithin = dist <= (radius / 1000);

            if (!isWithin) {
                console.log(`  [DROP] ${place.name}: ${dist.toFixed(2)}km`);
            } else {
                // console.log(`  [KEEP] ${place.name}: ${dist.toFixed(2)}km`);
            }
            return isWithin;
        });
    };

    // 1. Specific Search
    const specificQuery = `(${allKeywords.join(' OR ')}) ${address}`;
    let allResults = await executeSearch(specificQuery, "Specific");
    let filteredResults = filterResults(allResults);
    console.log(`Specific Valid Results: ${filteredResults.length}`);

    // 2. Broad Search (Forced)
    console.log(`\n[Broad Search] Forcing expansion...`);
    const broadQuery = allKeywords.join(' OR ');
    const broadResults = await executeSearch(broadQuery, "Broad");
    const filteredBroad = filterResults(broadResults);
    console.log(`Broad Valid Results: ${filteredBroad.length}`);

    // Merge
    const existingIds = new Set(filteredResults.map(r => r.place_id));
    const newResults = filteredBroad.filter(r => !existingIds.has(r.place_id));
    filteredResults = [...filteredResults, ...newResults];

    console.log(`\n--- FINAL TOTAL: ${filteredResults.length} ---`);
    filteredResults.forEach(r => console.log(`- ${r.name}`));
}

runDebug().catch(console.error);
