// File: src/ai/agents/followUpEngine/messageGenerator.js
// Logic for generating follow-up messages based on customer context and AI personality.

const prisma = require('../../../lib/prisma');
const { DateTime } = require('luxon');

// Same timezone the cron scheduler uses (scheduler.js: DateTime.now().setZone(TIMEZONE)).
// getDaysSince is the single place all day-based eligibility math goes through
// (isEligible, review window, rebooking, downgrade rules) — keeping it aligned
// to APP_TIMEZONE instead of the server's OS timezone avoids off-by-one-day
// eligibility flips if the server ever runs in a different TZ than the business.
const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Jakarta';

/**
 * Calculate days passed since a given date, using APP_TIMEZONE calendar days
 * (not the server's OS timezone).
 * @param {Date|string} date 
 * @returns {number|null}
 */
function getDaysSince(date) {
    if (!date) return null;

    const now = DateTime.now().setZone(TIMEZONE).startOf('day');
    const past = DateTime.fromJSDate(new Date(date)).setZone(TIMEZONE).startOf('day');

    if (!past.isValid) return null;

    return Math.round(Math.abs(now.diff(past, 'days').days));
}

/**
 * Resolve which angle key to use for this message.
 * Priority:
 *   1. strategy.angle (singular) — explicit override set by scheduler.js
 *      for review / rebooking_* / reminder_* / booking_reminder cases.
 *   2. strategy.angles[followUpCount] — per-FU rotation from STRATEGY_CONFIG
 *      (nurture flow: hot_lead, warm_lead, window_shopper, etc). Falls back
 *      to the last entry in the array if followUpCount exceeds its length.
 *   3. 'standard' — safety net if neither is present.
 */
/**
 * Minimal safety net for the JSON-parse-failure fallback path only.
 * The normal path already gets clean text via strict JSON output
 * ({"message": "..."}), so this isn't a general-purpose cleaner — it just
 * strips stray <thought> blocks some models emit when they fail to follow
 * the JSON instruction, so a rare malformed response doesn't leak reasoning
 * straight to the customer.
 */
function stripThoughtBlocks(text) {
    if (!text) return text;
    return text.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
}

function resolveAngle(strategy, followUpCount) {
    if (strategy.angle) return strategy.angle;
    if (Array.isArray(strategy.angles) && strategy.angles.length > 0) {
        return strategy.angles[followUpCount] || strategy.angles[strategy.angles.length - 1];
    }
    return 'standard';
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

    // ── Angles baru, dipakai oleh STRATEGY_CONFIG.angles[] di config.js ──────
    value: `Highlight manfaat konkret dari layanan yang mereka minati (hasil visual, ketahanan, dsb) tanpa kesan promo. Ajak diskusi santai soal itu.`,

    clarify: `Tanya hal spesifik yang bikin mereka belum lanjut (masih mikir warna, budget, atau waktu) dengan nada penasaran-santai, bukan interogasi.`,

    social_proof: `Ceritain hasil kerjaan customer lain yang mirip (before-after, testimoni singkat) biar mereka makin yakin sama hasil yang bisa didapat.`,

    urgency: `Sampein ada slot terbatas atau alasan kenapa sebaiknya jangan ditunda (musim hujan, antrian mulai penuh, dsb) — nada halus, bukan maksa.`,

    light_promo: `Selipin info promo/benefit secara halus di akhir obrolan, tapi fokus utama tetap ngobrol santai bukan jualan.`,

    maintenance: `Ingetin waktunya rawat/servis ulang biar kondisi tetap optimal (motor/hasil coating/cat). Tone-nya caring kayak temen yang concern, bukan jualan.`,

    checkin: `Sapa santai karena udah lama ga ngobrol, tanya kabar motor atau aktivitas riding-nya. Ringan aja, ga perlu langsung ke topik servis.`,

    exclusive: `Kasih kesan mereka dapet perlakuan/prioritas khusus sebagai pelanggan lama (info duluan, slot prioritas, dsb). Bikin ngerasa dihargai.`,

    winback: `Sampein kangen karena udah lama ga mampir, tawarin insentif yang lumayan besar biar mereka tertarik balik. Boleh sedikit kasual/bercanda biar ga kaku.`,

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

// Alias: config.js pakai 'education', instruksi aslinya di 'educational'.
ANGLE_INSTRUCTIONS.education = ANGLE_INSTRUCTIONS.educational;

async function generateFollowUpMessage(customerData, strategy, promoData = null) {
    try {
        const { name, context, metadata } = customerData;

        // CRM sometimes stores a placeholder like "New Customer" / "Customer Baru"
        // before a real name is captured. Treat those as "no name known" instead
        // of forcing the bot to address the customer literally as "mas new customer".
        const PLACEHOLDER_NAME_PATTERN = /^(new customer|customer baru|pelanggan baru|walk[\s-]?in|unknown|tidak diketahui|n\/a|-|mas|kak)$/i;
        const hasKnownName = !!(name && !PLACEHOLDER_NAME_PATTERN.test(name.trim()));
        const displayName = hasKnownName ? name.trim() : null;

        const namingInstruction = hasKnownName
            ? `- PANGGILAN: WAJIB panggil nama customer dengan sapaan "mas" atau "kak" (contoh: "mas dani", "kak budi"). Ambil nama depan/panggilan dari Nama Customer. JANGAN hanya memanggil "mas" atau "kak" saja tanpa nama! Sebisa mungkin selipkan panggilan nama ini di awal, tengah, atau akhir kalimat secara natural agar terasa akrab.`
            : `- PANGGILAN: Nama customer belum diketahui — JANGAN mengarang atau memakai nilai placeholder ("new customer" dsb) sebagai nama. Panggil pakai "mas" atau "kak" saja tanpa embel-embel nama.`;

        const daysSinceChat = getDaysSince(metadata.lastMessageAt);
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
        const modelName = process.env.AI_MODEL || 'gemini-flash-latest';
        const model = new ChatGoogleGenerativeAI({
            model: modelName,
            apiKey: apiKey,
            temperature: 0.7,
        });

        const followUpCount = context.followUpCount || 0;
        const lastFollowUpStrategy = context.lastFollowUpStrategy || 'tidak ada';
        const angleKey = resolveAngle(strategy, followUpCount);

        const promoSection = promoData && promoData.promoText
            ? `# PROMO AKTIF SAAT INI\n- Info Promo: ${promoData.promoText}\n`
            : '';

        let chatHistorySection = '';
        const rawPhone = customerData.senderNumber || context.phone || customerData.docId;
        const phoneStripped = rawPhone ? rawPhone.replace(/@c\.us$|@lid$/, '') : null;

        if (rawPhone) {
            try {
                const customerRecord = await prisma.customer.findFirst({
                    where: {
                        OR: [
                            { phone: rawPhone },
                            { phone: phoneStripped },
                            { phoneReal: rawPhone },
                            { phoneReal: phoneStripped },
                            { whatsappLid: rawPhone },
                            { whatsappLid: phoneStripped },
                        ]
                    },
                    include: {
                        messages: {
                            orderBy: { createdAt: 'desc' },
                            take: 5
                        }
                    }
                });

                if (customerRecord && customerRecord.messages && customerRecord.messages.length > 0) {
                    const recentMessages = customerRecord.messages.reverse();
                    const historyText = recentMessages.map(m => {
                        const role = m.role === 'user' ? 'Customer' : 'Zoya';
                        return `[${role}]: ${m.content}`;
                    }).join('\n');

                    chatHistorySection = `
# RIWAYAT CHAT TERAKHIR (PENTING)
Berikut adalah riwayat chat terakhir dengan pelanggan ini. Gunakan konteks ini AGAR sapaan follow-up terasa sangat personal dan melanjutkan obrolan sebelumnya secara natural. JANGAN mengulang chat Zoya sebelumnya mentah-mentah, jadikan sebagai background context.
${historyText}
`;
                }
            } catch (err) {
                console.warn('[MessageGenerator] Failed to fetch chat history:', err.message);
            }
        }

        const prompt = `
# PERSONALITY: ZOYA
- Nama: Zoya (Customer Relations @ Bosmat Repaint Detailing Studio)
- Gaya Chat: Casual, huruf kecil semua (lowercase) kecuali singkatan, pakai emoji secukupnya, tidak kaku, tanpa "Halo" atau "Selamat Pagi".
- Kata Ganti Diri: WAJIB sebut dirimu sebagai "aku", JANGAN PERNAH menyebut nama "Zoya" saat merujuk pada dirimu sendiri di dalam kalimat (contoh salah: "zoya mau nanya...", contoh benar: "aku mau nanya...").
${namingInstruction}
- Batasan: Jangan hanya panggil nama saja tanpa Mas/Kak. Chat pendek saja, jangan jadi sales yang haus closing.

# ROLE & CONSTRAINTS
- Kamu adalah spesialis repaint & detailing. Kamu BUKAN mekanik.
- FOKUS: Hanya bahas tampilan visual (cat, body, velg, decal, kinclong, ganteng).
- DILARANG KERAS: Jangan bahas mesin, oli, tarikan, suara mesin, CVT, rem, atau performa.
- Jika angle 'review': Tanyakan hasil visual setelah 3 hari dan lampirkan link link: https://g.page/r/Cb2npq6EDStKEBI/review
- Jika ada info promo aktif di bawah, gunakan itu untuk menarik minat dengan cara yang halus.

${promoSection}

# DATA CUSTOMER
- Nama: ${displayName || 'belum diketahui'}
- Motor: ${context.motorModel || 'tidak diketahui'}
- Kondisi motor: ${context.motorCondition || 'tidak diketahui'}
- Warna motor: ${context.motorColor || 'tidak diketahui'}
- Layanan diminati: ${context.targetServices && context.targetServices.length > 0 ? context.targetServices.join(', ') : 'tidak diketahui'}
- Terakhir chat: ${daysSinceChat !== null ? daysSinceChat + ' hari lalu' : 'tidak diketahui'}

${chatHistorySection}

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
${ANGLE_INSTRUCTIONS[angleKey] || ANGLE_INSTRUCTIONS.standard}

# TUGAS & OUTPUT (PENTING!)
1. Buat 1 pesan chat personal sesuai karakter Zoya.
2. Pesan harus sangat natural, seolah diketik manual, tanpa kesan template.
3. Maksimal 2-3 kalimat pendek.
4. RESPOND STRICTLY HANYA DENGAN JSON VALID TANPA MARKDOWN ATAU TEKS LAIN.
   Format JSON yang wajib digunakan:
   {
     "message": "isi pesan final di sini"
   }
`;

        const response = await model.invoke(prompt, {
            runName: "FollowUpMessageGenerator",
            tags: ["follow_up_engine", `angle_${angleKey}`]
        });

        let rawText = response.content.trim();

        // Strip markdown backticks if LLM still outputs them
        if (rawText.startsWith('```json')) {
            rawText = rawText.replace(/^```json/i, '').replace(/```$/, '').trim();
        } else if (rawText.startsWith('```')) {
            rawText = rawText.replace(/^```/i, '').replace(/```$/, '').trim();
        }

        try {
            const parsed = JSON.parse(rawText);
            return parsed.message || parsed.Message || rawText;
        } catch (e) {
            console.warn('[MessageGenerator] Failed to parse JSON, falling back to raw text:', e.message);
            return stripThoughtBlocks(rawText);
        }

    } catch (error) {
        console.error('[MessageGenerator] Error:', error);
        return null;
    }
}

module.exports = {
    generateFollowUpMessage,
    getDaysSince,
    resolveAngle,
    STRATEGY_CONFIG: {
        // This is moved to config.js, but kept here for backward compatibility if needed
    }
};