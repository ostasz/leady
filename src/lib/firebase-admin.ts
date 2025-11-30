import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK (server-side)
// We use a lazy initialization pattern to avoid build-time errors when env vars are missing
function getFirebaseAdmin() {
    if (!admin.apps.length) {
        const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
        const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

        // During build time or if env vars are missing, we don't initialize
        // This prevents "next build" from crashing if secrets aren't available in the build environment
        if (!privateKey || !projectId || !clientEmail) {
            console.warn('⚠️ Firebase Admin credentials missing. Skipping initialization.');
            return null;
        }

        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    privateKey: privateKey.replace(/\\n/g, '\n'),
                    clientEmail
                })
            });
        } catch (error) {
            console.error('Firebase Admin initialization error:', error);
        }
    }
    return admin;
}

// Export proxies that initialize on first access
const adminAuth = new Proxy({} as admin.auth.Auth, {
    get: (_target, prop) => {
        const app = getFirebaseAdmin();
        if (!app) throw new Error('Firebase Admin not initialized (missing credentials)');
        // @ts-ignore
        return app.auth()[prop];
    }
});

const adminDb = new Proxy({} as admin.firestore.Firestore, {
    get: (_target, prop) => {
        const app = getFirebaseAdmin();
        if (!app) throw new Error('Firebase Admin not initialized (missing credentials)');
        // @ts-ignore
        return app.firestore()[prop];
    }
});

export { adminAuth, adminDb, admin };
