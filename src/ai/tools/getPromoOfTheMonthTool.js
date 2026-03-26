// File: src/ai/tools/getPromoOfTheMonthTool.js
// Tool untuk mengambil promo bulan ini dari Prisma

const prisma = require('../../lib/prisma');

async function implementation() {
    try {
        const kv = await prisma.keyValueStore.findUnique({
            where: {
                collection_key: {
                    collection: 'settings',
                    key: 'promo_config'
                }
            }
        });

        if (!kv) {
            return {
                success: true,
                message: 'Tidak ada promo aktif bulan ini.',
                promoText: null,
                isActive: false
            };
        }

        const data = kv.value;

        if (!data.isActive) {
            return {
                success: true,
                message: 'Saat ini tidak ada promo yang berlaku.',
                promoText: null,
                isActive: false
            };
        }

        return {
            success: true,
            message: 'Promo bulan ini berhasil diambil.',
            promoText: data.promoText,
            isActive: true,
            response: `💡 *PROMO BOOM BULAN INI:* \n\n${data.promoText}\n\n*Syarat & Ketentuan berlaku.*`
        };
    } catch (error) {
        console.error('[getPromoOfTheMonth] Error:', error);
        return {
            success: false,
            message: 'Gagal mengambil data promo: ' + error.message
        };
    }
}

const getPromoOfTheMonthTool = {
    toolDefinition: {
        type: 'function',
        function: {
            name: 'getPromoOfTheMonth',
            description: 'Dapatkan informasi promo, diskon, atau bonus yang berlaku bulan ini untuk meyakinkan customer yang ragu.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    implementation
};

module.exports = { getPromoOfTheMonthTool };