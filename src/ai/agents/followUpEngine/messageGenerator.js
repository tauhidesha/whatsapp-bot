// File: src/ai/agents/followUpEngine/messageGenerator.js
// Logic for generating follow-up messages based on customer context and AI personality.

const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Calculate days passed since a given date.
 * @param {Date|string} date 
 * @returns {number|null}
 */
function getDaysSince(date) {
    if (!date) return null;
    const now = new Date();
    const past = new Date(date);
    const diffTime = Math.abs(now - past);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Strategy definitions (Angle instructions)
const ANGLE_INSTRUCTIONS = {
    standard: `Ajak ngobrol santai soal minat awalnya. Tanya ada kendala atau kebingungan apa (warna/harga/detail) tanpa terkesan ngejar-ngejar.`,

    educational: `Berikan insight atau tips perawatan motor yang relevan dengan bodi/cat. Bikin mereka ngerasa dapet value baru dari Zoya.`,

    promo: `Kasih info slot terbatas atau urgensi halus yang lagi jalan di studio. Fokus ke benefit eksklusif buat motor mereka.`,

    humor: `Gunakan pendekatan bercanda receh atau ringan soal kondisi motor/hobi motor. Bikin suasana jadi cair dan asik.`,

    comparison: `Bahas perbandingan kualitas hasil (misal: repaint premium vs standar) atau pentingnya proteksi bodi sejak dini.`,

    followup_ghost: `Tanya kabar santai karena udah lama gak muncul. Boleh bercanda dikit apakah chat sebelumnya tenggelam atau lagi sibuk banget touring.`,

    soft_closure: `Ucapkan terima kasih dan info kalau Zoya pamit dulu buat sekarang, tapi ingetin kalau butuh bantuan/tanya-tanya soal motor kedepannya Zoya selalu stand by.`,

    review: `
        Angle: Follow up sehabis kunjungan atau service (DIBACA: 3 hari lalu).
        Goal: Tanya kabar motor gmn kemarin abis di garap, terus minta tolong review google maps.
        Link Review: https://g.page/r/Cb2npq6EDStKEBI/review
    `,
    rebooking_detailing: `
        Angle: Penawaran maintenance detailing (cuci komplit/detailing mesin/poles bodi).
        Context: Sudah 1 bulan sejak terakhir cuci/detailing.
        Goal: Ajak mampir buat bersihin penumpukan debu/aspal biar tetap segar. Sertakan ajakan untuk treat motornya lagi.
    `,
    rebooking_coating: `
        Angle: Penawaran maintenance coating / check-up.
        Context: Sudah 6 bulan sejak coating.
        Goal: Edukasi pentingnya maintenance biar efek hidrofobik (daun talas) tetap maksimal. Tanya kapan ada waktu buat mampir check-up.
    `,
    rebooking_repaint: `
        Angle: Penawaran layanan pendukung (poles bodi/cuci/coating) untuk motor yang sudah direpaint.
        Context: Sudah 3 bulan sejak repaint.
        Goal: Pastikan cat barunya tetap terawat dan gak kusam. Ajak mampir buat diliat progres catnya.
    `,
    reminder_h7: `
        Angle: Pengingat jatuh tempo Coating Maintenance (H-7).
        Goal: Mengingatkan jadwal penting agar garansi tetap berlaku dan proteksi tetap maksimal. Pakai tone informatif.
    `,
    reminder_h3: `
        Angle: Pengingat jatuh tempo Coating Maintenance (H-3).
        Goal: Reminder yang lebih mendesak karena sisa 3 hari. Ingetin soal sayang banget kalau garansi hangus.
    `,
    reminder_h1: `
        Angle: Pengingat jatuh tempo Coating Maintenance (Besok/H-1).
        Goal: Panggilan terakhir untuk reservasi hari ini/besok agar hak garansi aman.
    `,
    booking_reminder: `
        Angle: Pengingat jadwal kedatangan (Booking) hari ini.
        Goal: Memastikan pelanggan ingat jam kedatangannya dan merasa disambut di studio. Cantumkan jam booking dan layanannya.
    `
};

/**
 * Clean AI response from common reasoning, preambles, or thought blocks.
 * @param {string} text 
 * @returns {string}
 */
function cleanAiResponse(text) {
    if (!text) return '';
    
    // 1. Remove <thought>...</thought> blocks (Gemini 2.0 Thinking/CoT)
    let cleaned = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

    // 2. Remove common AI preambles (e.g., "Certainly!", "Here is a draft:")
    const preambles = [
        /^Certainly!.*$/gim,
        /^Here is a.*$/gim,
        /^Based on the customer data.*$/gim,
        /^Try this message:.*$/gim,
        /^Pesan follow-up:.*$/gim,
        /^Draft pesan:.*$/gim
    ];

    preambles.forEach(p => {
        cleaned = cleaned.replace(p, '');
    });

    // 3. Extract final message if AI still provides instructions/options
    const paragraphs = cleaned.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) {
        const lastParagraph = paragraphs[paragraphs.length - 1].trim();
        // If last paragraph is short and doesn't look like instructions, it's likely the message
        if (!lastParagraph.includes(':') && !lastParagraph.startsWith('*')) {
            cleaned = lastParagraph;
        }
    }

    // 4. Deduplication Logic (Special case for Gemini repeat)
    const len = cleaned.length;
    if (len > 20) {
        const half = Math.floor(len / 2);
        const p1 = cleaned.substring(0, half).trim();
        const p2 = cleaned.substring(len - p1.length).trim();
        
        // Exact half repeat
        if (p1 === p2) {
            cleaned = p1;
        } else {
            // Check for "Message" "Message" or Message + " + Message
            const parts = cleaned.split('"').filter(p => p.trim().length > 10);
            if (parts.length > 1 && parts[0].trim() === parts[1].trim()) {
                cleaned = parts[0].trim();
            }
        }
    }

    return cleaned.trim();
}
async function generateFollowUpMessage(customerData, strategy, promoData = null) {
    try {
        const { name, context, metadata } = customerData;
        const daysSinceChat = getDaysSince(metadata.lastMessageAt);
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = process.env.AI_MODEL || 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({ model: modelName });

        const followUpCount = context.followUpCount || 0;
        const lastFollowUpStrategy = context.lastFollowUpStrategy || 'tidak ada';

        const promoSection = promoData && promoData.promoText 
            ? `# PROMO AKTIF SAAT INI\n- Info Promo: ${promoData.promoText}\n`
            : '';

        const prompt = `
# PERSONALITY: ZOYA
- Nama: Zoya (Customer Relations @ Bosmat Studio)
- Gaya Chat: Casual, lowercase (kecuali singkatan), pakai emoji secukupnya, tidak kaku, tanpa "Halo" atau "Selamat Pagi".
- PANGGILAN: WAJIB gunakan panggilan "mas" atau "kak" diikuti nama pelanggan (contoh: "mas rully", "kak budi"). Utamakan "mas" jika nama laki-laki.
- Batasan: Jangan hanya panggil nama saja tanpa Mas/Kak. Chat pendek saja, jangan jadi sales yang haus closing.

# ROLE & CONSTRAINTS
- Kamu adalah spesialis repaint & detailing. Kamu BUKAN mekanik.
- FOKUS: Hanya bahas tampilan visual (cat, body, velg, decal, kinclong, ganteng).
- DILARANG KERAS: Jangan bahas mesin, oli, tarikan, suara mesin, CVT, rem, atau performa.
- Jika angle 'review': Tanyakan hasil visual setelah 3 hari dan lampirkan link link: https://g.page/r/Cb2npq6EDStKEBI/review
- Jika ada info promo aktif di bawah, gunakan itu untuk menarik minat dengan cara yang halus.

${promoSection}

# DATA CUSTOMER
- Nama: ${name}
- Motor: ${context.motor_model || 'tidak diketahui'}
- Kondisi motor: ${context.motor_condition || 'tidak diketahui'}
- Warna motor: ${context.motor_color || 'tidak diketahui'}
- Layanan diminati: ${context.target_service || 'tidak diketahui'}
- Terakhir chat: ${daysSinceChat !== null ? daysSinceChat + ' hari lalu' : 'tidak diketahui'}

# STRATEGIC CONTEXT
- Follow-up Ke: ${followUpCount + 1}
- Strategi Sebelumnya: ${lastFollowUpStrategy}
${followUpCount > 0 ? '- INSTRUKSI: Ini bukan follow up pertama. JANGAN gunakan pembukaan standar. Coba pendekatan yang lebih personal atau spesifik ke detail motornya.' : ''}

# ANTI-TEMPLATE RULES
- DILARANG mulai dengan "gimana perkembangan motornya" atau "udah sempat mampir" jika sudah pernah follow up sebelumnya.
- Variasikan pembukaan setiap kali; jangan pakai pola yang sama dengan pesan sebelumnya.
- Referensikan detail motor (model/warna) atau layanan yang diminati agar terasa personal.
- Boleh mulai dengan pertanyaan ringan atau mention sesuatu yang relevan dengan hobi motor.

# INSTRUKSI ANGLE
${ANGLE_INSTRUCTIONS[strategy.angle] || ANGLE_INSTRUCTIONS.standard}

# TUGAS & OUTPUT (PENTING!)
1. Buat 1 pesan chat personal sesuai karakter Zoya.
2. Pesan harus sangat natural, seolah diketik manual, tanpa kesan template.
3. Maksimal 2-3 kalimat pendek.
4. RESPOND HANYA DENGAN TEKS PESAN FINAL. JANGAN ADA PENJELASAN ATAU DRAFT.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text();
        
        // Clean the response before returning
        return cleanAiResponse(rawText);

    } catch (error) {
        console.error('[MessageGenerator] Error:', error);
        return null;
    }
}

module.exports = {
    generateFollowUpMessage,
    getDaysSince,
    STRATEGY_CONFIG: {
        // This is moved to config.js, but kept here for backward compatibility if needed
    }
};
