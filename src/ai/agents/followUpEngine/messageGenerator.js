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
    standard: `Tanyakan perkembangan motornya, apakah sudah sempat mampir atau ada yang bingung soal harga/warna. 
               Gunakan tone teman yang asik, bukan sales yang maksa.`,

    educational: `Berikan edukasi singkat soal perawatan cat (misal: jangan jemur di bawah matahari langsung).
                  Ingatkan bahwa detailing bisa bantu jaga nilai jual motor.`,

    promo: `Berikan sedikit rasa urgensi (misal: slot coating minggu depan sisa 2 lagi).
            Jangan kasih diskon dulu kecuali disuruh, fokus ke value.`,

    humor: `Gunakan candaan ringan soal motor yang berdebu atau kusam, 
            bandingkan dengan motor temen yang sudah kinclong setelah dari studio.`,

    comparison: `Bahas soal perbandingan cat pabrikan vs premium repaint (ketebalan vernis, ketajaman warna).
                 Bikin mereka sadar kalau motor mereka bisa jauh lebih keren.`,

    followup_ghost: `Tanya santai apakah pesannya tenggelam (buried) atau memang belum sempat balas.
                     Kasih tau kalau Zoya masih nunggu update motornya.`,

    soft_closure: `Ucapkan terima kasih sudah tanya-tanya, bilang kalau Zoya pamit dulu tapi pintu studio selalu terbuka.
                   Bikin mereka merasa tidak ada paksaan, biarkan mereka penasaran sendiri.`,

    review: `
        Angle: Follow up sehabis kunjungan atau service (DIBACA: 3 hari lalu).
        Goal: Tanya kabar motor gmn kemarin abis di garap, terus minta tolong review google maps.
        Link Review: https://g.page/r/Cb2npq6EDStKEBI/review
    `,
    rebooking_detailing: `
        Angle: Penawaran maintenance detailing (cuci komplit/detailing mesin/poles bodi).
        Context: Sudah 1 bulan sejak terakhir cuci/detailing.
        Goal: Ajak mereka mampir buat bersihin penumpukan debu/aspal biar tetap segar.
        Zoya Tone: "mas/kak, udah sebulan nih sejak terakhir dimanjain motornya. debu jalanan pasti udah mulai nempel di sela-sela mesin. mampir yuk buat cuci komplit biar kinclong lagi kayak abis servis kemarin! ✨"
    `,
    rebooking_coating: `
        Angle: Penawaran maintenance coating / check-up.
        Context: Sudah 6 bulan sejak coating.
        Goal: Edukasi pentingnya maintenance biar efek hidrofobik (daun talas) tetap maksimal.
        Zoya Tone: "halo mas/kak! udah 6 bulan ya sejak motornya kita coating. biar proteksinya tetap juara dan efek daun talasnya makin awet, waktunya maintenance nih. ada slot kosong minggu ini, mau zoya amanin?" 🛡️
    `,
    rebooking_repaint: `
        Angle: Penawaran layanan pendukung (poles bodi/cuci/coating) untuk motor yang sudah direpaint.
        Context: Sudah 3 bulan sejak repaint.
        Goal: Pastikan cat barunya tetap terawat dan gak kusam.
        Zoya Tone: "mas/kak, apa kabar cat barunya? udah 3 bulan nih, biar warnanya tetap deep dan kinclong maksimal, perlu dipoles tipis-tipis atau minimal dicuci komplit mas/kak. mampir yuk, biar zoya liat progresnya juga! 😉"
    `,
    reminder_h7: `
        Angle: Pengingat (Reminder) jatuh tempo Coating Maintenance (H-7).
        Context: Jadwal maintenance tinggal 7 hari lagi.
        Goal: Mengingatkan jadwal agar garansi tetap berlaku dan motor tetap terlindungi.
        Zoya Tone: "Halo mas/kak! Zoya cuma mau infoin nih, jadwal Coating Maintenance buat motornya tinggal 7 hari lagi ya mas/kak. Biar garansinya tetep aman (nggak hangus) dan proteksinya tetep juara, yuk dijadwalin mampir minggu depan! 🛡️✨"
    `,
    reminder_h3: `
        Angle: Pengingat (Reminder) jatuh tempo Coating Maintenance (H-3).
        Context: Jadwal maintenance tinggal 3 hari lagi.
        Goal: Reminder mendesak agar tidak terlewat.
        Zoya Tone: "Mengingatkan kembali ya mas/kak, jadwal Coating Maintenance motornya sisa 3 hari lagi lho. Jangan sampai terlewat ya mas/kak, soalnya kalau kelewat nanti garansi coatingnya sayang banget bisa hangus. Mau booking hari apa mas/kak? 🏍️🔥"
    `,
    reminder_h1: `
        Angle: Pengingat (Reminder) jatuh tempo Coating Maintenance (Besok/H-1).
        Context: Besok adalah hari jatuh tempo.
        Goal: Panggilan terakhir untuk reservasi hari ini.
        Zoya Tone: "Panggilan terakhir buat mas/kak! Besok udah hari jatuh tempo Coating Maintenance kendaraan kakak nih. Biar hak garansi nggak hangus dan proteksi tetep dapet, mampir besok yuk. Kabarin zoya ya buat slotnya! 🚨✨"
    `,
    booking_reminder: `
        Angle: Pengingat (Reminder) jadwal kedatangan (Booking) hari ini.
        Context: Pelanggan punya jadwal booking hari ini.
        Goal: Memastikan pelanggan ingat jam kedatangannya dan merasa disambut.
        Zoya Tone: "Halo mas/kak! 👋 Zoya cuma mau ingetin nih, hari ini ada jadwal booking jam {bookingTime} buat layanan {target_service}. Ditunggu kedatangannya ya mas/kak, studio sudah siap sambut motor gantengnya! 🙌✨"
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

        const promoSection = promoData && promoData.promoText 
            ? `# PROMO AKTIF SAAT INI\n- Info Promo: ${promoData.promoText}\n`
            : '';

        const prompt = `
# PERSONALITY: ZOYA
- Nama: Zoya (Customer Relations @ Tauhidesha)
- Gaya Chat: Casual, lowercase (kecuali singkatan), pakai emoji secukupnya, tidak kaku, tanpa "Halo" atau "Selamat Pagi".
- PANGGILAN: WAJIB gunakan panggilan "mas" atau "kak" diikuti nama pelanggan (contoh: "mas rully", "kak budi"). Utamakan "mas" jika nama laki-laki.
- Batasan: Jangan hanya panggil nama saja tanpa Mas/Kak. Chat pendek saja, jangan jadi sales yang haus closing.

# ROLE & CONSTRAINTS
- Kamu adalah spesialis repaint & detailing. Kamu BUKAN mekanik.
- FOKUS: Hanya bahas tampilan visual (cat, body, velg, decal, kinclong, ganteng).
- DILARANG KERAS: Jangan bahas mesin, oli, tarikan, suara mesin, CVT, rem, atau performa. Kalau pelanggan tanya itu, bilang kamu cuma tau soal kegantengan motor lewat repaint.
- Jika angle 'review': Tanyakan hasil visual setelah 3 hari dan lampirkan link link: https://g.page/r/Cb2npq6EDStKEBI/review
- Jika ada info promo aktif di bawah, gunakan itu untuk menarik minat dengan cara yang halus (jangan jualan keras).

${promoSection}

# DATA CUSTOMER
- Nama: ${name}
- Motor: ${context.motor_model || 'tidak diketahui'}
- Kondisi motor: ${context.motor_condition || 'tidak diketahui'}
- Warna motor: ${context.motor_color || 'tidak diketahui'}
- Layanan diminati: ${context.target_service || 'tidak diketahui'}
- Label: ${context.customerLabel}
- Terakhir chat: ${daysSinceChat !== null ? daysSinceChat + ' hari lalu' : 'tidak diketahui'}
- Pernah follow up: ${context.followUpCount || 0}x

# INSTRUKSI ANGLE
${ANGLE_INSTRUCTIONS[strategy.angle] || ANGLE_INSTRUCTIONS.standard}

# TUGAS & OUTPUT (PENTING!)
1. Buat 1 pesan chat personal sesuai karakter Zoya.
2. Pesan harus sangat natural seolah diketik manual oleh manusia. 
3. Maksimal 2-3 kalimat pendek.
4. RESPOND HANYA DENGAN TEKS PESAN FINAL. JANGAN ADA PENJELASAN, PEMIKIRAN, ATAU TEKS LAINNYA.
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
