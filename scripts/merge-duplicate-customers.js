#!/usr/bin/env node
/**
 * Merge duplicate customers created by Firestore backfill.
 * 
 * The backfill script created customers with phone "628xxx" (digits only),
 * but the live system uses "628xxx@lid" or "628xxx@c.us". This creates
 * duplicates. This script merges them by moving DirectMessages to the
 * active customer (the one with @lid/@c.us suffix) and deleting the stale one.
 * 
 * Usage: node scripts/merge-duplicate-customers.js [--dry-run]
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

async function mergeDuplicates() {
    console.log(`🔄 [Merge] Finding duplicate customers... ${isDryRun ? '(DRY RUN)' : ''}\n`);

    // Find all customers whose phone is digits only (no @lid or @c.us)
    // These are the ones created by backfill
    const backfillCustomers = await prisma.customer.findMany({
        where: {
            phone: {
                not: { contains: '@' }
            }
        },
        select: {
            id: true,
            phone: true,
            name: true,
            lastMessageAt: true,
            _count: { select: { messages: true } }
        }
    });

    console.log(`📊 Found ${backfillCustomers.length} customers with plain phone numbers (from backfill).\n`);

    let merged = 0;
    let skipped = 0;
    let noMatch = 0;

    for (const staleCustomer of backfillCustomers) {
        // Skip very short phone numbers (likely garbage data)
        if (staleCustomer.phone.length < 8) {
            skipped++;
            continue;
        }

        // Find matching active customer with @lid or @c.us (exact match only)
        const activeCustomer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { phone: `${staleCustomer.phone}@lid` },
                    { phone: `${staleCustomer.phone}@c.us` },
                    { whatsappLid: `${staleCustomer.phone}@lid` },
                ],
                id: { not: staleCustomer.id }  // Exclude self
            },
            select: {
                id: true,
                phone: true,
                name: true,
                lastMessageAt: true,
                _count: { select: { messages: true } }
            }
        });

        if (!activeCustomer) {
            noMatch++;
            continue;
        }

        const staleMsgCount = staleCustomer._count.messages;
        
        console.log(`🔗 MERGE: "${staleCustomer.name || staleCustomer.phone}" (${staleMsgCount} msgs)`);
        console.log(`   FROM: ${staleCustomer.phone} (ID: ${staleCustomer.id.substring(0, 8)}...)`);
        console.log(`   INTO: ${activeCustomer.phone} (ID: ${activeCustomer.id.substring(0, 8)}..., ${activeCustomer._count.messages} msgs)`);

        if (!isDryRun) {
            // Move all DirectMessages from stale to active customer
            const moveResult = await prisma.directMessage.updateMany({
                where: { customerId: staleCustomer.id },
                data: { customerId: activeCustomer.id }
            });
            console.log(`   ✅ Moved ${moveResult.count} messages`);

            // Move bookings too if any
            const moveBookings = await prisma.booking.updateMany({
                where: { customerId: staleCustomer.id },
                data: { customerId: activeCustomer.id }
            });
            if (moveBookings.count > 0) {
                console.log(`   ✅ Moved ${moveBookings.count} bookings`);
            }

            // Move transactions
            const moveTx = await prisma.transaction.updateMany({
                where: { customerId: staleCustomer.id },
                data: { customerId: activeCustomer.id }
            });
            if (moveTx.count > 0) {
                console.log(`   ✅ Moved ${moveTx.count} transactions`);
            }

            // Delete CustomerContext for stale (if exists)
            await prisma.customerContext.deleteMany({
                where: { phone: staleCustomer.phone }
            }).catch(() => {});

            // Delete vehicles for stale customer
            await prisma.vehicle.deleteMany({
                where: { customerId: staleCustomer.id }
            }).catch(() => {});

            // Delete stale customer
            await prisma.customer.delete({
                where: { id: staleCustomer.id }
            });
            console.log(`   🗑️  Deleted stale customer record`);

            // Update active customer's lastMessageAt from actual latest message
            const latestMsg = await prisma.directMessage.findFirst({
                where: { customerId: activeCustomer.id },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true, content: true }
            });

            if (latestMsg) {
                await prisma.customer.update({
                    where: { id: activeCustomer.id },
                    data: {
                        lastMessageAt: latestMsg.createdAt,
                        lastMessage: latestMsg.content,
                    }
                });
            }
        }
        
        merged++;
        console.log('');
    }

    console.log(`\n🎉 [Merge] Done!`);
    console.log(`   Merged: ${merged}`);
    console.log(`   No active match: ${noMatch}`);
    console.log(`   Skipped: ${skipped}`);
    
    if (isDryRun) {
        console.log(`\n⚠️  This was a DRY RUN. Run without --dry-run to execute.`);
    }
}

mergeDuplicates()
    .catch(err => console.error('❌ Error:', err))
    .finally(() => prisma.$disconnect());
