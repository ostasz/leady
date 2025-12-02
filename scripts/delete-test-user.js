
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

async function deleteTestUser() {
    const email = 'test-agent@ekovoltis.pl';

    try {
        const userRecord = await auth.getUserByEmail(email);
        await auth.deleteUser(userRecord.uid);
        console.log('Successfully deleted user:', userRecord.uid);

        await db.collection('users').doc(userRecord.uid).delete();
        console.log('Successfully deleted Firestore document');
        process.exit(0);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.log('User not found, nothing to delete.');
            process.exit(0);
        }
        console.error('Error deleting test user:', error);
        process.exit(1);
    }
}

deleteTestUser();
