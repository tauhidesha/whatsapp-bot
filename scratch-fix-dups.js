const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findAndFixDuplicates() {
  // 1. Find all customers whose phone doesn't have @lid or @c.us suffix (orphan records)
  const allCustomers = await prisma.customer.findMany({
    include: {
      customerContext: true,
      messages: true,
      bookings: true,
      transactions: true,
      vehicles: true
    }
  });

  // Group by raw digits
  const byDigits = {};
  for (const c of allCustomers) {
    const raw = c.phone.replace(/@c\.us$|@lid$/i, '').replace(/\D/g, '');
    if (!byDigits[raw]) byDigits[raw] = [];
    byDigits[raw].push(c);
  }

  // Find groups with duplicates
  const duplicateGroups = Object.entries(byDigits).filter(([_, group]) => group.length > 1);

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate customers found!');
    
    // But also check for orphan records (phone without suffix)
    const orphans = allCustomers.filter(c => !c.phone.includes('@'));
    if (orphans.length > 0) {
      console.log(`\n⚠️  Found ${orphans.length} orphan records (phone without @lid/@c.us):`);
      for (const o of orphans) {
        console.log(`  - ID: ${o.id} | Phone: ${o.phone} | Name: ${o.name} | Messages: ${o.messages.length} | Bookings: ${o.bookings.length} | Txns: ${o.transactions.length}`);
      }
    }
    return;
  }

  console.log(`Found ${duplicateGroups.length} duplicate group(s):\n`);

  for (const [digits, group] of duplicateGroups) {
    console.log(`=== Digits: ${digits} (${group.length} records) ===`);
    
    // Determine the "primary" (the one with @lid or @c.us suffix, more data)
    const primary = group.find(c => c.phone.includes('@lid')) 
      || group.find(c => c.phone.includes('@c.us'))
      || group.reduce((a, b) => (a.messages.length >= b.messages.length ? a : b));
    
    const duplicates = group.filter(c => c.id !== primary.id);

    console.log(`  PRIMARY: ${primary.phone} (${primary.name}) [${primary.messages.length} msgs, ${primary.bookings.length} bookings, ${primary.transactions.length} txns]`);
    
    for (const dup of duplicates) {
      console.log(`  DUPLICATE: ${dup.phone} (${dup.name}) [${dup.messages.length} msgs, ${dup.bookings.length} bookings, ${dup.transactions.length} txns]`);
      
      // Merge: move messages from dup to primary
      if (dup.messages.length > 0) {
        const moved = await prisma.directMessage.updateMany({
          where: { customerId: dup.id },
          data: { customerId: primary.id }
        });
        console.log(`    → Moved ${moved.count} messages to primary`);
      }

      // Merge: move bookings from dup to primary
      if (dup.bookings.length > 0) {
        const moved = await prisma.booking.updateMany({
          where: { customerId: dup.id },
          data: { customerId: primary.id }
        });
        console.log(`    → Moved ${moved.count} bookings to primary`);
      }

      // Merge: move transactions from dup to primary
      if (dup.transactions.length > 0) {
        const moved = await prisma.transaction.updateMany({
          where: { customerId: dup.id },
          data: { customerId: primary.id }
        });
        console.log(`    → Moved ${moved.count} transactions to primary`);
      }

      // Merge: move vehicles from dup to primary (skip if plate already exists)
      for (const v of dup.vehicles) {
        const exists = primary.vehicles.find(pv => pv.plateNumber === v.plateNumber);
        if (!exists) {
          await prisma.vehicle.update({
            where: { id: v.id },
            data: { customerId: primary.id }
          });
          console.log(`    → Moved vehicle ${v.plateNumber} to primary`);
        } else {
          await prisma.vehicle.delete({ where: { id: v.id } });
          console.log(`    → Deleted duplicate vehicle ${v.plateNumber} (already on primary)`);
        }
      }

      // Delete duplicate's customerContext
      if (dup.customerContext) {
        await prisma.customerContext.delete({ where: { id: dup.customerContext.id } });
        console.log(`    → Deleted duplicate customerContext`);
      }

      // Delete the duplicate customer
      await prisma.customer.delete({ where: { id: dup.id } });
      console.log(`    ✅ Deleted duplicate customer: ${dup.phone}`);
    }
    console.log('');
  }

  console.log('🎉 Cleanup complete!');
}

findAndFixDuplicates().catch(console.error).finally(() => prisma.$disconnect());
