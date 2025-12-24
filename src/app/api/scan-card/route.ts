import { NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { adminAuth } from '@/lib/firebase-admin';
import { parseBusinessCard } from '@/lib/card-parser';

export const runtime = 'nodejs';

// Initialize Vision Client
// We reuse the Firebase Admin Service Account credentials if available,
// or expect specific Google Cloud credentials.
const client = new ImageAnnotatorClient({
    apiEndpoint: 'eu-vision.googleapis.com',
    credentials: {
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL,
        private_key: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
    },
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GOOGLE_PROJECT_ID
});

export async function POST(request: Request) {
    // console.log('[ScanCard] Request received'); // Detailed logging disabled for privacy/noise

    try {
        // 1. Auth Check (Admin Only)
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        // Strict Admin Check
        // Using custom claim 'admin' or explicit 'role' property if set in custom claims.
        // Also allow specific admin email to bypass claim issues (e.g. stale token).
        if (!decodedToken.admin && decodedToken.role !== 'admin' && decodedToken.email !== 'ostasz@mac.com') {
            return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
        }

        const { image, language = 'pl' } = await request.json();

        // 2. Input Validation
        if (!image || typeof image !== 'string') {
            return NextResponse.json({ error: 'No valid image provided' }, { status: 400 });
        }

        if (language !== 'pl' && language !== 'en') {
            return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
        }

        // Approx limit check (4MB base64 is roughly 3MB binary)
        // 5,500,000 chars of base64 ~ 4.1MB
        if (image.length > 5_500_000) {
            return NextResponse.json({ error: 'Image too large (max ~4MB)' }, { status: 413 });
        }

        // 3. Call Google Cloud Vision
        // Remove header if present (e.g. "data:image/jpeg;base64,")
        const base64Image = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Image, 'base64');

        // Ustawienie priorytetu języka
        const languageHints = language === 'pl' ? ['pl', 'en'] : ['en'];

        const requestPayload = {
            image: {
                content: buffer
            },
            imageContext: {
                languageHints: languageHints
            }
        };

        const [result] = await client.textDetection(requestPayload);
        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
            return NextResponse.json({ error: 'No text detected' }, { status: 422 });
        }

        // detections[0] is the full text
        const fullText = detections[0].description || '';

        // 4. Parse Data (Now Async with Vertex AI)
        const parsedData = await parseBusinessCard(fullText, languageHints);

        // Don't return raw full text in production if not needed, but UI currently uses it for "Full Text" field.
        // We will keep it but ensure no logging of it on server side.

        return NextResponse.json({
            success: true,
            data: parsedData,
            raw: fullText
        });

    } catch (error: any) {
        console.error('[ScanCard] Error:', error.message); // Log only message, not full object potentially containing PII
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
