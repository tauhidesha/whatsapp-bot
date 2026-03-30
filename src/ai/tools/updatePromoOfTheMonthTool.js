// File: src/ai/tools/updatePromoOfTheMonthTool.js
// Tool khusus Admin untuk mengupdate promo bulanan di Prisma

const prisma = require('../../lib/prisma');
const { isAdmin } = require('../utils/adminAuth');
const { invalidatePromoCache } = require('../utils/promoConfig.js');

async function implementation(args) {
    const { promoText, isActive, comboDiscount, comboMinServices, senderNumber } = args;

    // 1. Validasi Admin
    if (!isAdmin(senderNumber)) {
        return {
            success: false,
            message: '⚠️ Akses Ditolak. Fitur ini khusus untuk Admin Bosmat.'
        };
    }

    try {
        const value = {
            promoText,
            isActive: isActive !== undefined ? isActive : true,
            comboDiscount: comboDiscount !== undefined ? comboDiscount : 0.15,       // default 15%
            comboMinServices: comboMinServices !== undefined ? comboMinServices : 2, // default 2 layanan
            updatedAt: new Date().toISOString(),
            updatedBy: senderNumber
        };

        await prisma.keyValueStore.upsert({
            where: {
                collection_key: {
                    collection: 'settings',
                    key: 'promo_config'
                }
            },
            create: {
                collection: 'settings',
                key: 'promo_config',
                value
            },
            update: { value }
        });

        // Invalidate promo cache agar follow up engine langsung pakai promo baru
        invalidatePromoCache();

        return {
            success: true,
            message: '✅ Promo bulan ini berhasil diperbarui!',
            data: value
        };
    } catch (error) {
        console.error('[updatePromoOfTheMonth] Error:', error);
        return {
            success: false,
            message: 'Gagal memperbarui promo: ' + error.message
        };
    }
}

const updatePromoOfTheMonthTool = {
    toolDefinition: {
        type: 'function',
        function: {
            name: 'updatePromoOfTheMonth',
            description: 'Khusus Admin: Update isi promo/diskon bulan ini. Gunakan ini jika Bos ingin mengubah "diskon pancingan" bagi customer.',
            parameters: {
                type: 'object',
                properties: {
                    promoText: {
                        type: 'string',
                        description: 'Isi promo baru (misal: "Diskon 15% untuk paket 2 layanan!")'
                    },
                    isActive: {
                        type: 'boolean',
                        description: 'Status aktif promo (true/false)'
                    },
                    comboDiscount: {
                        type: 'number',
                        description: 'Persentase diskon combo dalam desimal (0.15 = 15%). Default 0.15.'
                    },
                    comboMinServices: {
                        type: 'integer',
                        description: 'Minimal jumlah layanan untuk dapat diskon combo. Default 2.'
                    }
                },
                required: ['promoText']
            }
        }
    },
    implementation
};

module.exports = { updatePromoOfTheMonthTool };