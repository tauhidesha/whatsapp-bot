require('dotenv').config();
const prisma = require('./src/lib/prisma');

async function checkPrismaData() {
    try {
        const customerCount = await prisma.customer.count();
        const messageCount = await prisma.directMessage.count();
        const contextCount = await prisma.customerContext.count();
        
        console.log('--- Prisma Data Status ---');
        console.log(`Customers: ${customerCount}`);
        console.log(`DirectMessages: ${messageCount}`);
        console.log(`CustomerContext: ${contextCount}`);
        
        if (customerCount > 0) {
            const sampleCustomer = await prisma.customer.findFirst({
                include: { messages: { take: 5, orderBy: { createdAt: 'asc' } } }
            });
            console.log('\nSample Customer:', sampleCustomer.phone);
            console.log('Message Count for sample:', sampleCustomer.messages.length);
        }
    } catch (error) {
        console.error('Error checking Prisma data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkPrismaData();
