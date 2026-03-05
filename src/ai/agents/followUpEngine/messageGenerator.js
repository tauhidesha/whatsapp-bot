// File: src/ai/agents/followUpEngine/messageGenerator.js
// LLM-generated follow-up messages with angle system.
// Merged from followupPersonalizer.js + angle instructions from plan.

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');
const { getActivePromo } = require('../../utils/promoConfig.js');

const GENERATOR_MODEL = 'gemini-3.1-flash-lite-preview';

const ANGLE_INSTRUCTIONS = {
    urgency: `Buat pesan singkat yang menyebut slot minggu ini
              mulai terbatas. Jangan terkesan memaksa.
              Tidak perlu sebut promo kecuali ada.`,

    value: `Berikan 1 tips perawatan motor yang relevan dengan
            kondisi atau tipe motornya. Tutup dengan 1 kalimat
            ajakan ringan. Jangan langsung jualan.`,

    promo: null, // Diisi dinamis dari Firestore

    maintenance: `Ingatkan bahwa sudah waktunya servis lagi
                  berdasarkan layanan terakhir. Gunakan angle
                  "sayang kalau dibiarkan" bukan "ayo beli".`,

    exclusive: `Buat pesan yang terasa personal dan eksklusif.
                Customer ini pelanggan setia — jangan jualan,
                buat mereka merasa diperhatikan.`,

    winback: `Sebut 1 hal baru di Bosmat (teknik, layanan, atau
              hasil kerja terbaru). Jangan minta mereka balik —
              biarkan mereka penasaran sendiri.`,
};

function getDaysSince(timestamp) {
    if (!timestamp) return null;
    const date = timestamp?.toDate?.() || new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return Math.floor((Date.now() - date.getTime()) / 86400000);
}

/**
 * Generate follow-up message menggunakan LLM.
 * Return null jika pesan tidak bisa dibuat (e.g. window_shopper tanpa promo).
 */
async function generateFollowUpMessage(customer, strategy) {
    const { name, context, metadata } = customer;
    const angle = strategy.angle;

    // Fetch promo
    const activePromo = await getActivePromo();

    // Window shopper + tidak ada promo → skip
    if (angle === 'promo' && !activePromo) {
        console.log(`[Generator] Skip promo angle — no active promo`);
        return null;
    }

    // Build angle instruction
    let angleInstruction = ANGLE_INSTRUCTIONS[angle];
    if (angle === 'promo' && activePromo) {
        angleInstruction = `Sampaikan promo ini secara natural dalam
            1-2 kalimat, jangan copy paste langsung.
            Promo aktif: "${activePromo}"`;
    }

    // Inject promo ke angle lain kalau relevan
    const promoNote = activePromo && angle !== 'promo'
        ? `\nInfo tambahan: Ada promo aktif "${activePromo}".
           Sebutkan hanya jika sangat relevan dengan konteks,
           jangan dipaksakan.`
        : '';

    const daysSinceChat = getDaysSince(metadata?.lastMessageAt);

    const prompt = `
Kamu Zoya dari Bosmat Repainting & Detailing Studio.
Tulis 1 pesan WhatsApp follow up untuk customer ini.

Data customer:
- Nama: ${name}
- Motor: ${context.motor_model || 'tidak diketahui'}
- Kondisi motor: ${context.motor_condition || 'tidak diketahui'}
- Warna motor: ${context.motor_color || 'tidak diketahui'}
- Layanan diminati: ${context.target_service || 'tidak diketahui'}
- Label: ${context.customer_label}
- Terakhir chat: ${daysSinceChat !== null ? daysSinceChat + ' hari lalu' : 'tidak diketahui'}
- Pernah follow up sebelumnya: ${context.followup_count || 0}x

Instruksi angle: ${angleInstruction}
${promoNote}

Aturan ketat:
- Maksimal 3 kalimat
- Jangan sebut kata "follow up" atau "mengingatkan"
- Jangan tanya "sudah ada keputusan belum"
- Panggil "Mas ${(name || '').split(' ')[0]}" (bukan nama lengkap kalau panjang)
- Gaya WhatsApp: santai tapi sopan
- Jangan terlalu formal
- Jika data motor tidak ada, jangan sebut motor
- Jangan ulangi angle yang sama dengan follow up sebelumnya
`;

    try {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn('[Generator] No API key for message generation');
            return null;
        }

        const model = new ChatGoogleGenerativeAI({
            model: GENERATOR_MODEL,
            temperature: 0.8, // Lebih tinggi untuk variasi pesan
            apiKey,
        });

        const response = await model.invoke([new HumanMessage(prompt)]);

        const text = typeof response.content === 'string'
            ? response.content
            : (Array.isArray(response.content)
                ? response.content.map(c => c.text || c).join('')
                : String(response.content));

        return text?.trim() || null;
    } catch (error) {
        console.error('[Generator] Error generating message:', error.message);
        return null;
    }
}

module.exports = { generateFollowUpMessage, getDaysSince };
