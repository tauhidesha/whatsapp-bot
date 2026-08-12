/**
 * backfill-walkin-context.js
 *
 * One-time script: Seeds CustomerContext for walk-in customers who have
 * completed bookings (PAID/COMPLETED/DONE) but no CustomerContext record.
 *
 * Run: node src/scripts/backfill-walkin-context.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('═══════════════════════════════════════════════');
    console.log('  Backfill CustomerContext for Walk-in Customers');
    console.log('═══════════════════════════════════════════════\n');

    // Find customers with completed bookings but no CustomerContext
    const customers = await prisma.customer.findMany({
        where: {
            bookings: {
                some: { status: { in: ['PAID', 'COMPLETED', 'DONE'] } }
            },
            customerContext: { is: null }
        },
        include: {
            bookings: {
                where: { status: { in: ['PAID', 'COMPLETED', 'DONE'] } },
                orderBy: { bookingDate: 'desc' },
                take: 1
            }
        }
    });

    console.log(`Found ${customers.length} walk-in customers without CustomerContext\n`);

    let created = 0;
    let errors = 0;

    for (const customer of customers) {
        if (!customer.phone) continue; // skip if no phone
        const lastBooking = customer.bookings[0];
        const lastServiceDate = lastBooking?.bookingDate ? new Date(lastBooking.bookingDate) : null;

        try {
            await prisma.customerContext.create({
                data: {
                    id: customer.phone,
                    phone: customer.phone,
                    customerLabel: 'existing',
                    lastServiceAt: lastServiceDate,
                    reviewFollowUpSent: false,
                }
            });
            created++;
            console.log(`  ✓ ${customer.name || customer.phone} — lastService: ${lastServiceDate?.toISOString().slice(0, 10) || '-'}`);
        } catch (err) {
            errors++;
            console.error(`  ✗ ${customer.name || customer.phone}: ${err.message}`);
        }
    }

    console.log(`\n═══════════════════════════════════════════════`);
    console.log(`  Done — Created: ${created}, Errors: ${errors}`);
    console.log(`═══════════════════════════════════════════════`);

    await prisma.$disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
});
