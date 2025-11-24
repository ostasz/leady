const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'ostasz@mac.com';
    console.log(`Promoting ${email} to admin...`);

    try {
        const user = await prisma.user.update({
            where: { email },
            data: { role: 'admin' },
        });
        console.log('Success! User is now admin:', user);
    } catch (e) {
        console.error('Error promoting user:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
