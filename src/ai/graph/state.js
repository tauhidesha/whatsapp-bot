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
            const combined = [...oldMessages];
            if (Array.isArray(newMessages)) {
                combined.push(...newMessages);
            } else {
                combined.push(newMessages);
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
            serviceType: null,
            paintType: null, // 'glossy' | 'doff'
            isBongkarTotal: null, // boolean
            detailingFocus: null, // 'baret' | 'mesin' | 'kerangka'
            colorChoice: null, // string
            isPreviouslyPainted: null, // boolean (for Velg)
            missingQuestions: [], // Daftar pertanyaan yang harus diajukan Zoya
            isReadyForTools: false
        })
    }),

    // Flag untuk Human-in-the-loop (HITL)
    requiresAdmin: Annotation({
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
