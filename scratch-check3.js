const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const contexts = await prisma.customerContext.findMany({
    include: { customer: { include: { transactions: true } } }
  });
  
  let issues = 0;
  for (const ctx of contexts) {
    if (!ctx.customer) continue;
    const allTx = ctx.customer.transactions.length;
    const incomeTx = ctx.customer.transactions.filter(t => t.type === 'income' && t.status === 'SUCCESS').length;
    
    if (allTx > 0 && ctx.txCount === 0) {
      console.log(`Found mismatch: ${ctx.customer.name} - Label: ${ctx.customerLabel}, allTx: ${allTx}, incomeTx: ${incomeTx}`);
      issues++;
    }
  }
  console.log('Total issues found:', issues);
}
check().catch(console.error).finally(() => prisma.$disconnect());
