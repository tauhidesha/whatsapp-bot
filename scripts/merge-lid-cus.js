const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeLidCus() {
    console.log(`🔄 [Merge] Finding @c.us and @lid duplicates...`);

    // Find all customers with @c.us
    const cusCustomers = await prisma.customer.findMany({
        where: { phone: { endsWith: '@c.us' } },
        select: { id: true, phone: true, name: true, _count: { select: { messages: true } } }
    });

    for (const cusCust of cusCustomers) {
        const basePhone = cusCust.phone.replace('@c.us', '');
        
        // Find matching @lid
        const lidCust = await prisma.customer.findFirst({
            where: {
                OR: [
                    { phone: `${basePhone}@lid` },
                    { whatsappLid: `${basePhone}@lid` }
                ]
            }
        });

        if (lidCust) {
            console.log(`🔗 MERGE: ${cusCust.phone} -> ${lidCust.phone}`);
            
            // Move messages
            await prisma.directMessage.updateMany({
                where: { customerId: cusCust.id },
                data: { customerId: lidCust.id }
            });

            // Move bookings
            await prisma.booking.updateMany({
                where: { customerId: cusCust.id },
                data: { customerId: lidCust.id }
            });

            // Move transactions
            await prisma.transaction.updateMany({
                where: { customerId: cusCust.id },
                data: { customerId: lidCust.id }
            });
            
            // Delete CustomerContext for stale (if exists)
            await prisma.customerContext.deleteMany({
                where: { phone: cusCust.phone }
            }).catch(() => {});

            // Delete vehicles for stale customer
            await prisma.vehicle.deleteMany({
                where: { customerId: cusCust.id }
            }).catch(() => {});

            // Delete stale
            await prisma.customer.delete({ where: { id: cusCust.id } });
            
            console.log(`   ✅ Merged!`);
        }
    }
    
    console.log("Done.");
}

mergeLidCus()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
