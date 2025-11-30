// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Script to import JSON data to Firebase Firestore
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Initialize Firebase Admin
const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function importData() {
    console.log('🔄 Starting Firebase import...');

    try {
        // Load exported data
        const dataPath = path.join(__dirname, 'data-export.json');
        console.log(`📂 Loading data from: ${dataPath}`);

        const rawData = fs.readFileSync(dataPath, 'utf8');
        const data = JSON.parse(rawData);

        console.log(`📊 Data loaded:`);
        console.log(`   - Export date: ${data.exportDate}`);
        console.log(`   - Users: ${data.users.length}`);

        let importedUsers = 0;
        let importedLeads = 0;
        let createdAuthUsers = 0;

        // Process each user
        for (const user of data.users) {
            console.log(`\n👤 Processing user: ${user.email}`);

            try {
                // Create Firebase Auth user
                let firebaseUser;
                try {
                    firebaseUser = await auth.getUserByEmail(user.email);
                    console.log(`   ℹ️  Auth user already exists`);
                } catch (error) {
                    // User doesn't exist, create with random password (they'll need to reset)
                    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
                    firebaseUser = await auth.createUser({
                        uid: user.id,
                        email: user.email,
                        emailVerified: true,
                        password: tempPassword,
                        displayName: user.name || undefined
                    });
                    console.log(`   ✅ Created Auth user`);
                    createdAuthUsers++;
                }

                // Create Firestore user document
                const userData = {
                    uid: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    isBlocked: user.isBlocked,
                    lastLogin: user.lastLogin ? admin.firestore.Timestamp.fromDate(new Date(user.lastLogin)) : null,
                    searchCount: user.searchCount,
                    createdAt: admin.firestore.Timestamp.fromDate(new Date(user.createdAt)),
                    updatedAt: admin.firestore.Timestamp.fromDate(new Date(user.updatedAt))
                };

                await db.collection('users').doc(user.id).set(userData);
                console.log(`   ✅ Created Firestore user document`);
                importedUsers++;

                // Import user's leads as subcollection
                if (user.leads && user.leads.length > 0) {
                    console.log(`   📋 Importing ${user.leads.length} leads...`);

                    for (const lead of user.leads) {
                        const leadData = {
                            id: lead.id,
                            companyName: lead.companyName,
                            address: lead.address,
                            phone: lead.phone,
                            website: lead.website,
                            nip: lead.nip,
                            status: lead.status,
                            priority: lead.priority,
                            notes: lead.notes,
                            keyPeople: lead.keyPeople || [],
                            revenue: lead.revenue,
                            employees: lead.employees,
                            socials: lead.socials || null,
                            description: lead.description,
                            technologies: lead.technologies || [],
                            createdAt: admin.firestore.Timestamp.fromDate(new Date(lead.createdAt)),
                            updatedAt: admin.firestore.Timestamp.fromDate(new Date(lead.updatedAt))
                        };

                        await db.collection('users').doc(user.id).collection('leads').doc(lead.id).set(leadData);
                        importedLeads++;
                    }

                    console.log(`   ✅ Imported ${user.leads.length} leads`);
                }

            } catch (error) {
                console.error(`   ❌ Error processing user ${user.email}:`, error.message);
            }
        }

        console.log(`\n✨ Import complete!`);
        console.log(`📊 Summary:`);
        console.log(`   - Auth users created: ${createdAuthUsers}`);
        console.log(`   - Firestore users: ${importedUsers}`);
        console.log(`   - Total leads: ${importedLeads}`);

    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    }
}

importData()
    .then(() => {
        console.log('\n🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Import failed:', error);
        process.exit(1);
    });
