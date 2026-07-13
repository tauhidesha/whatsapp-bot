const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const contexts = await prisma.customerContext.findMany({
    where: {
      createdAt: { gte: startOfMonth }
    }
  });
  const counts = {};
  for (const c of contexts) {
    counts[c.followUpCount] = (counts[c.followUpCount] || 0) + 1;
  }
  console.log('FollowUp counts for this month:', counts);
  
  const labelCounts = {};
  for (const c of contexts) {
    if (c.followUpCount === 1) {
       labelCounts[c.customerLabel] = (labelCounts[c.customerLabel] || 0) + 1;
    }
  }
  console.log('Labels for followUpCount=1:', labelCounts);
}
check().catch(console.error).finally(() => prisma.$disconnect());
