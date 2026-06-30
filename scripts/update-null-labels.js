require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateLabels() {
    console.log('🔄 Memulai update label untuk customer yang masih kosong (null)...');

    try {
        const result = await prisma.customerContext.updateMany({
            where: { 
                customerLabel: null 
            },
            data: { 
                customerLabel: 'window_shopper' 
            }
        });

        console.log(`✅ Berhasil mengupdate ${result.count} data customer menjadi 'window_shopper'.`);
    } catch (error) {
        console.error('❌ Terjadi kesalahan saat update:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateLabels();
