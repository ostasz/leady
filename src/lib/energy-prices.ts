import { admin, adminDb } from '@/lib/firebase-admin';

export const parsePolishNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    let clean = String(value).trim();

    // Check if it's already a clean number (e.g. "279.1")
    // If it acts like a number and has a dot, trust it?
    // But strict check: if it has no commas, just use it.
    if (!clean.includes(',')) {
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    }

    // Has comma. Assume Polish format or thousands separator?
    // In this context (energy prices), usually comma is decimal if in PL context.
    // "2 500,50" -> "2500.50"
    // Remove spaces
    clean = clean.replace(/\s/g, '');
    clean = clean.replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

export const normalizeDate = (dateStr: string): string => {
    // Handle excel serial numbers if necessary, but assuming string 'YYYY-MM-DD' or 'DD.MM.YYYY' or 'M/D/YYYY'

    // Remove Time part if exists (e.g. 3/16/2024 12:00:00 AM)
    const datePart = dateStr.split(' ')[0];

    // Simple heuristic for DD.MM.YYYY
    if (datePart.includes('.')) {
        const parts = datePart.split('.');
        if (parts.length === 3) {
            // DD.MM.YYYY -> YYYY-MM-DD
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
    }
    // Handle M/D/YYYY
    if (datePart.includes('/')) {
        const parts = datePart.split('/');
        if (parts.length === 3) {
            // M/D/YYYY -> YYYY-MM-DD
            // Pad Month and Day
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
        }
    }
    return datePart;
};

// Helper for fuzzy column matching
export const findVal = (row: any, keyPart: string) => {
    const keys = Object.keys(row);
    // 1. Try case-insensitive exact match first (or cleaned key)
    const exact = keys.find(k => k.toLowerCase().trim() === keyPart.toLowerCase().trim());
    if (exact) return row[exact];

    // 2. Try priority TGE keys if searching for specific concepts
    if (keyPart === 'godzinanazwa' || keyPart === 'godzina') {
        const tgeKey = keys.find(k => k.toLowerCase().includes('tge_rdn_kontrakty_godzinanazwa'));
        if (tgeKey) return row[tgeKey];
    }

    // 3. Fallback to simple includes
    const foundKey = keys.find(k => k.toLowerCase().includes(keyPart.toLowerCase()));
    return foundKey ? row[foundKey] : undefined;
};

export interface ProcessedEnergyPrice {
    date: string;
    hour: number;
    price: number;
    volume: number;
    createdAt: admin.firestore.FieldValue;
    createdBy: string;
}

export interface ProcessingResult {
    processedCount: number;
    skippedCount: number;
    skippedRows: any[];
    errors: string[];
}

export async function processEnergyPriceData(data: any[], userEmail: string): Promise<ProcessingResult> {
    let batchCount = 0;
    let processedCount = 0;
    const skippedRows: any[] = [];
    const maxBatchSize = 250; // Reduced from 450 to safe 250 to avoid Firestore Transaction Too Big error

    let currentBatch = adminDb.batch();

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 1; // 1-based index for logging

        // Use fuzzy matching to find columns
        // Updated to support: tge_rdn_kontrakty_DataDostawy, tge_rdn_kontrakty_GodzinaNazwa, tge_rdn_kontrakty_KursFixing1, tge_rdn_kontrakty_WolumenFixing1
        const dateVal = findVal(row, 'datadostawy') || findVal(row, 'data');
        const hourVal = findVal(row, 'godzinanazwa') || findVal(row, 'h_num') || findVal(row, 'godzina');
        const priceVal = findVal(row, 'kursfixing1') || findVal(row, 'average of cena') || findVal(row, 'cena');
        const volumeVal = findVal(row, 'wolumenfixing1') || findVal(row, 'wolumen') || findVal(row, 'volume');

        if (!dateVal) {
            if (skippedRows.length < 5) skippedRows.push({ row: rowNumber, reason: 'Missing Data field', data: row });
            continue;
        }
        if (!hourVal) {
            if (skippedRows.length < 5) skippedRows.push({ row: rowNumber, reason: 'Missing h_num field', data: row });
            continue;
        }
        if (priceVal === undefined || priceVal === null || priceVal === '') {
            if (skippedRows.length < 5) skippedRows.push({ row: rowNumber, reason: 'Missing Price field', data: row });
            continue;
        }

        const parsedVolume = volumeVal ? parsePolishNumber(volumeVal) : 0;
        const normalizedDateStr = normalizeDate(String(dateVal));
        const hourInt = typeof hourVal === 'string' ? parseInt(hourVal) : Number(hourVal);

        // Sanity Check for Hour (1-24, maybe 25 for DST ext)
        // TGE usually uses 1-24. If we get 33, it's garbage.
        if (isNaN(hourInt) || hourInt < 1 || hourInt > 25) {
            if (skippedRows.length < 5) skippedRows.push({ row: rowNumber, reason: `Invalid Hour: ${hourInt}`, data: row });
            continue;
        }

        // Generate Doc ID: YYYY-MM-DD-HH
        // Pad hour to 2 digits
        const hourStr = hourInt.toString().padStart(2, '0');
        const docId = `${normalizedDateStr}-${hourStr}`;

        const entry: ProcessedEnergyPrice = {
            date: normalizedDateStr,
            hour: hourInt,
            price: parsePolishNumber(priceVal),
            volume: isNaN(parsedVolume) ? 0 : parsedVolume,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: userEmail
        };

        const ref = adminDb.collection('energy_prices').doc(docId);
        currentBatch.set(ref, entry, { merge: true });

        batchCount++;
        processedCount++;

        if (batchCount >= maxBatchSize) {
            console.log(`[EnergyPrices] Committing batch of ${batchCount} records...`);
            await currentBatch.commit();
            currentBatch = adminDb.batch(); // Start new batch
            batchCount = 0;
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await currentBatch.commit();
    }

    return {
        processedCount,
        skippedCount: data.length - processedCount,
        skippedRows,
        errors: []
    };
}
