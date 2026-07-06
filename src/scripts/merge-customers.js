const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching customers...');
  const customers = await prisma.customer.findMany({
    include: {
      bookings: true,
      messages: true,
      transactions: true,
      vehicles: true,
      customerContext: true
    }
  });

  const groups = {};
  for (const c of customers) {
    const normalized = c.phone.replace(/\D/g, '');
    if (!normalized) continue;
    if (!groups[normalized]) groups[normalized] = [];
    groups[normalized].push(c);
  }

  let mergedCount = 0;

  for (const [normPhone, group] of Object.entries(groups)) {
    if (group.length <= 1) continue;

    console.log(`\nFound duplicate for ${normPhone}: ${group.map(g => g.phone).join(', ')}`);
    
    // Sort group: we prefer the one with the most messages/bookings, or the oldest.
    group.sort((a, b) => {
      const aScore = a.messages.length + a.bookings.length + a.transactions.length;
      const bScore = b.messages.length + b.bookings.length + b.transactions.length;
      if (aScore !== bScore) return bScore - aScore; // Descending by score
      return a.createdAt.getTime() - b.createdAt.getTime(); // Ascending by date
    });

    const primary = group[0];
    const duplicates = group.slice(1);

    console.log(`  -> Primary: ${primary.phone} (ID: ${primary.id})`);

    // Collect combined data to update primary if needed
    let newLid = primary.whatsappLid;
    let newProfilePic = primary.profilePicUrl;
    let newName = primary.name;

    for (const dup of duplicates) {
      if (!newLid && dup.whatsappLid) newLid = dup.whatsappLid;
      if (!newProfilePic && dup.profilePicUrl) newProfilePic = dup.profilePicUrl;
      if ((!newName || newName === normPhone) && dup.name && dup.name !== normPhone) {
        newName = dup.name;
      }
    }

    // Update primary
    if (newLid !== primary.whatsappLid || newProfilePic !== primary.profilePicUrl || newName !== primary.name) {
      await prisma.customer.update({
        where: { id: primary.id },
        data: {
          whatsappLid: newLid,
          profilePicUrl: newProfilePic,
          name: newName
        }
      });
      console.log(`  -> Updated primary with missing fields (LID/Name/Pic)`);
    }

    // Reassign relations
    for (const dup of duplicates) {
      console.log(`  -> Merging duplicate: ${dup.phone} (ID: ${dup.id})`);

      // 1. Vehicles
      if (dup.vehicles.length > 0) {
        await prisma.vehicle.updateMany({
          where: { customerId: dup.id },
          data: { customerId: primary.id }
        });
      }

      // 2. Messages
      if (dup.messages.length > 0) {
        await prisma.directMessage.updateMany({
          where: { customerId: dup.id },
          data: { customerId: primary.id }
        });
      }

      // 3. Bookings
      if (dup.bookings.length > 0) {
        await prisma.booking.updateMany({
          where: { customerId: dup.id },
          data: { customerId: primary.id }
        });
      }

      // 4. Transactions
      if (dup.transactions.length > 0) {
        await prisma.transaction.updateMany({
          where: { customerId: dup.id },
          data: { customerId: primary.id }
        });
      }

      // 5. CustomerLocation (if any)
      await prisma.customerLocation.updateMany({
        where: { customerId: dup.id },
        data: { customerId: primary.id }
      });

      // 6. CustomerContext
      // This uses `phone` as FK. We might have 2 contexts.
      // For simplicity, if duplicate has a context, we just delete it because primary usually has one.
      // If primary doesn't have one and duplicate does, we can't easily reassign since the FK is `phone` and primary.phone is different.
      // Let's just delete the duplicate's context.
      if (dup.customerContext) {
        await prisma.customerContext.delete({
          where: { phone: dup.phone }
        }).catch(() => {});
      }

      // Delete the duplicate customer
      await prisma.customer.delete({
        where: { id: dup.id }
      });

      mergedCount++;
    }
  }

  console.log(`\nMerge complete! Merged ${mergedCount} duplicate customer records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
