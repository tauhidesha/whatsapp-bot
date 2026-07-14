const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixNovan() {
  const customer = await prisma.customer.findFirst({
    where: { name: { contains: 'Novan', mode: 'insensitive' } },
    include: { customerContext: true, transactions: { where: { type: 'income', status: 'SUCCESS' } } }
  });
  
  if (!customer) {
    console.log('Novan not found');
    return;
  }

  console.log('Before fix:');
  console.log('  Label:', customer.customerContext?.customerLabel);
  console.log('  FollowUpCount:', customer.customerContext?.followUpCount);
  console.log('  LastFollowUpAt:', customer.customerContext?.lastFollowUpAt);
  console.log('  Status:', customer.status);

  // Fix customer status
  await prisma.customer.update({
    where: { id: customer.id },
    data: { status: 'active' }
  });

  // Fix context — set followUpCount to maxFollowUps (3 for existing_customer)
  // so scheduler won't pick him up again until the classifier naturally resets
  if (customer.customerContext) {
    await prisma.customerContext.update({
      where: { phone: customer.phone },
      data: {
        followUpCount: 3,
        lastFollowUpAt: new Date()
      }
    });
  }

  console.log('\nAfter fix:');
  const updated = await prisma.customer.findFirst({
    where: { name: { contains: 'Novan', mode: 'insensitive' } },
    include: { customerContext: true }
  });
  console.log('  Label:', updated.customerContext?.customerLabel);
  console.log('  FollowUpCount:', updated.customerContext?.followUpCount);
  console.log('  LastFollowUpAt:', updated.customerContext?.lastFollowUpAt);
  console.log('  Status:', updated.status);
}

fixNovan().catch(console.error).finally(() => prisma.$disconnect());
