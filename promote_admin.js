require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
    private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_ADMIN_CERT_URL
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function promoteToAdmin(email) {
    try {
        console.log(`Looking for user with email: ${email}`);

        // Find user by email in Firestore
        const usersSnapshot = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (usersSnapshot.empty) {
            console.error(`User with email ${email} not found in Firestore`);
            process.exit(1);
        }

        const userDoc = usersSnapshot.docs[0];
        const userId = userDoc.id;

        console.log(`Found user: ${userId}`);
        console.log(`Current role: ${userDoc.data().role}`);

        // Update role to admin
        await db.collection('users').doc(userId).update({
            role: 'admin',
            updatedAt: admin.firestore.Timestamp.now()
        });

        console.log(`✅ Successfully promoted ${email} to admin!`);

        // Verify the change
        const updatedDoc = await db.collection('users').doc(userId).get();
        console.log(`New role: ${updatedDoc.data().role}`);

        process.exit(0);
    } catch (error) {
        console.error('Error promoting user to admin:', error);
        process.exit(1);
    }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
    console.error('Usage: node promote_admin.js <email>');
    console.error('Example: node promote_admin.js ostasz@mac.com');
    process.exit(1);
}

promoteToAdmin(email);
