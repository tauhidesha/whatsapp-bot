/**
 * One-time migration script to sync Customer.name with their most recent booking's customerName.
 * 
 * Problem: Bookings created via AI bot or admin form saved names independently without
 * updating the Customer record, causing split identities (e.g., "Arul" vs "Rully").
 * 
 * This script finds all customers with bookings and updates their name to match
 * the most recent booking's customerName.
 * 
 * Usage: npx tsx scripts/sync-customer-names.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Starting customer name sync...');

  // Get all customers that have at least one booking
  const customersWithBookings = await prisma.customer.findMany({
    where: {
      bookings: {
        some: {}
      }
    },
    include: {
      bookings: {
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  console.log(`📊 Found ${customersWithBookings.length} customers with bookings`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const customer of customersWithBookings) {
    if (customer.bookings.length === 0) continue;

    // Get the most recent booking
    const latestBooking = customer.bookings[0];
    const latestName = latestBooking.customerName;

    if (!latestName) {
      skippedCount++;
      continue;
    }

    // Skip if names already match
    if (customer.name === latestName) {
      skippedCount++;
      continue;
    }

    // Update customer name
    await prisma.customer.update({
      where: { id: customer.id },
      data: { name: latestName }
    });

    console.log(`✅ Updated: "${customer.name || '(empty)'}" → "${latestName}" (Phone: ${customer.phone})`);
    updatedCount++;
  }

  console.log('\n📋 Summary:');
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log('✨ Done!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
