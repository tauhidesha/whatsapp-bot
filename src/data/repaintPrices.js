// File: src/data/repaintPrices.js
// Data harga repaint spesifik per model motor.
// Source: src/data/daftarHargaRepaint.md (Update Februari 2026) dan daftarUkuranMotor.js

/**
 * Struktur:
 *   aliases   – array keyword agar fuzzy-match lebih mudah
 *   price     – harga tetap (number)
 *   note      – keterangan tambahan
 *   category  – sub-kategori repaint (bodi_halus | bodi_kasar | velg | warna_spesial)
 *   brand     – brand motor
 */

const repaintBodiHalus = [
    // ─── BODY 1: Matic Kecil & Bebek ───
    // Premium Small Matic (1.5jt)
    { model: "scoopy", aliases: ["honda scoopy", "scoopy prestige", "scoopy sporty", "scoopy stylish", "scoopy fi", "scoopy injection"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "genio", aliases: ["honda genio"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "fino", aliases: ["yamaha fino", "fino premium", "fino grande"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },
    { model: "fazzio", aliases: ["yamaha fazzio", "grand filano", "yamaha grand filano", "filano", "fazio", "yamaha fazio"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },

    // Mid Range (1.0jt - 1.2jt)
    { model: "nouvo", aliases: ["yamaha nouvo", "nouvo z", "nouvo elegance"], price: 1200000, note: "Full Body Halus", brand: "yamaha" },
    { model: "vario", aliases: ["honda vario", "vario 110", "vario 125", "vario 150", "vario 160", "honda vario 110", "honda vario 125", "honda vario 150", "honda vario 160"], price: 1000000, note: "Full Body Halus", brand: "honda" },

    // Standard (600k - 800k)
    { model: "beat", aliases: ["honda beat", "beat pop", "beat street", "beat fi"], price: 700000, note: "Full Body Halus", brand: "honda" },
    { model: "mio", aliases: ["yamaha mio", "mio sporty", "mio j", "mio m3", "mio z", "soul gt", "yamaha soul gt"], price: 600000, note: "Full Body Halus", brand: "yamaha" },
    { model: "xeon", aliases: ["yamaha xeon", "xeon rc", "xeon gt"], price: 600000, note: "Full Body Halus", brand: "yamaha" },
    { model: "vega", aliases: ["yamaha vega", "vega r", "vega zr"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "smash", aliases: ["suzuki smash", "smash titan"], price: 800000, note: "Full Body Halus", brand: "suzuki" },
    { model: "x-ride", aliases: ["yamaha x-ride", "xride", "x ride"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "nex", aliases: ["suzuki nex", "nex ii", "nex crossover"], price: 700000, note: "Full Body Halus", brand: "suzuki" },
    { model: "spacy", aliases: ["honda spacy"], price: 700000, note: "Full Body Halus", brand: "honda" },
    { model: "gear", aliases: ["yamaha gear", "gear 125"], price: 700000, note: "Full Body Halus", brand: "yamaha" },
    { model: "freego", aliases: ["yamaha freego"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "skydrive", aliases: ["suzuki skydrive", "sky drive"], price: 800000, note: "Full Body Halus", brand: "suzuki" },
    { model: "spin", aliases: ["suzuki spin", "spin 125"], price: 700000, note: "Full Body Halus", brand: "suzuki" },
    { model: "hayate", aliases: ["suzuki hayate"], price: 800000, note: "Full Body Halus", brand: "suzuki" },

    // Inferred / Others from database
    { model: "supra", aliases: ["honda supra", "supra x", "supra fit"], price: 800000, note: "Full Body Halus", brand: "honda" },
    { model: "blade", aliases: ["honda blade", "blade 110", "blade 125"], price: 800000, note: "Full Body Halus", brand: "honda" },
    { model: "revo", aliases: ["honda revo", "revo absolute"], price: 800000, note: "Full Body Halus", brand: "honda" },
    { model: "jupiter", aliases: ["yamaha jupiter", "jupiter z", "jupiter mx"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "address", aliases: ["suzuki address"], price: 700000, note: "Full Body Halus", brand: "suzuki" },
    { model: "shogun", aliases: ["suzuki shogun"], price: 800000, note: "Full Body Halus", brand: "suzuki" },
    { model: "skywave", aliases: ["suzuki skywave"], price: 800000, note: "Full Body Halus", brand: "suzuki" },

    // ─── BODY 2: Matic Besar & Bebek Super ───
    { model: "vespa", aliases: ["vespa lx", "vespa s", "vespa sprint", "vespa lx 125", "vespa primavera", "vespa gts", "vespa gts 150", "vespa gts 300", "vespa klasik", "vespa px", "vespa excel", "vespa gts super", "vespa sei giorni", "vespa 946"], price: 2500000, note: "Full Body Halus", brand: "vespa" },
    { model: "pcx", aliases: ["honda pcx", "pcx 150", "pcx 160"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "adv", aliases: ["honda adv", "adv 150", "adv 160"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "nmax", aliases: ["yamaha nmax", "n-max", "nmax old", "nmax new"], price: 1200000, note: "Full Body Halus", brand: "yamaha" },
    { model: "satria fu", aliases: ["suzuki satria f150", "satria fu", "satria f", "satria fu 150", "satria 120r", "satria 2 tak", "satria hiu", "satria lumba"], price: 1000000, note: "Full Body Halus", brand: "suzuki" },
    { model: "aerox", aliases: ["yamaha aerox", "aerox 155"], price: 1000000, note: "Full Body Halus", brand: "yamaha" },
    { model: "mx king", aliases: ["yamaha mx king", "mx king 150"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "lexi", aliases: ["yamaha lexi"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "sonic", aliases: ["honda sonic", "sonic 150r"], price: 800000, note: "Full Body Halus", brand: "honda" },

    // Inferred Body 2
    { model: "supra gtr 150", aliases: ["honda supra gtr", "gtr 150"], price: 800000, note: "Full Body Halus (Estimasi Bebek Super)", brand: "honda" },
    { model: "polytron evo", aliases: ["polytron fox", "polytron fox r", "polytron t-rex"], price: 1000000, note: "Full Body Halus (Estimasi)", brand: "ev" },
    { model: "gesits", aliases: ["gesits g1"], price: 1000000, note: "Full Body Halus (Estimasi)", brand: "ev" },
    { model: "alva", aliases: ["alva one", "alva cervo"], price: 1500000, note: "Full Body Halus (Estimasi)", brand: "ev" },
    { model: "united", aliases: ["united t1800"], price: 1200000, note: "Full Body Halus (Estimasi)", brand: "ev" },

    // ─── BODY 3: Sport & Fairing ───
    { model: "rx king", aliases: ["yamaha rx-king", "rx-king", "rx king", "f1zr", "yamaha f1zr", "fizr", "yamaha v80", "v75"], price: 2500000, note: "Full Body Restorasi", brand: "yamaha" },
    { model: "gsx", aliases: ["suzuki gsx", "gsx-r150", "gsxr150", "gsx-s150", "gsxs150", "gsx r150", "gsx s150"], price: 1800000, note: "Full Body Halus", brand: "suzuki" },
    { model: "tiger", aliases: ["honda tiger", "tiger revo", "gl pro", "honda gl pro", "gl max", "honda gl", "honda win", "honda win 100", "cb 100", "cb gelatik", "honda cb"], price: 1800000, note: "Full Body Halus (Termasuk Tangki)", brand: "honda" },
    { model: "thunder", aliases: ["suzuki thunder", "thunder 125"], price: 1800000, note: "Full Body Halus (Termasuk Tangki)", brand: "suzuki" },
    { model: "ninja", aliases: ["kawasaki ninja", "ninja 250", "ninja 250 fi", "ninja karbu", "ninja 250 sl", "ninja rr mono", "ninja mono", "zx-25r", "zx25r", "ninja zx-25r", "ninja 650", "ninja 1000sx", "ninja h2"], price: 1800000, note: "Full Body Halus", brand: "kawasaki" },
    { model: "xsr", aliases: ["yamaha xsr 155", "xsr 155", "yamaha xsr"], price: 1800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "mt", aliases: ["yamaha mt-15", "mt15", "mt-25", "mt25", "yamaha mt-25", "yamaha mt"], price: 1600000, note: "Full Body Halus", brand: "yamaha" },
    { model: "xabre", aliases: ["yamaha xabre"], price: 1600000, note: "Full Body Halus", brand: "yamaha" },
    { model: "cbr", aliases: ["honda cbr", "cbr 150r", "cbr150r", "cbr 150", "cbr 250rr", "cbr250rr"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "vixion", aliases: ["yamaha vixion", "vixion r", "new vixion", "v-ixion"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },
    { model: "r15", aliases: ["yamaha r15", "r15 v3", "r15 v4"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },
    { model: "r25", aliases: ["yamaha r25"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },
    { model: "megapro", aliases: ["honda megapro", "mega pro"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "cb 150", aliases: ["honda cb 150r", "cb150r", "cb150 streetfire", "cb 150", "verza", "honda verza", "cb150 verza"], price: 1300000, note: "Full Body Halus", brand: "honda" },
    { model: "byson", aliases: ["yamaha byson"], price: 1200000, note: "Full Body Halus", brand: "yamaha" },

    // Inferred Body 3 (Big Bikes & Trail)
    { model: "crf", aliases: ["honda crf 150", "crf150l", "crf 250 rally", "crf250"], price: 1300000, note: "Full Body Halus (Estimasi Trail)", brand: "honda" },
    { model: "wr 155", aliases: ["yamaha wr 155", "wr155r"], price: 1300000, note: "Full Body Halus (Estimasi Trail)", brand: "yamaha" },
    { model: "klx", aliases: ["kawasaki klx 150", "klx 250", "d-tracker 150", "dtracker 150", "d-tracker 250", "dtracker 250"], price: 1300000, note: "Full Body Halus (Estimasi Trail)", brand: "kawasaki" },
    { model: "xmax", aliases: ["yamaha xmax", "x-max 250"], price: 1800000, note: "Full Body Halus (Big Matic)", brand: "yamaha" },
    { model: "forza", aliases: ["honda forza", "forza 250", "forza 350"], price: 2000000, note: "Full Body Halus (Big Matic)", brand: "honda" },
    { model: "z series", aliases: ["kawasaki z650", "kawasaki z900", "kawasaki z1000", "z650", "z900", "z1000"], price: 2500000, note: "Full Body Halus (Moge)", brand: "kawasaki" },
    { model: "versys", aliases: ["kawasaki versys 250", "versys-x 250", "versys 650", "versys 1000"], price: 2000000, note: "Full Body Halus (Adventure)", brand: "kawasaki" },
    { model: "benelli", aliases: ["benelli patagonian eagle", "patagonian eagle", "motobi 200", "motobi 152", "leoncino 500", "leoncino 250", "trk 502", "trk 251", "tnt 249s", "benelli 502c", "benelli imperiale 400"], price: 1800000, note: "Full Body Halus (Estimasi)", brand: "benelli" },
    { model: "bmw", aliases: ["bmw g310r", "g310r", "bmw f800r", "f800r", "bmw f700gs", "f700gs", "bmw r ninet", "r ninet"], price: 3000000, note: "Full Body Halus (Moge)", brand: "bmw" },
    { model: "harley", aliases: ["harley davidson street 500", "harley davidson livewire"], price: 3500000, note: "Full Body Halus (Moge)", brand: "harley" },
];

// ─── REPAINT BODI KASAR ───
const repaintBodiKasar = [
    { category: "Small Matic / Bebek", min: 300000, max: 380000, examples: "Beat, Mio, Supra" },
    { category: "Medium Matic", min: 380000, max: 470000, examples: "Scoopy, Vario" },
    { category: "Big Matic", min: 510000, max: 680000, examples: "NMax, PCX, ADV" },
    { category: "Extra Big Matic", min: 765000, max: 1020000, examples: "XMAX, Forza" },
];

// ─── REPAINT VELG ───
const repaintVelg = [
    {
        category: "Velg Rp 250.000",
        min: 250000,
        max: 250000,
        examples: "Scoopy, Genio, Vario, Mio, Beat, Vega, Fino, Nouvo, Smash, Fazzio, X-Ride, Nex, Spacy, Gear125, Freego, Xeon, Skydrive, Spin, Hayate",
        note: "Add-ons: Behel/Arm/Shock/Knalpot +50k, CVT+Logo +100k. Bunglon +50k. Remover +50k."
    },
    {
        category: "Velg Rp 300.000",
        min: 300000,
        max: 300000,
        examples: "NMax, MXKing, Satriafu, PCX, ADV, Aerox, Fizr, Lexi, Jupiter, Vespa, Revo, Sonic, Blade",
        note: "Add-ons: Behel/Shock/Knalpot +50k, Arm +70k, CVT+Logo +100k. Candy +50k, Bunglon +100k. Remover +50k."
    },
    {
        category: "Velg Rp 350.000",
        min: 350000,
        max: 350000,
        examples: "CBR, GSX, Vixion, Byson, Tiger, RXKing, Thunder, XSR, R15, R25, Ninja, CB150, Megapro, MT, Xabre",
        note: "Add-ons: Candy +50k, Bunglon +100k. Remover +100k."
    }
];

// Helper maps untuk Velg (memudahkan tool)
const VELG_PRICE_MAP = {
    // 250k Group
    "scoopy": 250000, "genio": 250000, "vario": 250000, "mio": 250000, "beat": 250000, "vega": 250000, "fino": 250000,
    "nouvo": 250000, "smash": 250000, "fazzio": 250000, "x-ride": 250000, "nex": 250000, "spacy": 250000, "gear": 250000,
    "freego": 250000, "xeon": 250000, "skydrive": 250000, "spin": 250000, "hayate": 250000,

    // 300k Group
    "nmax": 300000, "mx king": 300000, "satria fu": 300000, "satria f150": 300000, "pcx": 300000, "adv": 300000,
    "aerox": 300000, "f1zr": 300000, "fizr": 300000, "lexi": 300000, "jupiter": 300000, "vespa": 300000, "revo": 300000,
    "sonic": 300000, "blade": 300000,

    // 350k Group
    "cbr": 350000, "gsx": 350000, "vixion": 350000, "byson": 350000, "tiger": 350000, "rx king": 350000,
    "thunder": 350000, "xsr": 350000, "r15": 350000, "r25": 350000, "ninja": 350000, "cb 150": 350000,
    "megapro": 350000, "mt": 350000, "xabre": 350000
};

// ─── TAMBAHAN WARNA SPESIAL ───
const warnaSpesial = [
    { type: "Candy Colors", surcharge: 125000 },
    { type: "Stabilo (Fluo)", surcharge: 170000 },
    { type: "Two-Tone / Polish", surcharge: 210000 },
];

// ─── SYARAT & KETENTUAN ───
const syaratKetentuan = [
    "Harga di atas adalah harga untuk Body Halus.",
    "Harga belum termasuk Body Kasar.",
    "Harga belum termasuk Pretelan/Aksesoris.",
    "Harga bisa berubah sesuai kondisi Body/Motor.",
    "Untuk warna Bunglon, Hologram, atau Chrome, harga melalui kesepakatan khusus.",
    "Harga Velg belum termasuk Add-ons (Behel, Arm, Shock, Knalpot, CVT).",
    "Biaya Remover Velg berlaku jika velg bekas cat/berjamur."
];

module.exports = {
    repaintBodiHalus,
    repaintBodiKasar,
    repaintVelg,
    warnaSpesial,
    syaratKetentuan,
    VELG_PRICE_MAP // Opsional: bisa diimport tool jika butuh lookup cepat
};
