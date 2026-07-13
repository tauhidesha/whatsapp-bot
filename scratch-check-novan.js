const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const customer = await prisma.customer.findFirst({
    where: { name: { contains: 'NOVAN', mode: 'insensitive' } },
    include: { customerContext: true, transactions: true, bookings: true }
  });
  if (!customer) {
    console.log('NOVAN not found');
    return;
  }
  console.log('Customer:', customer.name, customer.phone);
  console.log('Status:', customer.status);
  console.log('TxCount:', customer.customerContext?.txCount);
  console.log('Label:', customer.customerContext?.customerLabel);
  console.log('FollowUpCount:', customer.customerContext?.followUpCount);
  console.log('Transactions:', customer.transactions.length);
  console.log('Bookings:', customer.bookings.length);
}
check().catch(console.error).finally(() => prisma.$disconnect());
