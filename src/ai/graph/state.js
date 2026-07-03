const { Annotation } = require('@langchain/langgraph');
const { BaseMessage } = require('@langchain/core/messages');

/**
 * Definisi State Zoya
 * Menggunakan Annotation.Root untuk validasi dan manajemen state otomatis oleh LangGraph.
 */
const ZoyaState = Annotation.Root({
    // Riwayat pesan (akumulatif menggunakan reducer)
    messages: Annotation({
        reducer: (oldMessages, newMessages) => {
            // Gabungkan pesan lama dan baru
            let combined = [...oldMessages];
            if (Array.isArray(newMessages)) {
                combined.push(...newMessages);
            } else {
                combined.push(newMessages);
            }
            // Batasi jumlah pesan maksimal (20 terakhir) untuk menghemat DB memory (khususnya payload array image/base64)
            if (combined.length > 20) {
                combined = combined.slice(-20);
            }
            return combined;
        },
        default: () => []
    }),

    // Data pelanggan dari CRM (Prisma)
    customer: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({})
    }),

    // Analisis niat (intent) saat ini
    intent: Annotation({
        reducer: (old, next) => next || old,
        default: () => 'GENERAL_INQUIRY'
    }),

    // Konteks teknis yang diekstrak (Motor, Layanan, dll)
    context: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({
            vehicleType: null,
            serviceTypes: [], // Array of service names (e.g. ["Repaint Bodi Halus", "Detailing Mesin"])
            paintType: null, // 'glossy' | 'doff'
            isBongkarTotal: null, // boolean
            detailingFocus: null, // 'baret' | 'mesin' | 'kerangka'
            colorChoice: null, // string (warna untuk Repaint Bodi)
            velgColorChoice: null, // string (warna untuk Repaint Velg)
            isPreviouslyPainted: null, // boolean (for Velg)
            bookingDate: null, // 'YYYY-MM-DD' or natural language 'besok'
            bookingTime: null, // 'HH:mm' or natural language 'jam 2'
            comboOffered: false, // Track apakah promo combo sudah ditawarkan
            missingQuestions: [], // Daftar pertanyaan yang harus diajukan Zoya
            isReadyForTools: false
        })
    }),

    // Flag untuk Human-in-the-loop (HITL)
    requiresAdmin: Annotation({
        reducer: (old, next) => next,
        default: () => false
    }),

    // Flag untuk Admin Mode (Personal Assistant Flow)
    isAdmin: Annotation({
        reducer: (old, next) => next,
        default: () => false
    }),

    // Metadata untuk tracking
    metadata: Annotation({
        reducer: (old, updated) => ({ ...old, ...updated }),
        default: () => ({})
    })
});

module.exports = {
    ZoyaState
};
