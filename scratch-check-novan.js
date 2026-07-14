const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const customer = await prisma.customer.findFirst({
    where: { name: { contains: 'Novan', mode: 'insensitive' } },
    include: {
      customerContext: true,
      transactions: { orderBy: { createdAt: 'desc' } },
      bookings: { orderBy: { createdAt: 'desc' } },
      messages: { orderBy: { createdAt: 'desc' }, take: 5 }
    }
  });
  if (!customer) {
    console.log('Novan not found');
    return;
  }
  console.log('=== CUSTOMER ===');
  console.log('Name:', customer.name);
  console.log('Phone:', customer.phone);
  console.log('Status:', customer.status);
  console.log('TotalSpending:', customer.totalSpending);
  console.log('LastService:', customer.lastService);
  console.log('LastMessageAt:', customer.lastMessageAt);

  console.log('\n=== CONTEXT ===');
  const ctx = customer.customerContext;
  if (ctx) {
    console.log('Label:', ctx.customerLabel);
    console.log('TxCount:', ctx.txCount);
    console.log('FollowUpCount:', ctx.followUpCount);
    console.log('LastFollowUpAt:', ctx.lastFollowUpAt);
    console.log('LastFollowUpStrategy:', ctx.lastFollowUpStrategy);
    console.log('FollowUpConverted:', ctx.followUpConverted);
    console.log('ExplicitlyRejected:', ctx.explicitlyRejected);
    console.log('GhostedTimes:', ctx.ghostedTimes);
    console.log('FollowUpStrategy:', ctx.followUpStrategy);
    console.log('UpdatedAt:', ctx.updatedAt);
  }

  console.log('\n=== TRANSACTIONS ===');
  for (const tx of customer.transactions) {
    console.log(`- ${tx.type} | ${tx.amount} | ${tx.status} | ${tx.createdAt}`);
  }

  console.log('\n=== RECENT MESSAGES (last 5) ===');
  for (const m of customer.messages) {
    console.log(`- [${m.role}] ${m.createdAt}: ${m.content.substring(0, 80)}...`);
  }
}
check().catch(console.error).finally(() => prisma.$disconnect());
