const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const where = {};
  const month = '2026-07';
  const [yearStr, monthStr] = month.split('-');
  const yearNum = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const startDate = new Date(yearNum, monthNum - 1, 1);
  const endDate = new Date(yearNum, monthNum, 1);
  where.createdAt = { gte: startDate, lt: endDate };

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
