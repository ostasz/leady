import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize
if (!admin.apps.length) {
    const serviceAccount = {
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    };
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = getFirestore();

async function testBatch() {
    console.log('🧪 Starting Batch Test...');
    const maxBatchSize = 250;
    const totalItems = 600;
    const collectionRef = db.collection('test_batch_sim');

    let batch = db.batch();
    let count = 0;
    let totalCommitted = 0;

    for (let i = 0; i < totalItems; i++) {
        const ref = collectionRef.doc(`item_${i}`);
        batch.set(ref, { id: i, timestamp: Date.now() });
        count++;

        if (count >= maxBatchSize) {
            console.log(`[Test] Committing batch of ${count} items...`);
            await batch.commit();
            batch = db.batch();
            totalCommitted += count;
            count = 0;
        }
    }

    if (count > 0) {
        console.log(`[Test] Committing final batch of ${count} items...`);
        await batch.commit();
        totalCommitted += count;
    }

    console.log(`✅ Successfully committed ${totalCommitted} items.`);

    // Cleanup
    console.log('🧹 Cleaning up...');
    // (Optional: delete the docs, but for now just exit)
}

testBatch().catch(console.error);
