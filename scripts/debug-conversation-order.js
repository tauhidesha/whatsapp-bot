require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    // 1. Find all customers named Rizaldi
    const rizaldiCustomers = await prisma.customer.findMany({
        where: { name: { contains: 'izaldi', mode: 'insensitive' } },
        select: { id: true, phone: true, whatsappLid: true, name: true, lastMessageAt: true, updatedAt: true }
    });
    
    console.log('=== RIZALDI CUSTOMERS ===');
    for (const c of rizaldiCustomers) {
        console.log(`  ID: ${c.id}`);
        console.log(`  Phone: ${c.phone}`);
        console.log(`  WhatsApp LID: ${c.whatsappLid}`);
        console.log(`  Name: ${c.name}`);
        console.log(`  lastMessageAt: ${c.lastMessageAt?.toISOString()}`);
        console.log(`  updatedAt: ${c.updatedAt?.toISOString()}`);
        
        // Get latest 3 messages
        const msgs = await prisma.directMessage.findMany({
            where: { customerId: c.id },
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { createdAt: true, role: true, content: true, senderId: true }
        });
        console.log(`  Latest messages (${msgs.length}):`);
        for (const m of msgs) {
            console.log(`    [${m.createdAt.toISOString()}] ${m.role}: ${m.content.substring(0, 80)}...`);
        }
        
        // Count total messages
        const count = await prisma.directMessage.count({ where: { customerId: c.id } });
        console.log(`  Total messages: ${count}`);
        console.log('');
    }
    
    // 2. Also check top 5 customers by latest DirectMessage
    console.log('\n=== TOP 5 CUSTOMERS BY LATEST DIRECTMESSAGE ===');
    const topCustomers = await prisma.$queryRaw`
        SELECT c.id, c.phone, c.name, c."lastMessageAt",
               MAX(dm."createdAt") as latest_dm_at
        FROM "Customer" c
        JOIN "DirectMessage" dm ON dm."customerId" = c.id
        GROUP BY c.id
        ORDER BY latest_dm_at DESC
        LIMIT 5
    `;
    
    for (const c of topCustomers) {
        console.log(`  ${c.name || c.phone}: lastMessageAt=${c.lastMessageAt?.toISOString()} | latestDM=${c.latest_dm_at?.toISOString()}`);
    }
}

check().catch(console.error).finally(() => prisma.$disconnect());
