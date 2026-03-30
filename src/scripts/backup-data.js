/**
 * backup-data.js
 * 
 * Backup Booking, Transaction, Vehicle, CustomerContext ke JSON
 * TIDAK menghapus data - hanya export untuk safety net
 * 
 * Usage: node src/scripts/backup-data.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, 'backups');
const DATE = new Date().toISOString().slice(0, 10).replace(/-/g, '');

async function backup() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('💾  BACKUP DATA - SQL PostgreSQL');
    console.log('═══════════════════════════════════════════════════════\n');

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const summary = {};

    // 1. Backup Bookings
    console.log('📥 1/4 Backing up Bookings...');
    const bookings = await prisma.booking.findMany({
        include: {
            customer: { select: { phone: true, name: true } },
            vehicle: { select: { modelName: true, plateNumber: true } }
        }
    });
    const bookingFile = path.join(BACKUP_DIR, `backup_booking_${DATE}.json`);
    fs.writeFileSync(bookingFile, JSON.stringify(bookings, null, 2));
    summary.bookings = bookings.length;
    console.log(`   ✅ ${bookings.length} bookings → ${bookingFile}`);

    // 2. Backup Transactions
    console.log('📥 2/4 Backing up Transactions...');
    const transactions = await prisma.transaction.findMany({
        include: {
            customer: { select: { phone: true, name: true } },
            booking: { select: { id: true, serviceType: true } }
        }
    });
    const txFile = path.join(BACKUP_DIR, `backup_transaction_${DATE}.json`);
    fs.writeFileSync(txFile, JSON.stringify(transactions, null, 2));
    summary.transactions = transactions.length;
    console.log(`   ✅ ${transactions.length} transactions → ${txFile}`);

    // 3. Backup Vehicles
    console.log('📥 3/4 Backing up Vehicles...');
    const vehicles = await prisma.vehicle.findMany({
        include: {
            customer: { select: { phone: true, name: true } }
        }
    });
    const vehicleFile = path.join(BACKUP_DIR, `backup_vehicle_${DATE}.json`);
    fs.writeFileSync(vehicleFile, JSON.stringify(vehicles, null, 2));
    summary.vehicles = vehicles.length;
    console.log(`   ✅ ${vehicles.length} vehicles → ${vehicleFile}`);

    // 4. Backup CustomerContext
    console.log('📥 4/4 Backing up CustomerContext...');
    const contexts = await prisma.customerContext.findMany();
    const ctxFile = path.join(BACKUP_DIR, `backup_context_${DATE}.json`);
    fs.writeFileSync(ctxFile, JSON.stringify(contexts, null, 2));
    summary.contexts = contexts.length;
    console.log(`   ✅ ${contexts.length} customer contexts → ${ctxFile}`);

    // 5. Backup Customers (just for reference)
    console.log('\n📥 5/5 Backing up Customers (reference)...');
    const customers = await prisma.customer.findMany({
        select: {
            id: true,
            phone: true,
            whatsappLid: true,
            name: true,
            phoneReal: true,
            status: true,
            totalSpending: true,
            createdAt: true
        }
    });
    const custFile = path.join(BACKUP_DIR, `backup_customer_${DATE}.json`);
    fs.writeFileSync(custFile, JSON.stringify(customers, null, 2));
    summary.customers = customers.length;
    console.log(`   ✅ ${customers.length} customers → ${custFile}`);

    // 6. Backup DirectMessage count (per customer)
    console.log('\n📥 6/6 Backing up DirectMessage metadata...');
    const dmCount = await prisma.directMessage.count();
    summary.directMessages = dmCount;
    console.log(`   ✅ ${dmCount} direct messages (metadata only, full data akan di-import dari Firestore)`);

    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 BACKUP SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📦 Customers:        ${summary.customers}`);
    console.log(`📦 Bookings:         ${summary.bookings}`);
    console.log(`📦 Transactions:     ${summary.transactions}`);
    console.log(`📦 Vehicles:         ${summary.vehicles}`);
    console.log(`📦 CustomerContext:  ${summary.contexts}`);
    console.log(`📦 DirectMessages:   ${summary.directMessages}`);
    console.log(`📁 Backup directory: ${BACKUP_DIR}`);
    console.log('\n✅ Backup complete! Data aman di folder backups/');
}

backup().catch(e => {
    console.error('❌ Backup failed:', e);
    process.exit(1);
}).finally(() => {
    prisma.$disconnect();
});
