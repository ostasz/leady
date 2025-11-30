import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK (server-side)
if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (!privateKey) {
        throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set');
    }

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            privateKey: privateKey.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL
        })
    });
}

const adminAuth = admin.auth();
const adminDb = admin.firestore();

export { adminAuth, adminDb, admin };
