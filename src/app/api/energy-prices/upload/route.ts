import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { EnergyPriceCSVRow, parsePolishNumber } from '@/types/energy-prices';
import Papa from 'papaparse';
import admin from 'firebase-admin';

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

        const text = await file.text();

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
        const batch = adminDb.batch();

        for (const row of parseResult.data) {
            if (!row.Data || !row.h_num || !row['Average of Cena']) {
                continue; // Skip incomplete rows
            }

            const entry: any = {
                date: row.Data,
                hour: typeof row.h_num === 'string' ? parseInt(row.h_num) : row.h_num,
                price: parsePolishNumber(row['Average of Cena']),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: decodedToken.email || decodedToken.uid
            };

            // Validate
            if (entry.hour < 1 || entry.hour > 24) {
                return NextResponse.json({
                    error: `Invalid hour: ${entry.hour}`
                }, { status: 400 });
            }

            if (isNaN(entry.price) || entry.price < 0) {
                return NextResponse.json({
                    error: `Invalid price: ${entry.price}`
                }, { status: 400 });
            }

            entries.push(entry);

            // Add to batch
            const docRef = adminDb.collection('energy_prices').doc();
            batch.set(docRef, entry);
        }

        // Commit all at once
        await batch.commit();

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
