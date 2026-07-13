const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const contexts = await prisma.customerContext.findMany({
    include: { customer: { include: { transactions: { where: { type: 'income', status: 'SUCCESS' } } } } }
  });
  
  let fixed = 0;
  for (const ctx of contexts) {
    if (!ctx.customer) continue;
    const txCount = ctx.customer.transactions.length;
    if (txCount > 0 && ctx.txCount !== txCount) {
      let label = ctx.customerLabel;
      if (txCount > 1) label = 'loyal_customer';
      else if (txCount === 1) label = 'existing_customer';
      
      await prisma.customerContext.update({
        where: { id: ctx.id },
        data: {
          txCount,
          customerLabel: label,
          followUpCount: 0,
          lastFollowUpAt: null
        }
      });
      fixed++;
      console.log(`Fixed ${ctx.customer.name} (${ctx.phone}) -> ${label}, txCount: ${txCount}`);
    }
  }
  console.log(`Fixed ${fixed} contexts.`);
}

fix().catch(console.error).finally(() => prisma.$disconnect());
