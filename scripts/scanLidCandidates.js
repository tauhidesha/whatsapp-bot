const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function scan() {
    console.log('🔍 Scanning ALL candidates for @lid repair...');
    
    // 1. Inconsistent: whatsappLid is set but phone is still numeric
    const inconsistent = await prisma.customer.findMany({
        where: {
            whatsappLid: { not: null },
            phone: { not: { contains: '@' } }
        }
    });
    console.log(`❌ Inconsistent (whatsappLid exists but phone is numeric): ${inconsistent.length}`);

    // 2. Likely LIDs: numeric only but very long (> 13 digits, ignoring global codes like 62...)
    // Wait, some LIDs are just huge numbers.
    const numericOnly = await prisma.customer.findMany({
        where: { phone: { not: { contains: '@' } } }
    });
    
    const potentialLids = numericOnly.filter(c => {
        const p = c.phone || '';
        // Skip normal phones (usually < 14 digits)
        // LID examples: 32208110772478 (14 digits)
        // Global phones: 628123456789 (12 digits)
        return p.length >= 14 || p.startsWith('322');
    });
    console.log(`⚠️  Potential LIDs (Long numeric or starts with 322): ${potentialLids.length}`);

    const allUniques = new Set([...inconsistent.map(c => c.phone), ...potentialLids.map(c => c.phone)]);
    console.log(`\n💎 TOTAL UNIQUE CANDIDATES: ${allUniques.size}`);
    
    console.log('\nTop 10 candidates:');
    Array.from(allUniques).slice(0, 10).forEach(p => console.log(`- ${p}`));
}

scan().then(() => prisma.$disconnect());
