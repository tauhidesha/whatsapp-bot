#!/usr/bin/env node
/**
 * Resync Customer.lastMessageAt & Customer.lastMessage
 * from actual DirectMessage records.
 * 
 * Run this after a backfill that didn't update these fields.
 * Usage: node scripts/resync-lastMessageAt.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resync() {
    console.log('🔄 [Resync] Syncing Customer.lastMessageAt from DirectMessage records...\n');

    const customers = await prisma.customer.findMany({
        select: {
            id: true,
            phone: true,
            name: true,
            lastMessageAt: true,
        }
    });

    console.log(`📊 Found ${customers.length} customers to check.\n`);

    let updated = 0;
    let skipped = 0;
    let noMessages = 0;

    for (const customer of customers) {
        // Get the actual latest message for this customer
        const latestMessage = await prisma.directMessage.findFirst({
            where: { customerId: customer.id },
            orderBy: { createdAt: 'desc' },
            select: {
                createdAt: true,
                content: true,
            }
        });

        if (!latestMessage) {
            noMessages++;
            continue;
        }

        const actualLastAt = latestMessage.createdAt;
        const currentLastAt = customer.lastMessageAt;

        // Check if they differ (or if currentLastAt is null)
        const needsUpdate = !currentLastAt || 
            Math.abs(actualLastAt.getTime() - currentLastAt.getTime()) > 1000; // >1s difference

        if (needsUpdate) {
            await prisma.customer.update({
                where: { id: customer.id },
                data: {
                    lastMessageAt: actualLastAt,
                    lastMessage: latestMessage.content,
                }
            });
            updated++;
            console.log(`  ✅ ${customer.name || customer.phone}: ${currentLastAt?.toISOString() || 'NULL'} → ${actualLastAt.toISOString()}`);
        } else {
            skipped++;
        }
    }

    console.log(`\n🎉 [Resync] Done!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Already correct: ${skipped}`);
    console.log(`   No messages: ${noMessages}`);
}

resync()
    .catch(err => console.error('❌ Error:', err))
    .finally(() => prisma.$disconnect());
