// File: src/data/repaintPrices.js
// Data harga repaint spesifik per model motor.
// Source: src/data/daftarHargaRepaint.md (Update Februari 2026, Diskon 15%)

/**
 * Struktur:
 *   aliases   – array keyword agar fuzzy-match lebih mudah
 *   price     – harga tetap (number) ATAU null jika range
 *   min / max – range harga (jika bervariasi tergantung tahun/dimensi)
 *   note      – keterangan tambahan
 *   category  – sub-kategori repaint (bodi_halus | bodi_kasar | velg | warna_spesial)
 *   brand     – brand motor
 */

const repaintBodiHalus = [
    // ─── HONDA: Matic & Bebek ───
    {
        model: "beat", aliases: ["honda beat", "beat pop", "beat street", "spacy", "nex", "genio", "honda genio", "honda spacy"],
        min: 600000, max: 1250000, note: "Tergantung tahun/dimensi", brand: "honda"
    },
    {
        model: "scoopy", aliases: ["honda scoopy", "scoopy prestige", "scoopy sporty"],
        price: 1275000, note: "Full body halus", brand: "honda"
    },
    {
        model: "vario 110", aliases: ["honda vario 110"],
        price: 850000, note: "Full body halus", brand: "honda"
    },
    {
        model: "vario 125", aliases: ["honda vario 125", "honda vario 150", "vario 150"],
        price: 950000, note: "Full body halus", brand: "honda"
    },
    {
        model: "vario 160", aliases: ["honda vario 160"],
        price: 1275000, note: "Full body halus", brand: "honda"
    },
    {
        model: "pcx", aliases: ["honda pcx", "pcx 150", "pcx 160"],
        price: 1275000, note: "Full body halus", brand: "honda"
    },
    {
        model: "adv", aliases: ["honda adv", "adv 150", "adv 160"],
        price: 1275000, note: "Full body halus", brand: "honda"
    },
    {
        model: "revo", aliases: ["honda revo", "blade", "honda blade", "supra x 125", "supra x"],
        price: 680000, note: "Bebek Standard", brand: "honda"
    },
    {
        model: "supra gtr 150", aliases: ["honda supra gtr", "gtr 150"],
        price: 765000, note: "Bebek Super", brand: "honda"
    },
    {
        model: "forza", aliases: ["honda forza", "forza 250", "forza 350"],
        price: 1870000, note: "Big Matic", brand: "honda"
    },

    // ─── HONDA: Sport & Classic ───
    {
        model: "cbr 150r", aliases: ["honda cbr 150r", "cbr150r", "cbr 150"],
        price: 1275000, note: "Full Fairing", brand: "honda"
    },
    {
        model: "cb 150r", aliases: ["honda cb 150r", "cb150r", "verza", "honda verza", "cb150 streetfire"],
        price: 1100000, note: "Naked Sport", brand: "honda"
    },
    {
        model: "cbr 250rr", aliases: ["honda cbr 250rr", "cbr250rr"],
        price: 1700000, note: "Full Fairing", brand: "honda"
    },
    {
        model: "cb150x", aliases: ["honda cb150x", "cb500x", "honda cb500x"],
        min: 1500000, max: 2100000, note: "Adventure Style", brand: "honda"
    },
    {
        model: "crf 150", aliases: ["honda crf 150", "crf150l", "crf 250 rally", "honda crf 250 rally"],
        min: 1000000, max: 1500000, note: "Trail", brand: "honda"
    },
    {
        model: "astrea grand", aliases: ["honda astrea grand", "honda grand", "win 100", "honda win 100", "honda win"],
        price: 1000000, note: "Restorasi Bodi", brand: "honda"
    },
    {
        model: "c70", aliases: ["honda c70", "honda pitung", "bekjul"],
        min: 1275000, max: 1700000, note: "Monokok / Klasik", brand: "honda"
    },
    {
        model: "cb 100", aliases: ["honda cb 100", "cb gelatik", "honda cb"],
        min: 1275000, max: 1700000, note: "Monokok / Klasik", brand: "honda"
    },
    {
        model: "tiger", aliases: ["honda tiger", "tiger revo", "gl pro", "honda gl pro", "gl max"],
        price: 1500000, note: "Termasuk Tangki", brand: "honda"
    },

    // ─── YAMAHA: Matic & Bebek ───
    {
        model: "mio", aliases: ["yamaha mio", "mio sporty", "mio j", "mio m3", "soul gt", "yamaha soul gt"],
        min: 500000, max: 680000, note: "Matic Kecil", brand: "yamaha"
    },
    {
        model: "fazzio", aliases: ["yamaha fazzio", "grand filano", "yamaha grand filano", "filano"],
        price: 1275000, note: "Retro Modern", brand: "yamaha"
    },
    {
        model: "nmax", aliases: ["yamaha nmax", "n-max", "nmax old", "nmax new"],
        price: 1020000, note: "Full body halus", brand: "yamaha"
    },
    {
        model: "aerox", aliases: ["yamaha aerox", "aerox 155"],
        price: 850000, note: "Full body halus", brand: "yamaha"
    },
    {
        model: "lexi", aliases: ["yamaha lexi", "freego", "yamaha freego", "x-ride", "yamaha x-ride"],
        price: 680000, note: "Matic Medium", brand: "yamaha"
    },
    {
        model: "xmax", aliases: ["yamaha xmax", "x-max 250", "xmax 250"],
        price: 1700000, note: "Big Matic", brand: "yamaha"
    },
    {
        model: "jupiter z", aliases: ["yamaha jupiter z", "jupiter", "mx", "yamaha mx", "vega", "yamaha vega"],
        price: 680000, note: "Bebek Standard", brand: "yamaha"
    },
    {
        model: "mx king", aliases: ["yamaha mx king", "mx king 150"],
        price: 680000, note: "Bebek Super", brand: "yamaha"
    },

    // ─── YAMAHA: Sport & 2-Tak ───
    {
        model: "vixion", aliases: ["yamaha vixion", "byson", "yamaha byson", "mt-15", "yamaha mt-15", "mt15"],
        min: 1000000, max: 1275000, note: "Naked Sport", brand: "yamaha"
    },
    {
        model: "r15", aliases: ["yamaha r15", "r15 v3", "r15 v4"],
        price: 1275000, note: "Full Fairing", brand: "yamaha"
    },
    {
        model: "r25", aliases: ["yamaha r25", "mt-25", "yamaha mt-25", "mt25"],
        min: 1500000, max: 1700000, note: "250cc Series", brand: "yamaha"
    },
    {
        model: "scorpio", aliases: ["yamaha scorpio", "xsr 155", "yamaha xsr 155"],
        price: 1500000, note: "Sport / Heritage", brand: "yamaha"
    },
    {
        model: "rx king", aliases: ["yamaha rx-king", "rx-king", "rx king", "f1zr", "yamaha f1zr", "fizr"],
        price: 2125000, note: "Restorasi Full Body", brand: "yamaha"
    },

    // ─── KAWASAKI, SUZUKI & VESPA ───
    {
        model: "ninja 250 fi", aliases: ["kawasaki ninja 250 fi", "ninja fi", "ninja 250", "ninja 250 karbu", "ninja karbu"],
        price: 1700000, note: "Fairing", brand: "kawasaki"
    },
    {
        model: "ninja 250 sl", aliases: ["kawasaki ninja 250 sl", "ninja rr mono", "ninja mono"],
        price: 1360000, note: "Fairing Ramping", brand: "kawasaki"
    },
    {
        model: "zx-25r", aliases: ["kawasaki zx-25r", "zx25r", "ninja zx-25r"],
        price: 1950000, note: "4 Cylinder", brand: "kawasaki"
    },
    {
        model: "satria fu", aliases: ["suzuki satria f150", "satria fu", "satria f", "satria fu 150"],
        price: 850000, note: "Ayago", brand: "suzuki"
    },
    {
        model: "gsx-r150", aliases: ["suzuki gsx-r150", "gsxr150", "gsx-s150", "suzuki gsx-s150", "gsxs150"],
        price: 1275000, note: "Sport 150cc", brand: "suzuki"
    },
    {
        model: "vespa lx", aliases: ["vespa lx", "vespa s", "vespa sprint", "vespa lx 125", "vespa primavera"],
        price: 2125000, note: "Bodi Besi (Small)", brand: "vespa"
    },
    {
        model: "vespa gts", aliases: ["vespa gts 150", "vespa gts 300", "vespa gts super"],
        price: 2550000, note: "Bodi Besi (Big)", brand: "vespa"
    },
    {
        model: "vespa klasik", aliases: ["vespa px", "vespa klasik", "vespa excel", "vespa px 150"],
        price: 2550000, note: "Kerok Total / Restorasi", brand: "vespa"
    },

    // ─── MOTOR LISTRIK (EV) ───
    {
        model: "polytron evo", aliases: ["polytron fox", "selis", "selis e-max"],
        price: 850000, note: "Setara Vario", brand: "ev"
    },
    {
        model: "alva one", aliases: ["alva", "alva cervo"],
        price: 1275000, note: "Setara NMax/PCX", brand: "ev"
    },
    {
        model: "united t1800", aliases: ["united"],
        price: 1360000, note: "Big Matic EV", brand: "ev"
    },
    {
        model: "gesits", aliases: ["gesits g1"],
        price: 1020000, note: "Matic Medium EV", brand: "ev"
    },
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
    { category: "Matic Kecil / Bebek", min: 300000, max: 380000, note: "Ring 14 / 17" },
    { category: "Big Matic", min: 425000, max: 550000, note: "NMax, Aerox, PCX" },
    { category: "Sport 150cc - 250cc", min: 510000, max: 720000, note: "Velg Lebar" },
    { category: "Moge (500cc Up)", min: 850000, max: null, note: "Perlu Konfirmasi" },
];

// ─── TAMBAHAN WARNA SPESIAL ───
const warnaSpesial = [
    { type: "Candy Colors", surcharge: 125000 },
    { type: "Stabilo (Fluo)", surcharge: 170000 },
    { type: "Two-Tone / Polish", surcharge: 210000 },
];

// ─── SYARAT & KETENTUAN ───
const syaratKetentuan = [
    "Harga di atas adalah estimasi bodi halus/part terkait.",
    "Kerusakan bodi (pecah, retak parah, penyok) dikenakan biaya Jasa Repair/Dempul tambahan.",
    "Proses pengerjaan bodi kasar sudah termasuk pemberian Plastic Primer agar cat tahan lama.",
    "Harga velg sudah termasuk jasa bongkar pasang ban.",
    "Untuk warna Bunglon, Hologram, atau Chrome, harga melalui kesepakatan khusus.",
];

module.exports = {
    repaintBodiHalus,
    repaintBodiKasar,
    repaintVelg,
    warnaSpesial,
    syaratKetentuan,
};
