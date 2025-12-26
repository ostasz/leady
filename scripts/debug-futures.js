
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../service-account-key.json');

// Initialize logic (check if already initialized to handle re-runs if needed, though script usually fresh)
if (process.argv.indexOf('--debug') > -1) {
    try {
        initializeApp({
            credential: cert(serviceAccount)
        });
    } catch (e) { }
} else {
    try {
        initializeApp({
            credential: cert(serviceAccount)
        });
    } catch (e) { }
}

const db = getFirestore();

async function checkData() {
    console.log('Checking futures_data collection...');
    const snapshot = await db.collection('futures_data').limit(20).get();

    if (snapshot.empty) {
        console.log('No documents found in futures_data!');
        return;
    }

    console.log(`Found ${snapshot.size} documents (limit 20). Sample data:`);
    snapshot.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
    });

    // Check specifically for BASE_Y-26
    const baseY26 = await db.collection('futures_data')
        .where('contract', '==', 'BASE_Y-26')
        .limit(5)
        .get();

    console.log(`\nSpecific check for BASE_Y-26: ${baseY26.size} docs found.`);
    baseY26.forEach(doc => console.log(doc.id, doc.data()));
}

checkData().catch(console.error);
