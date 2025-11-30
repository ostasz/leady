// Script to export existing data from PostgreSQL to JSON
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportData() {
    console.log('🔄 Starting PostgreSQL data export...');

    try {
        // Export users
        console.log('📤 Exporting users...');
        const users = await prisma.user.findMany({
            include: {
                leads: true
            }
        });
        console.log(`✅ Found ${users.length} users`);

        // Calculate total leads
        const totalLeads = users.reduce((sum, user) => sum + (user.leads?.length || 0), 0);
        console.log(`✅ Found ${totalLeads} leads`);

        // Save to JSON
        const exportData = {
            exportDate: new Date().toISOString(),
            users: users.map(user => ({
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                isBlocked: user.isBlocked,
                lastLogin: user.lastLogin?.toISOString() || null,
                searchCount: user.searchCount,
                createdAt: user.createdAt.toISOString(),
                updatedAt: user.updatedAt.toISOString(),
                leads: user.leads?.map(lead => ({
                    id: lead.id,
                    companyName: lead.companyName,
                    address: lead.address,
                    phone: lead.phone,
                    website: lead.website,
                    nip: lead.nip,
                    status: lead.status,
                    priority: lead.priority,
                    notes: lead.notes,
                    keyPeople: lead.keyPeople,
                    revenue: lead.revenue,
                    employees: lead.employees,
                    socials: lead.socials,
                    description: lead.description,
                    technologies: lead.technologies,
                    createdAt: lead.createdAt.toISOString(),
                    updatedAt: lead.updatedAt.toISOString()
                })) || []
            }))
        };

        const exportPath = path.join(__dirname, 'data-export.json');
        fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

        console.log(`✅ Data exported successfully to: ${exportPath}`);
        console.log(`📊 Summary:`);
        console.log(`   - Users: ${users.length}`);
        console.log(`   - Leads: ${totalLeads}`);
        console.log(`   - File size: ${(fs.statSync(exportPath).size / 1024).toFixed(2)} KB`);

    } catch (error) {
        console.error('❌ Export failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

exportData()
    .then(() => {
        console.log('\n✨ Export complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Export failed:', error);
        process.exit(1);
    });
