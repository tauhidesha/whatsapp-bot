/**
 * Fix duplicate customers caused by LID vs phone number mismatch.
 * 
 * Problem: WhatsApp LID (e.g., 32208110772478@lid) and raw phone (32208110772478)
 * create separate customer records for the same person.
 * 
 * This script:
 * 1. Finds customers with matching numeric phone but different suffixes
 * 2. Merges them into one record (keeps the one with bookings)
 * 3. Updates all related records (bookings, transactions, messages, etc.)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractNumeric(phone: string): string {
  return phone.replace(/@c\.us$|@lid$|@lid/g, '').replace(/\D/g, '');
}

async function main() {
  console.log('🔍 Scanning for duplicate customers by numeric phone...\n');

  const allCustomers = await prisma.customer.findMany({
    include: {
      bookings: true,
      transactions: true,
      messages: true,
      vehicles: true,
      customerContext: true,
    }
  });

  // Group by numeric phone
  const groups = new Map<string, typeof allCustomers>();
  for (const c of allCustomers) {
    const numeric = extractNumeric(c.phone);
    if (!numeric || numeric.length < 10) continue; // Skip invalid
    
    if (!groups.has(numeric)) groups.set(numeric, []);
    groups.get(numeric)!.push(c);
  }

  // Find duplicates
  const duplicates = Array.from(groups.entries()).filter(([_, customers]) => customers.length > 1);
  
  if (duplicates.length === 0) {
    console.log('✅ No duplicate customers found.');
    return;
  }

  console.log(`Found ${duplicates.length} group(s) of duplicate customers:\n`);

  let totalMerged = 0;

  for (const [numeric, customers] of duplicates) {
    console.log(`📱 Phone: ${numeric}`);
    for (const c of customers) {
      console.log(`   - ${c.name || '(no name)'} | ${c.phone} | LID: ${c.whatsappLid || '-'} | bookings: ${c.bookings.length} | messages: ${c.messages.length}`);
    }

    // Pick the "winner": prefer customer with bookings, then with more data
    const sorted = [...customers].sort((a, b) => {
      if (a.bookings.length !== b.bookings.length) return b.bookings.length - a.bookings.length;
      if (a.transactions.length !== b.transactions.length) return b.transactions.length - a.transactions.length;
      if (a.messages.length !== b.messages.length) return b.messages.length - a.messages.length;
      return 0;
    });

    const winner = sorted[0];
    const losers = sorted.slice(1);

    console.log(`   👑 Winner: ${winner.name} (${winner.id})`);

    for (const loser of losers) {
      console.log(`   🔄 Merging "${loser.name}" → "${winner.name}"...`);

      // 1. Reassign bookings
      if (loser.bookings.length > 0) {
        await prisma.booking.updateMany({
          where: { customerId: loser.id },
          data: { customerId: winner.id }
        });
      }

      // 2. Reassign transactions
      if (loser.transactions.length > 0) {
        await prisma.transaction.updateMany({
          where: { customerId: loser.id },
          data: { customerId: winner.id }
        });
      }

      // 3. Reassign messages
      if (loser.messages.length > 0) {
        await prisma.directMessage.updateMany({
          where: { customerId: loser.id },
          data: { customerId: winner.id }
        });
      }

      // 4. Reassign vehicles
      if (loser.vehicles.length > 0) {
        await prisma.vehicle.updateMany({
          where: { customerId: loser.id },
          data: { customerId: winner.id }
        });
      }

      // 5. Handle customerContext
      if (loser.customerContext) {
        if (winner.customerContext) {
          await prisma.customerContext.delete({ where: { id: loser.customerContext.id } });
        } else {
          await prisma.customerContext.update({
            where: { id: loser.customerContext.id },
            data: { phone: winner.phone }
          });
        }
      }

      // 6. Clear loser's unique fields first (to avoid constraint conflicts)
      await prisma.customer.update({
        where: { id: loser.id },
        data: { whatsappLid: null }
      });

      // 7. Update winner's data from loser
      const updateData: any = {};
      if (!winner.name && loser.name) updateData.name = loser.name;
      if (loser.phoneReal && !winner.phoneReal) updateData.phoneReal = loser.phoneReal;
      if (loser.lastMessage && !winner.lastMessage) updateData.lastMessage = loser.lastMessage;
      if (loser.lastMessageAt && (!winner.lastMessageAt || loser.lastMessageAt > winner.lastMessageAt)) {
        updateData.lastMessageAt = loser.lastMessageAt;
      }
      if (loser.profilePicUrl && !winner.profilePicUrl) updateData.profilePicUrl = loser.profilePicUrl;
      if (loser.whatsappLid && !winner.whatsappLid) updateData.whatsappLid = loser.whatsappLid;

      if (Object.keys(updateData).length > 0) {
        await prisma.customer.update({
          where: { id: winner.id },
          data: updateData
        });
      }

      // 8. Delete the loser
      await prisma.customer.delete({ where: { id: loser.id } });
      console.log(`   ✅ Merged and deleted "${loser.name}" (${loser.id})`);
      totalMerged++;
    }
    console.log('');
  }

  console.log(`\n📋 Summary: Merged ${totalMerged} duplicate customer(s)`);
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
