const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

console.log('🔍 Checking Firebase Admin SDK configuration...');

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing required environment variables:');
    if (!projectId) console.error('   - FIREBASE_ADMIN_PROJECT_ID');
    if (!clientEmail) console.error('   - FIREBASE_ADMIN_CLIENT_EMAIL');
    if (!privateKey) console.error('   - FIREBASE_ADMIN_PRIVATE_KEY');
    process.exit(1);
}

console.log(`✅ Configuration found for project: ${projectId}`);
console.log(`   Service Account: ${clientEmail}`);

try {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
        });
    }
    console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error.message);
    process.exit(1);
}

async function verifyConnection() {
    try {
        console.log('Testing Firestore connection...');
        const db = admin.firestore();
        const collections = await db.listCollections();
        console.log('✅ Firestore connection successful!');
        console.log(`   Found ${collections.length} root collections: ${collections.map(c => c.id).join(', ')}`);

        console.log('\n🎉 Firebase Admin SDK is correctly configured!');
    } catch (error) {
        console.error('❌ Firestore connection failed:', error.message);
        process.exit(1);
    }
}

verifyConnection();
