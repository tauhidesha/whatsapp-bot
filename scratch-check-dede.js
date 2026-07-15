const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCustomer() {
    const lid = '97332716642419@lid';
    
    // Check all customers that might match this person (by name, phone, lid)
    const customers = await prisma.customer.findMany({
        where: {
            OR: [
                { whatsappLid: lid },
                { phone: lid },
                { phone: { contains: '97332716642419' } },
                { name: { contains: 'DEDE', mode: 'insensitive' } }
            ]
        },
        include: {
            messages: {
                take: 5,
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    console.log(`Found ${customers.length} matching customers:`);
    for (const c of customers) {
        console.log(`\n--- Customer ID: ${c.id} ---`);
        console.log(`Phone: ${c.phone}`);
        console.log(`Real Phone: ${c.phoneReal}`);
        console.log(`WhatsApp LID: ${c.whatsappLid}`);
        console.log(`Name: ${c.name}`);
        console.log(`AI Paused: ${c.aiPaused} (Until: ${c.aiPausedUntil})`);
        console.log(`Total Messages: ${c.messages.length} (showing last 5)`);
        for (const msg of c.messages) {
             console.log(`  [${msg.createdAt.toISOString()}] ${msg.role}: ${msg.content.substring(0, 50)}...`);
        }
    }
}

checkCustomer().catch(console.error).finally(() => prisma.$disconnect());
