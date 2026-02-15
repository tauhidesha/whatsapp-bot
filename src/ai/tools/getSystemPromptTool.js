const admin = require('firebase-admin');

const getSystemPromptTool = {
    name: "getSystemPrompt",
    description: "Khusus Admin: Membaca System Prompt (instruksi utama AI) yang sedang aktif saat ini. Gunakan ini sebelum melakukan update agar tidak menimpa instruksi penting yang sudah ada.",
    parameters: {
        type: "object",
        properties: {}, // No input parameters needed
    }
};

async function getSystemPrompt(args) {
    const { senderNumber } = args;

    // 1. Validasi Admin
    const adminNumbers = [
        process.env.BOSMAT_ADMIN_NUMBER,
        process.env.ADMIN_WHATSAPP_NUMBER
    ].filter(Boolean);

    const normalize = (n) => n ? n.toString().replace(/\D/g, '') : '';
    const senderNormalized = normalize(senderNumber);
    const isAdmin = adminNumbers.some(num => normalize(num) === senderNormalized);

    if (!isAdmin) {
        return {
            status: "error",
            message: "⚠️ Akses Ditolak. Fitur ini khusus untuk Admin Bosmat."
        };
    }

    try {
        const db = admin.firestore();

        // 2. Baca dari Firestore
        const doc = await db.collection('settings').doc('ai_config').get();

        if (doc.exists && doc.data().systemPrompt) {
            return {
                status: "success",
                systemPrompt: doc.data().systemPrompt,
                message: "Berikut adalah System Prompt yang sedang aktif:"
            };
        } else {
            return {
                status: "success",
                systemPrompt: null,
                message: "Belum ada System Prompt custom di database. Bot menggunakan default hardcoded prompt dari source code."
            };
        }

    } catch (error) {
        console.error('[getSystemPrompt] Error:', error);
        return {
            status: "error",
            message: "Gagal membaca system prompt: " + error.message
        };
    }
}

module.exports = {
    getSystemPromptTool: {
        toolDefinition: {
            type: "function",
            function: getSystemPromptTool
        },
        implementation: getSystemPrompt
    }
};
