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

        // Try to detect encoding or assume Windows-1250 (common for Polish Excel CSVs)
        // We'll try decoding as Windows-1250 first, as that's the most likely culprit for broken Polish chars
        let text = iconv.decode(buffer, 'win1250');

        // Quick check if it looks like valid UTF-8 already (e.g. if user saved as UTF-8)
        // If the file was actually UTF-8, decoding as win1250 might mess it up differently.
        // But usually "" replacement characters indicate UTF-8 read as ASCII/ISO.
        // If we see "poniedziaek" in the output of previous attempts, it means it was likely UTF-8 read as something else OR Windows-1250 read as UTF-8.

        // Let's try a smarter approach:
        // If the file is valid UTF-8, use it. If not, try Windows-1250.
        // But detection is hard. Given the user's issues, let's try to enforce UTF-8 first, 
        // and if that produces replacement characters, fallback or try win1250.

        // Actually, the previous code used `await file.text()` which defaults to UTF-8.
        // And we saw "poniedziaek" in the logs. This usually means the file IS Windows-1250 (or ISO-8859-2) and was read as UTF-8.
        // So decoding as Windows-1250 is the correct fix.

        text = iconv.decode(buffer, 'win1250');

        // Parse CSV
        const parseResult = Papa.parse<EnergyPriceCSVRow>(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false // We'll handle type conversion manually
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
            // Trim whitespace
            dateStr = dateStr.trim();

            // If already YYYY-MM-DD (e.g. 2024-01-01)
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return dateStr;
            }

            // Handle YYYY-M-D (e.g. 2024-1-1)
            if (dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    const year = parts[0];
                    const month = parts[1].padStart(2, '0');
                    const day = parts[2].padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }
            }

            // Handle D.M.YYYY or DD.MM.YYYY (e.g. 1.12.2025 or 01.12.2025)
            if (dateStr.includes('.')) {
                const parts = dateStr.split('.');
                if (parts.length === 3) {
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    const year = parts[2];
                    return `${year}-${month}-${day}`;
                }
            }

            return dateStr; // Return original if no match, validation will catch it later
        };

        for (const row of parseResult.data) {
            rowNumber++;

            // Check for missing fields and log reason
            if (!row.Data) {
                if (skippedRows.length < 5) skippedRows.push({ row: rowNumber, reason: 'Missing Data field', data: row });
                continue;
            }
            if (!row.h_num) {
                if (skippedRows.length < 5) skippedRows.push({ row: rowNumber, reason: 'Missing h_num field', data: row });
                continue;
            }
            if (row['Average of Cena'] === undefined || row['Average of Cena'] === null || row['Average of Cena'] === '') {
                if (skippedRows.length < 5) skippedRows.push({ row: rowNumber, reason: 'Missing Average of Cena field', data: row });
                continue;
            }

            const entry: any = {
                date: normalizeDate(row.Data), // Normalize date here
                hour: typeof row.h_num === 'string' ? parseInt(row.h_num) : row.h_num,
                price: parsePolishNumber(row['Average of Cena']),
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
