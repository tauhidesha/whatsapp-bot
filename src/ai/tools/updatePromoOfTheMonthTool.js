// File: src/ai/tools/updatePromoOfTheMonthTool.js
// Tool khusus Admin untuk mengupdate promo bulanan di Firestore

const admin = require('firebase-admin');
const { isAdmin } = require('../utils/adminAuth');

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
        const db = admin.firestore();

        // 2. Simpan ke Firestore
        await db.collection('settings').doc('promo_config').set({
            promoText,
            isActive: isActive !== undefined ? isActive : true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: senderNumber
        }, { merge: true });

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
