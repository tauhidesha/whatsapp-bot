const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Check for duplicates of 81882824477
  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { phone: { contains: '81882824477' } },
        { whatsappLid: { contains: '81882824477' } }
      ]
    },
    include: {
      customerContext: true,
      messages: { orderBy: { createdAt: 'desc' }, take: 2 }
    }
  });

  console.log(`Found ${customers.length} customer records matching 81882824477:\n`);
  
  for (const c of customers) {
    console.log(`=== Record ID: ${c.id} ===`);
    console.log(`  Name: ${c.name}`);
    console.log(`  Phone: ${c.phone}`);
    console.log(`  WhatsappLid: ${c.whatsappLid}`);
    console.log(`  Status: ${c.status}`);
    console.log(`  CreatedAt: ${c.createdAt}`);
    console.log(`  LastMessageAt: ${c.lastMessageAt}`);
    console.log(`  Context Label: ${c.customerContext?.customerLabel || 'NONE'}`);
    console.log(`  Context FollowUpCount: ${c.customerContext?.followUpCount}`);
    console.log(`  Messages: ${c.messages.length}`);
    if (c.messages.length > 0) {
      console.log(`  Last Msg: [${c.messages[0].role}] ${c.messages[0].content?.substring(0, 80)}`);
    }
    console.log('');
  }

  // Also check how the scheduler builds its queue
  const allContexts = await prisma.customerContext.findMany({
    where: { phone: { contains: '81882824477' } }
  });
  console.log(`\nCustomerContext records matching 81882824477: ${allContexts.length}`);
  for (const ctx of allContexts) {
    console.log(`  Phone: ${ctx.phone}, Label: ${ctx.customerLabel}, FollowUpCount: ${ctx.followUpCount}`);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
