// File: src/ai/tools/updatePromoOfTheMonthTool.js
// Tool khusus Admin untuk mengupdate promo bulanan di Prisma

const prisma = require('../../lib/prisma');
const { isAdmin } = require('../utils/adminAuth');
const { invalidatePromoCache } = require('../utils/promoConfig.js');

async function implementation(args) {
    const { promoText, isActive, senderNumber } = args;

    // 1. Validasi Admin
    if (!isAdmin(senderNumber)) {
        return {
            success: false,
            message: '⚠️ Akses Ditolak. Fitur ini khusus untuk Admin Bosmat.'
        };
    }

    try {
        // 2. Simpan ke Prisma KeyValueStore
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
                value: {
                    promoText,
                    isActive: isActive !== undefined ? isActive : true,
                    updatedAt: new Date().toISOString(),
                    updatedBy: senderNumber
                }
            },
            update: {
                value: {
                    promoText,
                    isActive: isActive !== undefined ? isActive : true,
                    updatedAt: new Date().toISOString(),
                    updatedBy: senderNumber
                }
            }
        });

        // Invalidate promo cache agar follow up engine langsung pakai promo baru
        invalidatePromoCache();

        return {
            success: true,
            message: '✅ Promo bulan ini berhasil diperbarui!',
            data: {
                promoText,
                isActive: isActive !== undefined ? isActive : true
            }
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
                        description: 'Isi promo baru (misal: "Diskon 50rb + Gratis Cuci")'
                    },
                    isActive: {
                        type: 'boolean',
                        description: 'Status aktif promo (true/false)'
                    }
                },
                required: ['promoText']
            }
        }
    },
    implementation
};

module.exports = { updatePromoOfTheMonthTool };