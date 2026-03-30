require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function reset() {
    console.log('═══════════════════════════════════════════════════');
    console.log('🗑️  RESET CUSTOMER DATA');
    console.log('═══════════════════════════════════════════════════\n');

    // Delete in correct order (respect foreign keys)
    console.log('⏳ Deleting in correct order (FK safe)...\n');

    console.log('   1. DirectMessage...');
    await prisma.directMessage.deleteMany();
    console.log('      ✅ Done');

    console.log('   2. CoatingMaintenance...');
    await prisma.coatingMaintenance.deleteMany();
    console.log('      ✅ Done');

    console.log('   3. Transaction...');
    await prisma.transaction.deleteMany();
    console.log('      ✅ Done');

    console.log('   4. Booking...');
    await prisma.booking.deleteMany();
    console.log('      ✅ Done');

    console.log('   5. Vehicle...');
    await prisma.vehicle.deleteMany();
    console.log('      ✅ Done');

    console.log('   6. CustomerContext...');
    await prisma.customerContext.deleteMany();
    console.log('      ✅ Done');

    console.log('   7. Customer...');
    await prisma.customer.deleteMany();
    console.log('      ✅ Done');

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ RESET COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log('   All customer-related data cleared.');
    console.log('   Users (admin) remain untouched.');
    console.log('\n   Next step: firestore-to-postgres.js\n');
}

reset()
    .catch(e => { console.error('❌ Reset failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
