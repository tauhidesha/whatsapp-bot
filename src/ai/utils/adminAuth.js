const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');

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
 * Mengembalikan instance Firestore yang valid.
 * Menangani berbagai cara inisialisasi Firebase Admin.
 * @returns {admin.firestore.Firestore} Instance Firestore.
 */
function ensureFirestore() {
    if (!admin.apps.length) {
        try {
            // Coba inisialisasi dengan BASE64 service account (prioritas deployment)
            const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
            if (serviceAccountBase64) {
                const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
                const serviceAccount = JSON.parse(serviceAccountJson);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            } else {
                // Fallback ke GOOGLE_APPLICATION_CREDENTIALS atau default env
                const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
                const config = serviceAccountPath
                    ? { credential: admin.credential.cert(serviceAccountPath) }
                    : {};
                admin.initializeApp(config);
            }
        } catch (e) {
            console.warn('[AdminAuth] Firebase init warning:', e.message);
        }
    }

    // Gunakan helper project jika ada, atau fallback ke admin default
    try {
        return getFirebaseAdmin().firestore();
    } catch (e) {
        return admin.firestore();
    }
}

module.exports = { isAdmin, ensureFirestore };
