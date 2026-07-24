const { z } = require('zod');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { extractTextFromContent, getMessageType } = require('../graph/utils/sanitizeMessages');
/**
 * Memory Extractor for Zoya V2
 * Uses Gemini to extract Identity, Relationship, and Sales memory from messages.
 */

const FactState = z.enum(['KNOWN', 'UNDECIDED', 'NOT_APPLICABLE']);

const FactSchema = (description) => z.object({
    value: z.string().optional().describe("Nilai fakta (jika diketahui), atau hilangkan field ini jika null/tidak tahu."),
    state: FactState.describe("Status: KNOWN jika nilai eksplisit, UNDECIDED jika kustomer bilang belum tau/bingung, NOT_APPLICABLE jika tidak relevan.")
}).optional().describe(description);

const MemorySchema = z.object({
    motor: FactSchema("Merek/model motor (misal: NMax, Beat)."),
    color: FactSchema("Warna cat (misal: merah candy). JIKA bilang 'asli', isi value 'Standar Pabrik/Original' (KNOWN)."),
    part: FactSchema("Bagian motor yang dikerjakan (misal: full bodi, bodi halus, velg)."),
    objection: FactSchema("Keberatan/komplain kustomer (misal: 'mahal', 'jauh')."),
    services: z.array(z.string()).optional().describe("Daftar layanan (misal: 'Repaint Bodi Halus')."),
    velgCondition: FactSchema("Kondisi cat velg sebelumnya (misal: 'masih ori pabrik', 'udah pernah dicat/repaint', 'belum pernah'). JANGAN isi ini dengan baret/lecet, fokus HANYA pada status cat asli/repaint."),
    hasDamage: z.boolean().nullable().optional().describe("Apakah customer menyebutkan ada kerusakan (retak, patah, baret dalam)? Pengecualian disengaja: tidak menggunakan format {value, status} karena fact yes/no tidak memiliki state UNDECIDED."),
    bookingDate: FactSchema("Tanggal atau hari yang diinginkan customer untuk booking (misal: 'besok', 'hari senin', 'tanggal 25')."),
    bookingTime: FactSchema("Jam yang diinginkan customer untuk booking (misal: 'jam 10 pagi', 'sore')."),
    visualSummary: z.string().optional().describe("Ringkasan visual 1-2 kalimat mengenai apa yang terlihat di gambar/foto yang dikirim user. HANYA isi jika user mengirim foto.")
});

async function extractMemory(state) {
    console.log('[Memory Extractor] Extracting memory features with LLM...');
    
    const messages = state.messages || [];
    const lastUserMessageObj = [...messages].reverse().find(m => {
        const type = getMessageType(m) || 'user';
        return type === 'human' || type === 'user';
    });
    const lastUserContent = lastUserMessageObj ? (lastUserMessageObj.kwargs?.content || lastUserMessageObj.content) : null;
    const lastUserMessageText = lastUserContent ? extractTextFromContent(lastUserContent) : '';

    if (!lastUserContent) {
        return {};
    }

    // LangChain JS has a bug where it checks if the modelName includes "1.5" or "vision" to allow images.
    // User requested to use .env
    const llm = new ChatGoogleGenerativeAI({
        model: process.env.VISION_MODEL || process.env.AI_MODEL || 'gemini-1.5-flash-latest',
        temperature: 0,
        maxOutputTokens: 512,
        apiKey: process.env.GOOGLE_API_KEY,
        responseMimeType: "application/json"
    });

    try {
        const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
        let contextStr = '';
        const lastOffered = state.last_offered_services || [];
        if (lastOffered.length > 0) {
            contextStr = `\nKONTEKS: Layanan terakhir yang ditawarkan ke kustomer adalah: [${lastOffered.join(', ')}]. Jika kustomer merespon dengan kata ganti (misal: "itu aja", "boleh deh", "mau"), anggap mereka meminta layanan tersebut dan outputkan di field "services".`;
        }

        const now = new Date();
        const formatter = new Intl.DateTimeFormat('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
        });
        const currentDateTime = formatter.format(now);

        const systemPrompt = `Anda adalah sistem ekstraksi memori. Ekstrak data relevan dari pesan (dan gambar/foto jika ada) kustomer terakhir.
WAKTU SEKARANG: ${currentDateTime} WIB. Gunakan ini sebagai referensi jika kustomer menyebut waktu seperti "besok" atau "hari ini".
ATURAN UPDATE STATE: HANYA ekstrak dan output field yang SECARA EKSPLISIT dibahas di pesan atau terlihat jelas di gambar terakhir kustomer. JIKA ada foto, WAJIB isi visualSummary.
Jika suatu informasi TIDAK DIBAHAS, JANGAN masukkan field tersebut ke dalam output JSON.${contextStr}
ATURAN KETAT:
- BAHASA GAUL/SLANG: Kata "kura2" atau "kura-kura" dalam konteks tanya harga berarti "kira-kira" (estimasi), BUKAN hewan atau warna kura-kura!
- KONTEKS IKLAN META (REPAINT): Pelanggan yang datang secara umum berasumsi tertarik dengan layanan Repaint. JIKA kustomer HANYA menyebutkan tipe/merek/warna motor (misal: "Yamaha Xeon GT 2015 warna Hitam", "PCX 2020") tanpa menyebutkan bagian spesifik, masukkan 'Repaint' (layanan generik) ke array 'services'. DILARANG KERAS memasukkan 'Repaint Full Bodi', 'Repaint Bodi Halus', 'Repaint Bodi Kasar', atau 'Detailing' kecuali kustomer menyebutnya secara eksplisit!

Format JSON output yang diharapkan:
{
  "motor": "Merek/model motor",
  "color": "Warna cat",
  "part": "Bagian motor",
  "objection": "Keberatan kustomer",
  "services": ["layanan 1"],
  "velgCondition": "Kondisi velg",
  "hasDamage": true/false,
  "bookingDate": "Tanggal booking absolut dalam format YYYY-MM-DD (Evaluasi berdasar WAKTU SEKARANG, misal jika besok, hitung tanggalnya jadi '2026-07-25')",
  "bookingTime": "Jam booking dalam format HH:mm (misal: '10:00')",
  "visualSummary": "Ringkasan visual 1-2 kalimat (jika ada gambar)",
  "targetService": "Nama layanan yang ditanyakan (isi HANYA jika kustomer bertanya tentang layanan spesifik atau menyebut pronoun seperti 'apaan tuh', 'gimana itu')",
  "needsClarification": true/false (isi HANYA jika pronoun ambigu dan lastOffered berisi >1 layanan)
}
Field yang bernilai string (kecuali visualSummary, services, hasDamage, targetService, needsClarification) bisa berupa objek: { "value": "...", "state": "KNOWN|UNDECIDED|NOT_APPLICABLE" }.`;

        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage({ content: lastUserContent })
        ]);
        
        const rawResponseText = response.content;
        const cleanedJson = rawResponseText.replace(/```json\n?|```/g, '').trim();
        const extraction = JSON.parse(cleanedJson);
        console.log('[Memory Extractor] Extracted Data:', JSON.stringify(extraction));
        
        const updates = {};

        if (extraction.motor || extraction.color) {
            updates.vehicle = { ...state.vehicle };
            if (extraction.motor) {
                const currentMotor = state.vehicle?.model;
                if (extraction.motor.state === 'KNOWN' || currentMotor?.state !== 'KNOWN') {
                    updates.vehicle.model = extraction.motor;
                }
            }
            if (extraction.color) {
                const currentColor = state.vehicle?.paintType;
                if (extraction.color.state === 'KNOWN' || currentColor?.state !== 'KNOWN') {
                    updates.vehicle.paintType = extraction.color;
                    // Also save to knownFacts so rules and planner can detect special colors
                    updates.consultation = updates.consultation || { ...state.consultation };
                    updates.consultation.knownFacts = updates.consultation.knownFacts || { ...(state.consultation?.knownFacts || {}) };
                    updates.consultation.knownFacts.paintColor = extraction.color;
                }
            }
        }

        if (extraction.targetService || extraction.objection || extraction.part || (extraction.services && extraction.services.length > 0) || extraction.velgCondition || extraction.hasDamage !== undefined) {
            updates.consultation = updates.consultation || { ...state.consultation };
            updates.consultation.knownFacts = updates.consultation.knownFacts || { ...(state.consultation?.knownFacts || {}) };

            
            if (extraction.objection) {
                const currentObj = state.consultation?.knownFacts?.commonObjection;
                if (extraction.objection.state === 'KNOWN' || currentObj?.state !== 'KNOWN') {
                    updates.consultation.knownFacts.commonObjection = extraction.objection;
                }
            }
            if (extraction.velgCondition) {
                const currentVelg = state.consultation?.knownFacts?.velgCondition;
                if (extraction.velgCondition.state === 'KNOWN' || currentVelg?.state !== 'KNOWN') {
                    updates.consultation.knownFacts.velgCondition = extraction.velgCondition;
                }
            }
            if (extraction.hasDamage !== undefined && extraction.hasDamage !== null) {
                updates.consultation.knownFacts.hasDamage = extraction.hasDamage;
            }
            if (extraction.part) {
                const currentPart = state.consultation?.knownFacts?.partToRepaint;
                if (extraction.part.state === 'KNOWN' || currentPart?.state !== 'KNOWN') {
                    updates.consultation.knownFacts.partToRepaint = extraction.part;
                }
                
                // Regex fallback to ensure requestedServices captures all specific repaint flows
                const partLower = extraction.part.value ? extraction.part.value.toLowerCase() : '';
                const specificServices = [];
                if (partLower.includes('halus')) specificServices.push('Repaint Bodi Halus');
                if (partLower.includes('kasar')) specificServices.push('Repaint Bodi Kasar');
                if (partLower.includes('velg') || partLower.includes('pelg')) specificServices.push('Repaint Velg');
                if (partLower.includes('full') && !partLower.includes('halus') && !partLower.includes('kasar')) specificServices.push('Repaint Full Bodi');

                if (specificServices.length > 0) {
                    extraction.services = extraction.services || [];
                    specificServices.forEach(srv => {
                        if (!extraction.services.includes(srv)) {
                            extraction.services.push(srv);
                        }
                    });
                }
            }

            if (extraction.targetService) {
                const targetLower = typeof extraction.targetService === 'string' ? extraction.targetService.toLowerCase() : '';
                const specificServices = [];
                if (targetLower.includes('halus')) specificServices.push('Repaint Bodi Halus');
                if (targetLower.includes('kasar')) specificServices.push('Repaint Bodi Kasar');
                if (targetLower.includes('velg') || targetLower.includes('pelg')) specificServices.push('Repaint Velg');
                if (targetLower.includes('full') && !targetLower.includes('halus') && !targetLower.includes('kasar')) specificServices.push('Repaint Full Bodi');
                if (targetLower.includes('detailing')) specificServices.push('Detailing');
                if (targetLower.includes('cuci')) specificServices.push('Cuci Komplit');

                if (specificServices.length > 0) {
                    extraction.services = extraction.services || [];
                    specificServices.forEach(srv => {
                        if (!extraction.services.includes(srv)) {
                            extraction.services.push(srv);
                        }
                    });
                }
            }
        } // End of if (extraction.targetService...) block
        
        // Ultimate fallback: ALWAYS regex the raw user message for service names just in case the LLM misses it
        const rawTextLower = lastUserMessageText.toLowerCase();
        const rawSpecificServices = [];
        if (rawTextLower.includes('halus')) rawSpecificServices.push('Repaint Bodi Halus');
        if (rawTextLower.includes('kasar')) rawSpecificServices.push('Repaint Bodi Kasar');
        if (rawTextLower.includes('velg') || rawTextLower.includes('pelg')) rawSpecificServices.push('Repaint Velg');
        if (rawTextLower.includes('full') && !rawTextLower.includes('halus') && !rawTextLower.includes('kasar')) rawSpecificServices.push('Repaint Full Bodi');
        if (rawTextLower.includes('detailing')) rawSpecificServices.push('Detailing');
        if (rawTextLower.includes('cuci')) rawSpecificServices.push('Cuci Komplit');

        if (rawSpecificServices.length > 0) {
            extraction.services = extraction.services || [];
            rawSpecificServices.forEach(srv => {
                if (!extraction.services.includes(srv)) {
                    extraction.services.push(srv);
                }
            });
        }
        
        if (extraction.services && extraction.services.length > 0) {
            updates.consultation = updates.consultation || { ...state.consultation };
            const existingServices = state.consultation?.requestedServices || [];
            
            // Check if user's message contains additive keywords (e.g. "kalau sama velg", "tambah bodi kasar")
            const textLower = lastUserMessageText.toLowerCase();
            const isAdditive = ['tambah', 'sama', 'sekalian', 'plus', 'juga', 'gabung', 'dengan'].some(w => textLower.includes(w));
            
            let newServices;
            if (isAdditive || existingServices.length === 0) {
                // Accumulate/add to existing services
                newServices = [...new Set([...existingServices, ...extraction.services])];
            } else {
                // User is stating/replacing their desired service (e.g. "bodi halus kak", "velg aja")
                newServices = [...new Set(extraction.services)];
            }
            
            // Conflict Resolution & Stale Services Cleanup:
            const mentionsKasar = textLower.includes('kasar');
            const mentionsFull = textLower.includes('full');
            const mentionsCuci = textLower.includes('cuci');
            const mentionsDetailing = textLower.includes('detailing');

            // If user specifies Bodi Halus or Velg without mentioning Kasar/Full/Cuci/Detailing,
            // remove stale services accumulated from previous turns.
            if (newServices.includes('Repaint Bodi Halus') || extraction.services.includes('Repaint Bodi Halus')) {
                if (!mentionsKasar && !mentionsFull) {
                    newServices = newServices.filter(s => s !== 'Repaint Bodi Kasar' && s !== 'Repaint Full Bodi');
                }
            }
            if (!mentionsCuci) {
                newServices = newServices.filter(s => s !== 'Cuci Komplit');
            }
            if (!mentionsDetailing) {
                newServices = newServices.filter(s => s !== 'Detailing');
            }
            if (newServices.includes('Repaint Bodi Kasar') && !newServices.includes('Repaint Full Bodi') && !mentionsFull) {
                newServices = newServices.filter(s => s !== 'Repaint Full Bodi');
            }

            updates.consultation.requestedServices = newServices;
        }

        if (extraction.bookingDate || extraction.bookingTime) {
            updates.consultation = updates.consultation || { ...state.consultation };
            updates.consultation.knownFacts = updates.consultation.knownFacts || { ...(state.consultation?.knownFacts || {}) };
            
            if (extraction.bookingDate) {
                const currentBD = state.consultation?.knownFacts?.bookingDate;
                if (extraction.bookingDate.state === 'KNOWN' || currentBD?.state !== 'KNOWN') {
                    updates.consultation.knownFacts.bookingDate = { state: 'KNOWN', value: extraction.bookingDate };
                }
            }
            if (extraction.bookingTime) {
                const currentBT = state.consultation?.knownFacts?.bookingTime;
                if (extraction.bookingTime.state === 'KNOWN' || currentBT?.state !== 'KNOWN') {
                    updates.consultation.knownFacts.bookingTime = { state: 'KNOWN', value: extraction.bookingTime };
                }
            }
        }

        // Persist coreference fields to V2 knownFacts so plannerNode can read them
        if (extraction.targetService || extraction.needsClarification !== undefined) {
            if (!updates.consultation) {
                updates.consultation = { ...state.consultation };
                updates.consultation.knownFacts = { ...(updates.consultation.knownFacts || {}) };
            }
            if (extraction.targetService) {
                updates.consultation.knownFacts.targetService = extraction.targetService;
            }
            if (extraction.needsClarification !== undefined) {
                updates.consultation.knownFacts.needsClarification = extraction.needsClarification;
            }
        }

        if (extraction.visualSummary) {
            updates.metadata = { ...(state.metadata || {}) };
            updates.metadata.visualSummary = extraction.visualSummary;
        }

        return updates;
    } catch (error) {
        console.error('[Memory Extractor] LLM Error:', error);
        return {};
    }
}

module.exports = {
    extractMemory
};
