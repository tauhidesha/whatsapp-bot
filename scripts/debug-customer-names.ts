/**
 * Debug script to inspect customer/booking name mismatch
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.customer.findMany({
    include: {
      bookings: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  console.log(`Total customers: ${customers.length}`);
  
  for (const c of customers) {
    console.log('\n─────────────────────────────────');
    console.log(`Customer ID: ${c.id}`);
    console.log(`Customer.name: "${c.name}"`);
    console.log(`Customer.phone: "${c.phone}"`);
    console.log(`Customer.phoneReal: "${c.phoneReal}"`);
    console.log(`Bookings count: ${c.bookings.length}`);
    
    for (const b of c.bookings) {
      console.log(`  └─ Booking "${b.id}" → customerName: "${b.customerName}"`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
