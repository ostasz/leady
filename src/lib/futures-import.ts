import Papa from 'papaparse';
import { adminDb } from './firebase-admin';
import { parse, isValid, format } from 'date-fns';
import fs from 'fs';
import path from 'path';

const logDebug = (msg: string) => {
    try {
        const logPath = path.join(process.cwd(), 'public', 'debug_import.txt');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${timestamp}][FUTURES-LIB] ${msg}\n`);
    } catch (e) { }
};

interface FuturesCsvRow {
    tge_rtpe_DataNotowania: string;
    tge_rtpe_Kontrakt: string;
    tge_rtpe_KursMax: string;
    tge_rtpe_KursMin: string;
    tge_rtpe_KursRozliczeniowy: string;
    tge_rtpe_LiczbaKontraktow: string;
    tge_rtpe_LiczbaOtwartychPozycji: string;
    tge_rtpe_LiczbaTransakcji: string;
    tge_rtpe_WartoscObrotu: string;
    tge_rtpe_WolumenObrotu: string;
}

interface FuturesEntry {
    date: string; // YYYY-MM-DD
    contract: string; // e.g., BASE_Y-26
    maxPrice: number;
    minPrice: number;
    DKR: number; // Renamed from closingPrice (Kurs Rozliczeniowy)
    contractsCount: number;
    openInterest: number;
    transactionsCount: number;
    turnoverValue: number;
    volume: number;
}

// Helper to parse "PL" style numbers (comma as decimal, spaces as thousands) -> float
const parsePlNumber = (val: string): number => {
    if (!val) return 0;
    // Remove spaces, replace comma with dot
    const cleaned = val.toString().replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

// Helper to parse date
const parseRowDate = (val: string): string | null => {
    if (!val) return null;
    // Trim any whitespace or newlines from the start/end
    const cleanVal = val.trim();
    const datePart = cleanVal.split(' ')[0]; // Remove time if present

    const formats = [
        'd.MM.yyyy',
        'M/d/yyyy', // 1/2/2025
        'dd.MM.yyyy',
        'yyyy-MM-dd'
    ];

    for (const fmt of formats) {
        try {
            const parsed = parse(datePart, fmt, new Date());
            if (isValid(parsed)) {
                return format(parsed, 'yyyy-MM-dd');
            }
        } catch (e) {
            // Check next format
        }
    }

    logDebug(`Date parse warning: Could not validly parse date '${val}' with any known format.`);
    return null;
};

export async function processFuturesData(csvContent: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        logDebug(`Starting processFuturesData. Content length: ${csvContent.length}`);

        const parseResult = Papa.parse<FuturesCsvRow>(csvContent, {
            header: true,
            skipEmptyLines: true,
            delimitersToGuess: [';', ',', '\t'], // Auto-detect delimiter
            transformHeader: (h) => h.trim() // standard header cleanup
        });

        if (parseResult.errors.length > 0) {
            logDebug(`CSV Parse Warnings: ${JSON.stringify(parseResult.errors)}`);
        }

        const data = parseResult.data;
        if (!data || data.length === 0) {
            logDebug('No data parsed!');
            return { success: false, count: 0, error: 'No data found in CSV' };
        }

        logDebug(`Parsed ${data.length} rows. First row keys: ${JSON.stringify(Object.keys(data[0]))}`);
        logDebug(`First row sample: ${JSON.stringify(data[0])}`);

        const entriesBatch: FuturesEntry[] = [];
        let batch = adminDb.batch();
        let writeCount = 0;
        let totalCount = 0;

        // Process rows
        for (const row of data) {
            const dateStr = parseRowDate(row.tge_rtpe_DataNotowania);
            const contract = row.tge_rtpe_Kontrakt;

            if (!dateStr || !contract) {
                // logDebug(`Skipping invalid row. Date: ${row.tge_rtpe_DataNotowania}, Contract: ${row.tge_rtpe_Kontrakt}`);
                continue; // Skip invalid rows
            }

            const entry: FuturesEntry = {
                date: dateStr,
                contract: contract.trim(),
                maxPrice: parsePlNumber(row.tge_rtpe_KursMax),
                minPrice: parsePlNumber(row.tge_rtpe_KursMin),
                DKR: parsePlNumber(row.tge_rtpe_KursRozliczeniowy),
                contractsCount: parsePlNumber(row.tge_rtpe_LiczbaKontraktow),
                openInterest: parsePlNumber(row.tge_rtpe_LiczbaOtwartychPozycji),
                transactionsCount: parsePlNumber(row.tge_rtpe_LiczbaTransakcji),
                turnoverValue: parsePlNumber(row.tge_rtpe_WartoscObrotu),
                volume: parsePlNumber(row.tge_rtpe_WolumenObrotu),
            };

            // Skip entries with no closing price (0 or null in CSV)
            if (entry.DKR === 0) {
                continue;
            }

            // Doc ID: date_contract (e.g., "2025-02-01_BASE_Y-26")
            const docId = `${entry.date}_${entry.contract}`;
            const docRef = adminDb.collection('futures_data').doc(docId);

            batch.set(docRef, entry);
            writeCount++;
            totalCount++;

            if (writeCount >= 250) {
                console.log(`[Futures] Committing batch of ${writeCount} records...`);
                await batch.commit(); // Commit current batch
                batch = adminDb.batch(); // Re-init batch
                writeCount = 0;
            }
        }

        if (writeCount > 0) {
            await batch.commit();
        }

        logDebug(`Successfully processed and committed ${totalCount} futures entries.`);
        return { success: true, count: totalCount };

    } catch (error: any) {
        logDebug(`Error in processFuturesData: ${error.message}`);
        return { success: false, count: 0, error: error.message };
    }
}
