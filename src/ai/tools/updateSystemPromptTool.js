const admin = require('firebase-admin');

const updateSystemPromptTool = {
    name: "updateSystemPrompt",
    description: "Khusus Admin: Mengupdate System Prompt (instruksi utama AI) secara dinamis. Perubahan akan langsung aktif dan tersimpan permanen.",
    parameters: {
        type: "object",
        properties: {
            newPrompt: {
                type: "string",
                description: "Isi instruksi system prompt yang baru. Tuliskan secara lengkap dan detail."
            },
            confirmUpdate: {
                type: "boolean",
                description: "Set true untuk konfirmasi update."
            }
        },
        required: ["newPrompt", "confirmUpdate"]
    }
};

async function updateSystemPrompt(args) {
    const { newPrompt, confirmUpdate, senderNumber } = args;

    // 1. Validasi Admin (Double Check)
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

    if (!confirmUpdate) {
        return {
            status: "pending",
            message: "Mohon set 'confirmUpdate' ke true jika Anda yakin ingin mengubah System Prompt."
        };
    }

    try {
        const db = admin.firestore();

        // 2. Simpan ke Firestore
        await db.collection('settings').doc('ai_config').set({
            systemPrompt: newPrompt,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: senderNumber
        }, { merge: true });

        // 3. Return sukses (app.js akan mendeteksi perubahan via listener atau reload manual, 
        // tapi untuk sekarang kita return pesan sukses dulu)
        return {
            status: "success",
            message: "✅ System Prompt berhasil diperbarui! Perubahan sudah tersimpan di database dan akan aktif untuk percakapan selanjutnya.\n\nPreview awal:\n" + newPrompt.substring(0, 100) + "..."
        };

    } catch (error) {
        console.error('[updateSystemPrompt] Error:', error);
        return {
            status: "error",
            message: "Gagal mengupdate system prompt: " + error.message
        };
    }
}

module.exports = {
    updateSystemPromptTool: {
        toolDefinition: {
            type: "function",
            function: updateSystemPromptTool
        },
        implementation: updateSystemPrompt
    }
};
