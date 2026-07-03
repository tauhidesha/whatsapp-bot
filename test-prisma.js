const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany({ take: 5 });
  console.log(transactions);
}
main().finally(() => prisma.$disconnect());
