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
    { model: "scoopy", aliases: ["honda scoopy", "scoopy prestige", "scoopy sporty", "scoopy stylish", "scoopy fi", "scoopy injection"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "genio", aliases: ["honda genio"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "fino", aliases: ["yamaha fino"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },
    { model: "fazzio", aliases: ["yamaha fazzio", "fazio", "grand filano", "filano"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },
    { model: "nouvo", aliases: ["yamaha nouvo", "nouvo z", "nouvo elegance"], price: 1200000, note: "Full Body Halus", brand: "yamaha" },
    { model: "vario", aliases: ["honda vario", "vario 125", "vario 150", "vario 160"], price: 1000000, note: "Full Body Halus", brand: "honda" },
    { model: "mio", aliases: ["yamaha mio", "mio sporty", "mio j", "mio m3"], price: 600000, note: "Full Body Halus", brand: "yamaha" },
    { model: "xeon", aliases: ["yamaha xeon", "xeon rc", "xeon gt"], price: 600000, note: "Full Body Halus", brand: "yamaha" },
    { model: "beat", aliases: ["honda beat", "beat pop", "beat street"], price: 700000, note: "Full Body Halus", brand: "honda" },
    { model: "nex", aliases: ["suzuki nex", "nex ii"], price: 700000, note: "Full Body Halus", brand: "suzuki" },
    { model: "spacy", aliases: ["honda spacy"], price: 700000, note: "Full Body Halus", brand: "honda" },
    { model: "gear", aliases: ["yamaha gear", "gear 125"], price: 700000, note: "Full Body Halus", brand: "yamaha" },
    { model: "spin", aliases: ["suzuki spin", "spin 125"], price: 700000, note: "Full Body Halus", brand: "suzuki" },
    { model: "vega", aliases: ["yamaha vega", "vega r", "vega zr"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "smash", aliases: ["suzuki smash"], price: 800000, note: "Full Body Halus", brand: "suzuki" },
    { model: "x-ride", aliases: ["yamaha x-ride", "xride"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "freego", aliases: ["yamaha freego"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "skydrive", aliases: ["suzuki skydrive"], price: 800000, note: "Full Body Halus", brand: "suzuki" },
    { model: "hayate", aliases: ["suzuki hayate"], price: 800000, note: "Full Body Halus", brand: "suzuki" },
    { model: "supra", aliases: ["honda supra", "supra x", "supra fit"], price: 800000, note: "Full Body Halus", brand: "honda" },
    { model: "revo", aliases: ["honda revo", "revo absolute"], price: 800000, note: "Full Body Halus", brand: "honda" },
    { model: "blade", aliases: ["honda blade"], price: 800000, note: "Full Body Halus", brand: "honda" },
    { model: "address", aliases: ["suzuki address"], price: 700000, note: "Full Body Halus", brand: "suzuki" },
    { model: "shogun", aliases: ["suzuki shogun"], price: 800000, note: "Full Body Halus", brand: "suzuki" },
    { model: "skywave", aliases: ["suzuki skywave"], price: 800000, note: "Full Body Halus", brand: "suzuki" },
    { model: "polytron evo", aliases: ["polytron fox"], price: 850000, note: "Full Body Halus", brand: "ev" },
    { model: "selis e-max", aliases: ["selis emax"], price: 850000, note: "Full Body Halus", brand: "ev" },
    { model: "smoot tempur", aliases: ["smoot"], price: 850000, note: "Full Body Halus", brand: "ev" },
    { model: "jupiter z", aliases: ["yamaha jupiter z", "jupiter"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "soul gt", aliases: ["yamaha soul gt"], price: 700000, note: "Full Body Halus", brand: "yamaha" },

    // ─── BODY 2: Matic Besar & Bebek Super ───
    { model: "nmax", aliases: ["yamaha nmax", "n-max"], price: 1200000, note: "Full Body Halus", brand: "yamaha" },
    { model: "pcx", aliases: ["honda pcx", "pcx 150", "pcx 160"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "adv", aliases: ["honda adv", "adv 150", "adv 160"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "aerox", aliases: ["yamaha aerox"], price: 1000000, note: "Full Body Halus", brand: "yamaha" },
    { model: "satria fu", aliases: ["suzuki satria f150", "satria f"], price: 1000000, note: "Full Body Halus", brand: "suzuki" },
    { model: "mx king", aliases: ["yamaha mx king", "mx king 150"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "lexi", aliases: ["yamaha lexi"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "jupiter mx", aliases: ["yamaha jupiter mx", "mx 135"], price: 800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "vespa", aliases: ["vespa lx", "vespa s", "vespa sprint", "vespa primavera", "vespa gts", "vespa klasik", "vespa px"], price: 2500000, note: "Full Body Halus", brand: "vespa" },
    { model: "sonic", aliases: ["honda sonic", "sonic 150r"], price: 800000, note: "Full Body Halus", brand: "honda" },
    { model: "supra gtr 150", aliases: ["honda supra gtr", "gtr 150"], price: 800000, note: "Full Body Halus", brand: "honda" },
    { model: "gesits", aliases: ["gesits g1"], price: 1020000, note: "Full Body Halus", brand: "ev" },
    { model: "alva one", aliases: ["alva"], price: 1275000, note: "Full Body Halus", brand: "ev" },
    { model: "alva cervo", aliases: [], price: 1275000, note: "Full Body Halus", brand: "ev" },
    { model: "united t1800", aliases: ["united"], price: 1360000, note: "Full Body Halus", brand: "ev" },
    { model: "polytron t-rex", aliases: ["polytron fox r"], price: 1275000, note: "Full Body Halus", brand: "ev" },
    { model: "viar e-cross", aliases: ["viar ecross"], price: 1100000, note: "Full Body Halus", brand: "ev" },
    { model: "w175", aliases: ["kawasaki w175"], price: 1100000, note: "Full Body Halus", brand: "kawasaki" },

    // ─── BODY 3: Sport & Fairing ───
    { model: "cbr", aliases: ["honda cbr", "cbr 150r", "cbr150r", "cbr 250rr", "cbr250rr"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "vixion", aliases: ["yamaha vixion", "v-ixion"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },
    { model: "r15", aliases: ["yamaha r15"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },
    { model: "r25", aliases: ["yamaha r25"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },
    { model: "mt-15", aliases: ["yamaha mt-15", "mt15"], price: 1600000, note: "Full Body Halus", brand: "yamaha" },
    { model: "mt-25", aliases: ["yamaha mt-25", "mt25"], price: 1600000, note: "Full Body Halus", brand: "yamaha" },
    { model: "xabre", aliases: ["yamaha xabre"], price: 1600000, note: "Full Body Halus", brand: "yamaha" },
    { model: "gsx-r150", aliases: ["suzuki gsx-r150", "gsxr150"], price: 1800000, note: "Full Body Halus", brand: "suzuki" },
    { model: "gsx-s150", aliases: ["suzuki gsx-s150", "gsxs150"], price: 1800000, note: "Full Body Halus", brand: "suzuki" },
    { model: "ninja", aliases: ["kawasaki ninja", "ninja 250", "ninja fi", "ninja karbu", "ninja 250 sl", "ninja rr mono", "zx25r"], price: 1800000, note: "Full Body Halus", brand: "kawasaki" },
    { model: "tiger", aliases: ["honda tiger", "tiger revo", "gl pro", "gl max"], price: 1800000, note: "Full Body Halus (Termasuk Tangki)", brand: "honda" },
    { model: "thunder 125", aliases: ["suzuki thunder"], price: 1800000, note: "Full Body Halus (Termasuk Tangki)", brand: "suzuki" },
    { model: "xsr 155", aliases: ["yamaha xsr"], price: 1800000, note: "Full Body Halus", brand: "yamaha" },
    { model: "cb 150r", aliases: ["honda cb 150r", "cb150r", "cb150 streetfire"], price: 1300000, note: "Full Body Halus", brand: "honda" },
    { model: "verza", aliases: ["honda verza", "cb150 verza"], price: 1300000, note: "Full Body Halus", brand: "honda" },
    { model: "megapro", aliases: ["honda megapro", "mega pro"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "byson", aliases: ["yamaha byson"], price: 1200000, note: "Full Body Halus", brand: "yamaha" },
    { model: "rx-king", aliases: ["yamaha rx-king", "rx king"], price: 2500000, note: "Full Body Restorasi", brand: "yamaha" },
    { model: "f1zr", aliases: ["fizr", "yamaha f1zr"], price: 2125000, note: "Full Body Restorasi", brand: "yamaha" },
    { model: "c70", aliases: ["honda pitung", "bekjul"], price: 1700000, note: "Restorasi Klasik", brand: "honda" },
    { model: "cb 100", aliases: ["cb gelatik", "honda cb"], price: 1700000, note: "Restorasi Klasik", brand: "honda" },
    { model: "astrea grand", aliases: ["honda grand", "bulus"], price: 1000000, note: "Restorasi Bodi", brand: "honda" },
    { model: "win 100", aliases: ["honda win"], price: 1500000, note: "Restorasi Bodi", brand: "honda" },

    // ─── MOGE & OTHERS ───
    { model: "ninja 650", aliases: ["kawasaki ninja 650"], price: 2500000, note: "Full Body Halus (Moge)", brand: "kawasaki" },
    { model: "z650", aliases: ["kawasaki z650"], price: 2500000, note: "Full Body Halus (Moge)", brand: "kawasaki" },
    { model: "z900", aliases: ["kawasaki z900"], price: 3000000, note: "Full Body Halus (Moge)", brand: "kawasaki" },
    { model: "z1000", aliases: ["kawasaki z1000"], price: 3500000, note: "Full Body Halus (Moge)", brand: "kawasaki" },
    { model: "harley street 500", aliases: ["harley davidson"], price: 3500000, note: "Full Body Halus (Moge)", brand: "harley" },
    { model: "bmw g310r", aliases: ["g310r"], price: 3000000, note: "Full Body Halus (Moge)", brand: "bmw" },
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
    { category: "Matic Kecil / Bebek", min: 250000, max: 250000, note: "Ring 14 / 17 (Scoopy, Beat, Vario, dll)" },
    { category: "Big Matic / Super Bebek", min: 300000, max: 300000, note: "Velg Lebar (NMax, PCX, Aerox, Satria FU, MX King)" },
    { category: "Sport 150cc - 250cc", min: 350000, max: 350000, note: "Velg Lebar (CBR, Ninja, GSX, Vixion)" },
];

// Helper maps untuk Velg (memasukkan data fix dari user)
const VELG_PRICE_MAP = {
    // 250k tier
    "scoopy": 250000, "genio": 250000, "vario": 250000, "mio": 250000, "beat": 250000, "vega": 250000, "fino": 250000,
    "nouvo": 250000, "smash": 250000, "fazzio": 250000, "x-ride": 250000, "nex": 250000, "spacy": 250000, "gear": 250000,
    "freego": 250000, "xeon": 250000, "skydrive": 250000, "spin": 250000, "hayate": 250000,
    // 300k tier
    "nmax": 300000, "mx king": 300000, "satria fu": 300000, "pcx": 300000, "adv": 300000, "aerox": 300000, "fizr": 300000,
    "lexi": 300000, "jupiter": 300000, "vespa": 300000, "revo": 300000, "sonic": 300000, "blade": 300000,
    // 350k tier
    "cbr": 350000, "gsx": 350000, "vixion": 350000, "byson": 350000, "tiger": 350000, "rx king": 350000, "thunder": 350000,
    "xsr": 350000, "r15": 350000, "r25": 350000, "ninja": 350000, "cb 150": 350000, "megapro": 350000, "mt": 350000, "xabre": 350000
};

// ─── TAMBAHAN WARNA SPESIAL ───
const warnaSpesial = [
    { type: "Candy Colors", surcharge: 125000 },
    { type: "Stabilo (Fluo)", surcharge: 170000 },
    { type: "Two-Tone / Polish", surcharge: 210000 },
];

// ─── SYARAT & KETENTUAN ───
const syaratKetentuan = [
    "Harga di atas adalah harga FIX untuk Body Halus.",
    "Harga belum termasuk Body Kasar.",
    "Harga belum termasuk Pretelan/Aksesoris.",
    "Harga bisa berubah sesuai kondisi Body/Motor (lecet parah/pecah).",
    "Untuk warna Bunglon, Hologram, atau Chrome, harga melalui kesepakatan khusus.",
    "Harga Velg belum termasuk tambahan CAT Behel/Arm/Shock (+50rb) atau CVT (+100rb).",
    "Biaya Remover Velg (bekas cat/jamur) +50rb s/d 100rb.",
];

module.exports = {
    repaintBodiHalus,
    repaintBodiKasar,
    repaintVelg,
    warnaSpesial,
    syaratKetentuan,
    VELG_PRICE_MAP,
};
