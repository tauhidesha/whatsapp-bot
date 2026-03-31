
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFollowUp() {
    try {
        console.log('--- Checking Follow-up Status ---');
        
        // 1. Check last follow-up in customerContext
        const lastFollowUp = await prisma.customerContext.findFirst({
            where: {
                lastFollowUpAt: { not: null }
            },
            orderBy: {
                lastFollowUpAt: 'desc'
            },
            include: {
                customer: true
            }
        });

        if (lastFollowUp) {
            console.log('Last follow-up record found:');
            console.log(`- Customer: ${lastFollowUp.customer.name} (${lastFollowUp.customer.phone})`);
            console.log(`- Date: ${lastFollowUp.lastFollowUpAt}`);
            console.log(`- Strategy: ${lastFollowUp.lastFollowUpStrategy}`);
            console.log(`- Count: ${lastFollowUp.followUpCount}`);
        } else {
            console.log('No follow-up records found in customerContext.');
        }

        // 2. Check total eligible customers
        const contexts = await prisma.customerContext.findMany({
            where: {
                customerLabel: { not: null }
            },
            include: {
                customer: true
            }
        });
        
        console.log(`\nTotal customers with labels: ${contexts.length}`);
        
        // 3. Count messages from assistant in last 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const assistantMessages = await prisma.directMessage.count({
            where: {
                role: 'assistant',
                createdAt: { gte: yesterday }
            }
        });
        console.log(`\nAssistant messages in last 24h: ${assistantMessages}`);

        // 4. Sample some labels
        const labels = await prisma.customerContext.groupBy({
            by: ['customerLabel'],
            _count: true
        });
        console.log('\nLabel distribution:');
        labels.forEach(l => console.log(`- ${l.customerLabel}: ${l._count}`));

    } catch (error) {
        console.error('Error checking follow-up:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkFollowUp();
