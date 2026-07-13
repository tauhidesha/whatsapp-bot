const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const contexts = await prisma.customerContext.findMany({
    where: {
      followUpCount: 1,
      createdAt: { gte: startOfMonth }
    },
    include: { customer: true }
  });
  console.log('Customers with followUpCount=1 created this month:', contexts.length);
  for (const c of contexts.slice(0, 5)) {
    console.log('- Phone:', c.phone, '| Label:', c.customerLabel, '| Last FollowUp:', c.lastFollowUpAt, '| TxCount:', c.txCount);
  }
}
check().catch(console.error).finally(() => prisma.$disconnect());
