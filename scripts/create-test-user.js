
const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

if (!process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    console.error('Missing FIREBASE_ADMIN_PRIVATE_KEY');
    process.exit(1);
}

const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();
const auth = admin.auth();

async function createTestUser() {
    const email = 'test-agent@ekovoltis.pl';
    const password = 'password123';
    const displayName = 'Test Agent';

    try {
        // Check if user exists
        try {
            const existingUser = await auth.getUserByEmail(email);
            console.log('User already exists, deleting...');
            await auth.deleteUser(existingUser.uid);
        } catch (e) {
            // User doesn't exist, ignore
        }

        // Create user
        const userRecord = await auth.createUser({
            email,
            password,
            displayName,
            emailVerified: true, // Important!
        });

        console.log('Successfully created new user:', userRecord.uid);

        // Set custom claims (optional, but good for role-based auth if used)
        await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });

        // Create Firestore document
        await db.collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email: email,
            name: displayName,
            role: 'admin',
            isBlocked: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            searchCount: 0
        });

        console.log('Successfully created Firestore document for admin user');
        process.exit(0);
    } catch (error) {
        console.error('Error creating test user:', error);
        process.exit(1);
    }
}

createTestUser();
