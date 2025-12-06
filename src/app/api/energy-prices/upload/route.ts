import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { EnergyPriceCSVRow, parsePolishNumber } from '@/types/energy-prices';
import Papa from 'papaparse';
import admin from 'firebase-admin';
import iconv from 'iconv-lite';

export async function POST(request: NextRequest) {
    try {
        // Verify admin authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        // Get user data to check admin role
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
        }

        // Parse the uploaded CSV data
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Decoding strategy:
        // 1. Try to decode as UTF-8 first to safely remove BOM if present
        // 2. If it produces replacement characters or garbage, fallback to win1250
        // But for simplicity and since Polish excel files are often Windows-1250, we start there.
        // However, Windows-1250 doesn't have a BOM. UTF-8 does.

        let text = iconv.decode(buffer, 'win1250');

        // Remove UTF-8 BOM if it was read as Windows-1250 characters (ï»¿)
        // In Windows-1250: ï (\xEF), » (\xBB), ¿ (\xBF)
        // Note: internal representation might vary, but let's strip widely known potential garbage
        // Alternatively, better to remove \uFEFF if we decoded as UTF-8.

        // Let's try to detect if it's UTF-8. 
        // If the buffer starts with EF BB BF, it IS UTF-8.
        if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
            text = iconv.decode(buffer, 'utf-8');
            text = text.trim(); // strip BOM/whitespace
        } else {
            // Assume win1250 but handle potential UTF-8 read as win1250 artifacts if detection failed
            text = text.replace(/^\u00EF\u00BB\u00BF/, '');
            text = text.trim();
        }

        // Parse CSV
        const parseResult = Papa.parse<any>(text, { // Use any for row type to handle dynamic keys
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim().replace(/^[\W_]+/, '') // Sanitize headers: remove leading non-word chars (like BOM remnants)
        });

        if (parseResult.errors.length > 0) {
            return NextResponse.json({
                error: 'CSV parsing failed',
                details: parseResult.errors
            }, { status: 400 });
        }

        // Transform and validate data
        const entries: any[] = [];
        const skippedRows: { row: number; reason: string; data: any }[] = [];
        let rowNumber = 0;

        console.log(`Parsing ${parseResult.data.length} rows from CSV`);

        // Helper to normalize date to YYYY-MM-DD
        const normalizeDate = (dateStr: string): string => {
            if (!dateStr) return '';
            dateStr = dateStr.trim();

            // Handle D.M.YYYY or DD.MM.YYYY (e.g. 1.12.2025 or 01.12.2025)
            // Fix: ensure we match dots correctly and pad values
            if (dateStr.includes('.')) {
                const parts = dateStr.split('.');
                if (parts.length === 3) {
                    const day = parts[0].trim().padStart(2, '0');
                    const month = parts[1].trim().padStart(2, '0');
                    const year = parts[2].trim();
                    return `${year}-${month}-${day}`;
                }
            }

            // Handle YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return dateStr;
            }

            // Handle YYYY-M-D
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                }
            }

            return dateStr;
        };

        // Fuzzy key finder specifically for 'Data', 'h_num', 'Average of Cena'
        const findVal = (row: any, keyPart: string) => {
            const key = Object.keys(row).find(k => k.toLowerCase().includes(keyPart.toLowerCase()));
            return key ? row[key] : undefined;
        };

        for (const row of parseResult.data) {
            rowNumber++;

            // Use fuzzy matching to find columns
            const dateVal = findVal(row, 'data');
            const hourVal = findVal(row, 'h_num') || findVal(row, 'godzina'); // Fallback to 'godzina' just in case
            const priceVal = findVal(row, 'average of cena') || findVal(row, 'cena');

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

            const entry: any = {
                date: normalizeDate(String(dateVal)),
                hour: typeof hourVal === 'string' ? parseInt(hourVal) : Number(hourVal),
                price: parsePolishNumber(priceVal),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: userData?.email || 'unknown'
            };

            // Validate parsed values
            if (isNaN(entry.hour)) {
                if (skippedRows.length < 5) skippedRows.push({ row: rowNumber, reason: 'Invalid hour', data: row });
                continue;
            }
            if (isNaN(entry.price)) {
                if (skippedRows.length < 5) skippedRows.push({ row: rowNumber, reason: 'Invalid price', data: row });
                continue;
            }

            entries.push(entry);
        }

        console.log(`Prepared ${entries.length} entries for upload`);
        console.log(`Sample entries:`, entries.slice(0, 3));

        // Batch write to Firestore
        const batchSize = 500;
        const batches = [];
        let totalCommitted = 0;

        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = adminDb.batch();
            const chunk = entries.slice(i, i + batchSize);

            chunk.forEach(entry => {
                // Use deterministic ID to prevent duplicates (YYYY-MM-DD-H)
                const docId = `${entry.date}-${entry.hour}`;
                const docRef = adminDb.collection('energy_prices').doc(docId);
                batch.set(docRef, entry);
            });

            await batch.commit();
            totalCommitted += chunk.length;
            console.log(`Committed batch ${Math.floor(i / batchSize) + 1}: ${totalCommitted}/${entries.length}`);
        }

        return NextResponse.json({
            success: true,
            count: entries.length,
            message: `Successfully uploaded ${entries.length} price entries`
        });

    } catch (error: any) {
        console.error('Error uploading energy prices:', error);
        return NextResponse.json(
            { error: 'Upload failed', details: error.message },
            { status: 500 }
        );
    }
}
