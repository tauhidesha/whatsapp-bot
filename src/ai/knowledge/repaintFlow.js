/**
 * Repaint Service Flows
 *
 * Defines blocking facts, required facts, optional facts, and conversation stages
 * for each repaint sub-flow. Used by the Rule Engine to supply constraints to the
 * Planner, ensuring the conversation follows the intended SOP step-by-step.
 *
 * SOP Repaint (per owner):
 *   1. Tanya motor apa
 *   2. Tanya bagian mana (bodi halus / kasar / velg / full)
 *   3a. [Bodi Halus] Tanya warna → kasih harga paket → rekomendasikan Standar → tawarkan combo
 *   3b. [Velg] Tanya warna + kondisi velg → kasih harga → tawarkan combo
 *   3c. [Bodi Kasar] Langsung harga (tidak tanya warna) → tawarkan combo
 *   4. Booking
 */

const REPAINT_FLOWS = {
    FULL_BODY: {
        // Full Bodi = Bodi Halus + Bodi Kasar
        blockingFacts: [
            'motorModel',    // Step 1: wajib tahu motor
            'partToRepaint'  // Step 2: sudah jelas (full bodi)
            // paintColor BUKAN blocking — tampilkan harga dulu, tanya warna sesudahnya
        ],
        requiredFacts: [],
        optionalFacts: [
            'paintColor',    // Ditanyakan SETELAH harga & rekomendasi paket ditampilkan
            'upsell_velg'
        ],
        blockedFacts: [],
        conversationStages: [
            'ASK_MOTOR',
            'SHOW_PRICE_WITH_PACKAGE_RECOMMENDATION',  // Tampilkan harga base + rekomendasikan Standar
            'ASK_COLOR_AFTER_PRICE',                   // Tanya warna sesudah harga
            'UPSELL_VELG_COMBO',
            'BOOKING'
        ]
    },

    BODY_HALUS: {
        blockingFacts: [
            'motorModel',    // Step 1: wajib tahu motor
            'partToRepaint'  // Step 2: sudah jelas (bodi halus)
            // paintColor BUKAN blocking — tampilkan harga dulu, tanya warna sesudahnya
        ],
        requiredFacts: [],
        optionalFacts: [
            'paintColor',    // Ditanyakan SETELAH harga & rekomendasi paket ditampilkan
            'upsell_bodi_kasar',
            'upsell_velg'
        ],
        blockedFacts: [],
        conversationStages: [
            'ASK_MOTOR',
            'SHOW_PRICE_WITH_PACKAGE_RECOMMENDATION',  // Tampilkan harga base + rekomendasikan Standar
            'ASK_COLOR_AFTER_PRICE',                   // Tanya warna sesudah harga
            'UPSELL_COMBO',
            'BOOKING'
        ]
    },

    BODY_KASAR: {
        blockingFacts: [
            'motorModel',    // Step 1: wajib tahu motor
            'partToRepaint'  // Step 2: sudah jelas (bodi kasar)
            // Tidak perlu tanya warna — bodi kasar menggunakan cat hitam/standard
        ],
        requiredFacts: [],
        optionalFacts: [
            'upsell_bodi_halus',  // Tawarkan combo Bodi Halus setelah harga
            'upsell_velg'
        ],
        blockedFacts: [
            'paintType',
            'paintColor',
            'color'
        ],
        conversationStages: [
            'ASK_MOTOR',
            'SHOW_PRICE_WITH_PACKAGE_RECOMMENDATION',
            'UPSELL_COMBO',
            'BOOKING'
        ]
    },

    VELG: {
        blockingFacts: [
            'motorModel',     // Step 1: wajib tahu motor
            'partToRepaint'   // Step 2: sudah jelas (velg)
        ],
        requiredFacts: [
            'paintColor',     // Step 3a: tanya warna velg
            'velgCondition'   // Step 3b: kondisi velg (ori/sudah pernah dicat) → pengaruh surcharge
        ],
        optionalFacts: [
            'upsell_bodi_halus'  // Setelah harga, tawarkan combo Bodi Halus
        ],
        blockedFacts: [],
        conversationStages: [
            'ASK_MOTOR',
            'ASK_VELG_COLOR_AND_CONDITION',
            'SHOW_PRICE_WITH_SURCHARGE_INFO',
            'UPSELL_COMBO',
            'BOOKING'
        ]
    }
};

// ---------------------------------------------------------------------------
// Color Trend Advisory
// Knowledge tentang tren warna yang bisa dibagikan saat user diskusi warna.
// Dipakai oleh rule engine untuk inject ke guidelines Planner/Composer.
// ---------------------------------------------------------------------------
const COLOR_TREND_ADVISORY = {
    enabled: true,
    headline: 'Tren warna repaint 2024-2025',
    trends: [
        { name: 'Candy Colors', description: 'warna solid semi-transparan yang kelihatan dalam dan glossy — populer banget sekarang, terutama candy red, candy blue, candy orange' },
        { name: 'Warna Berpartikel / Metallic Flake', description: 'ada efek glitter/sparkle halus yang keliatan waktu kena sinar — efeknya premium banget, lagi banyak diminati' },
        { name: 'Matte / Doff Custom', description: 'warna solid tapi tanpa kilap — kesan elegan dan beda dari yang lain, cocok untuk Bodi Halus' },
        { name: 'Two-tone / Dual Color', description: 'kombinasi dua warna di bagian berbeda — butuh skill lebih, tapi hasilnya sangat eye-catching' }
    ],
    consultNote: 'Kalau mau yang lebih custom atau masih bingung mau warna apa, bisa langsung diskusi sama Bosmat untuk dapat saran sesuai karakter motornya.'
};

// ---------------------------------------------------------------------------
// Package Recommendation
// Panduan untuk merekomendasikan paket Standar sebagai default suggestion.
// ---------------------------------------------------------------------------
const PACKAGE_RECOMMENDATION = {
    preferredPackage: 'Standar',
    reason: 'Paket Standar adalah pilihan paling value — harga beda tipis dengan Basic tapi kualitas cat dan proses pengerjaan jauh lebih baik. Paling banyak dipilih customer kami.',
    note: 'Sampaikan rekomendasi ini secara natural, bukan seperti hard sell. Bisa bilang: "kebanyakan customer pilih yang Standar karena..."'
};

module.exports = {
    REPAINT_FLOWS,
    COLOR_TREND_ADVISORY,
    PACKAGE_RECOMMENDATION
};
