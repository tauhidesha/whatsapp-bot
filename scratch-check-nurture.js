const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Try both phone formats
  const phones = ['6281882824477@c.us', '6281882824477', '81882824477@c.us'];
  
  for (const phone of phones) {
    const customer = await prisma.customer.findUnique({
      where: { phone },
      include: {
        customerContext: true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 5 },
        messages: { orderBy: { createdAt: 'desc' }, take: 3 }
      }
    });
    
    if (customer) {
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
        console.log('FollowUpStrategy:', ctx.followUpStrategy);
        console.log('ExplicitlyRejected:', ctx.explicitlyRejected);
        console.log('GhostedTimes:', ctx.ghostedTimes);
        console.log('UpdatedAt:', ctx.updatedAt);
      } else {
        console.log('No context found');
      }
      
      console.log('\n=== TRANSACTIONS ===');
      if (customer.transactions.length === 0) {
        console.log('No transactions');
      }
      for (const tx of customer.transactions) {
        console.log(`- ${tx.type} | ${tx.amount} | ${tx.status} | ${tx.description} | ${tx.createdAt}`);
      }
      
      console.log('\n=== RECENT MESSAGES ===');
      for (const m of customer.messages) {
        console.log(`- [${m.role}] ${m.createdAt}: ${(m.content || '').substring(0, 100)}`);
      }
      return;
    }
  }
  
  // Also try LID format
  const lidCustomer = await prisma.customer.findFirst({
    where: { phone: { contains: '81882824477' } },
    include: { customerContext: true, transactions: true }
  });
  
  if (lidCustomer) {
    console.log('Found via partial match:', lidCustomer.name, lidCustomer.phone);
    console.log('Label:', lidCustomer.customerContext?.customerLabel);
    console.log('TxCount:', lidCustomer.customerContext?.txCount);
    console.log('FollowUpCount:', lidCustomer.customerContext?.followUpCount);
    console.log('Transactions:', lidCustomer.transactions.length);
  } else {
    console.log('Customer not found with any format');
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
