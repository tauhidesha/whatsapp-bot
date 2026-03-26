const prisma = require('../../lib/prisma');

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
        // 2. Baca dari Prisma KeyValueStore
        const kv = await prisma.keyValueStore.findUnique({
            where: {
                collection_key: {
                    collection: 'settings',
                    key: 'ai_config'
                }
            }
        });

        if (kv && kv.value.systemPrompt) {
            return {
                status: "success",
                systemPrompt: kv.value.systemPrompt,
                message: "Berikut adalah System Prompt yang sedang aktif (dari Database):"
            };
        } else {
            // Fallback ke activePrompt yang ditaruh oleh app.js (in-memory value)
            const fallbackPrompt = args.activePrompt || "Prompt tidak ditemukan.";

            return {
                status: "success",
                systemPrompt: fallbackPrompt,
                message: "Database kosong. Menggunakan System Prompt default (Hardcoded/Active Memory):"
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