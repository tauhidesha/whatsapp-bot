const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const where = {};
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      customer: { 
        select: { 
          name: true, 
          phone: true,
          vehicles: {
            select: {
              modelName: true,
              plateNumber: true,
            },
            take: 1,
          }
        } 
      }
    }
  });

  console.log(transactions);
}
main().catch(console.error).finally(() => prisma.$disconnect());
