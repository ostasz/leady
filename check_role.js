const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = 'ostasz@mac.com';
    console.log(`Checking role for ${email}...`);

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });
        console.log('User data:', user);
    } catch (e) {
        console.error('Error checking user:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
