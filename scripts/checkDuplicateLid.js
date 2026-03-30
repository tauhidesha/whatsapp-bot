const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const targetLid = '32208110772478@lid';
    const targetNumeric = '32208110772478';

    const numericMatch = await prisma.customer.findFirst({
        where: { phone: targetNumeric }
    });

    const lidMatch = await prisma.customer.findFirst({
        where: { 
            OR: [
                { phone: targetLid },
                { whatsappLid: targetLid }
            ]
        }
    });

    console.log('Numeric Match:', numericMatch);
    console.log('LID Match:', lidMatch);
}

check().then(() => prisma.$disconnect());
