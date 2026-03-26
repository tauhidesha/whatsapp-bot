/**
 * Memvalidasi apakah nomor pengirim adalah admin.
 * @param {string} senderNumber - Nomor WhatsApp pengirim (e.g., '62812345678@c.us')
 * @returns {boolean} True jika admin.
 */
function isAdmin(senderNumber) {
    const adminNumbers = [
        process.env.BOSMAT_ADMIN_NUMBER,
        process.env.ADMIN_WHATSAPP_NUMBER
    ].filter(Boolean);

    if (!senderNumber || adminNumbers.length === 0) return false;

    // Normalisasi: hapus karakter non-digit
    const normalize = (n) => n.toString().replace(/\D/g, '');
    const sender = normalize(senderNumber);

    return adminNumbers.some(adminProp => normalize(adminProp) === sender);
}

/**
 * @deprecated Migrated to Prisma
 */
function ensureFirestore() {
    console.warn('[AdminAuth] ensureFirestore() is DEPRECATED. Use Prisma instead.');
    return null;
}

module.exports = { isAdmin, ensureFirestore };
