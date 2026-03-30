const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
    console.log('🚀 Starting Database Deduplication (DirectMessage)...');

    const initialCount = await prisma.directMessage.count();
    console.log(`Initial message count: ${initialCount}`);

    try {
        // SQL query to identify and keep only one unique message per set of identical properties
        // We group by customerId, content, role, and createdAt
        // We use string conversion for createdAt if necessary, but PostgreSQL handles timestamps well in GROUP BY
        const cleanupQuery = `
            DELETE FROM "DirectMessage"
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM "DirectMessage"
                GROUP BY "customerId", "content", "role", "createdAt"
            )
        `;

        console.log('Running deduplication query...');
        const deletedCount = await prisma.$executeRawUnsafe(cleanupQuery);
        console.log(`✅ Success! Deleted ${deletedCount} duplicate messages.`);

        const finalCount = await prisma.directMessage.count();
        console.log(`Final message count: ${finalCount}`);
        console.log(`Reduction: ${initialCount - finalCount} rows.`);

    } catch (error) {
        console.error('❌ Error during deduplication:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

cleanup();
