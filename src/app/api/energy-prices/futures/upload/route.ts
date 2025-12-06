import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FuturesCSVRow, parsePolishNumber } from '@/types/energy-prices';
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

        // Handle encoding (UTF-8 or Win1250 fallback)
        let text = iconv.decode(buffer, 'win1250');
        if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
            text = iconv.decode(buffer, 'utf-8');
            text = text.trim();
        } else {
            text = text.replace(/^\u00EF\u00BB\u00BF/, '');
            text = text.trim();
        }

        // Parse CSV
        const parseResult = Papa.parse<any>(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim().replace(/^[\W_]+/, '')
        });

        if (parseResult.errors.length > 0) {
            return NextResponse.json({
                error: 'CSV parsing failed',
                details: parseResult.errors
            }, { status: 400 });
        }

        const entries: any[] = [];
        const skippedRows: { row: number; reason: string; data: any }[] = [];
        let rowNumber = 0;

        console.log(`Parsing ${parseResult.data.length} rows from Futures CSV`);

        const normalizeDate = (dateStr: string): string => {
            if (!dateStr) return '';
            dateStr = dateStr.trim();
            if (dateStr.includes('.')) {
                const parts = dateStr.split('.');
                if (parts.length === 3) {
                    const day = parts[0].trim().padStart(2, '0');
                    const month = parts[1].trim().padStart(2, '0');
                    const year = parts[2].trim();
                    return `${year}-${month}-${day}`;
                }
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
            return dateStr;
        };

        const findVal = (row: any, keyPart: string) => {
            const key = Object.keys(row).find(k => k.toLowerCase().replace(/\s/g, '').includes(keyPart.toLowerCase()));
            return key ? row[key] : undefined;
        };

        for (const row of parseResult.data) {
            rowNumber++;

            // Columns: DataNotowania, KursRozliczeniowy, Typ kontraktu, Rok dostawy
            const dateVal = findVal(row, 'datanotowania') || findVal(row, 'data');
            const priceVal = findVal(row, 'kursrozliczeniowy') || findVal(row, 'kurs');
            const typeVal = findVal(row, 'typkontraktu') || findVal(row, 'typ');
            const yearVal = findVal(row, 'rokdostawy') || findVal(row, 'rok');

            if (!dateVal || !priceVal || !typeVal || !yearVal) {
                if (skippedRows.length < 5) skippedRows.push({ row: rowNumber, reason: 'Missing required field', data: row });
                continue;
            }

            // We focus mainly on BASE, but let's just store everything or filter?
            // User: "skupimy sie TYLKO na base". Let's filter here to save DB space/noise if they upload massive files.
            // Actually, keep it simple: filter for BASE.
            const contractType = String(typeVal).toUpperCase();
            if (contractType !== 'BASE') {
                // Skip non-BASE
                continue;
            }

            const entry: any = {
                date: normalizeDate(String(dateVal)),
                price: parsePolishNumber(priceVal),
                contractType: 'BASE',
                deliveryYear: parseInt(String(yearVal)),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: userData?.email || 'unknown'
            };

            if (isNaN(entry.price) || isNaN(entry.deliveryYear)) {
                if (skippedRows.length < 5) skippedRows.push({ row: rowNumber, reason: 'Invalid number', data: row });
                continue;
            }

            entries.push(entry);
        }

        console.log(`Prepared ${entries.length} Futures entries for upload`);

        // Batch write to Firestore 'energy_futures'
        const batchSize = 500;
        let totalCommitted = 0;

        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = adminDb.batch();
            const chunk = entries.slice(i, i + batchSize);

            chunk.forEach(entry => {
                // ID: YYYY-MM-DD-Type-Year (e.g., 2025-01-02-BASE-2026)
                const docId = `${entry.date}-${entry.contractType}-${entry.deliveryYear}`;
                const docRef = adminDb.collection('energy_futures').doc(docId);
                batch.set(docRef, entry);
            });

            await batch.commit();
            totalCommitted += chunk.length;
        }

        return NextResponse.json({
            success: true,
            count: entries.length,
            message: `Successfully uploaded ${entries.length} futures entries`
        });

    } catch (error: any) {
        console.error('Error uploading futures:', error);
        return NextResponse.json(
            { error: 'Upload failed', details: error.message },
            { status: 500 }
        );
    }
}
