// File: src/data/repaintPrices.js
// Data harga repaint spesifik per model motor.
// Source: src/data/daftarHargaRepaint.md (Update Februari 2026)

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
    {
        model: "scoopy", aliases: ["honda scoopy", "scoopy prestige", "scoopy sporty"],
        price: 1500000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "genio", aliases: ["honda genio"],
        price: 1500000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "vario", aliases: ["honda vario", "vario 110", "vario 125", "vario 150", "vario 160", "honda vario 110", "honda vario 125", "honda vario 150", "honda vario 160"],
        price: 1000000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "mio", aliases: ["yamaha mio", "mio sporty", "mio j", "mio m3", "mio z", "soul gt", "yamaha soul gt"],
        price: 600000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "beat", aliases: ["honda beat", "beat pop", "beat street", "beat fi"],
        price: 700000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "vega", aliases: ["yamaha vega", "vega r", "vega zr"],
        price: 800000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "fino", aliases: ["yamaha fino", "fino premium", "fino grande"],
        price: 1500000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "nouvo", aliases: ["yamaha nouvo", "nouvo z", "nouvo elegance"],
        price: 1200000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "smash", aliases: ["suzuki smash", "smash titan"],
        price: 800000, note: "Full Body Halus", brand: "suzuki"
    },
    {
        model: "fazzio", aliases: ["yamaha fazzio", "grand filano", "yamaha grand filano", "filano"],
        price: 1500000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "x-ride", aliases: ["yamaha x-ride", "xride", "x ride"],
        price: 800000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "nex", aliases: ["suzuki nex", "nex ii", "nex crossover"],
        price: 700000, note: "Full Body Halus", brand: "suzuki"
    },
    {
        model: "spacy", aliases: ["honda spacy"],
        price: 700000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "gear", aliases: ["yamaha gear", "gear 125"],
        price: 700000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "freego", aliases: ["yamaha freego"],
        price: 800000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "xeon", aliases: ["yamaha xeon", "xeon rc", "xeon gt"],
        price: 600000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "skydrive", aliases: ["suzuki skydrive", "sky drive"],
        price: 800000, note: "Full Body Halus", brand: "suzuki"
    },
    {
        model: "spin", aliases: ["suzuki spin", "spin 125"],
        price: 700000, note: "Full Body Halus", brand: "suzuki"
    },
    {
        model: "hayate", aliases: ["suzuki hayate"],
        price: 800000, note: "Full Body Halus", brand: "suzuki"
    },

    // ─── BODY 2: Matic Besar & Bebek Super ───
    {
        model: "nmax", aliases: ["yamaha nmax", "n-max", "nmax old", "nmax new"],
        price: 1200000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "mx king", aliases: ["yamaha mx king", "mx king 150"],
        price: 800000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "satria fu", aliases: ["suzuki satria f150", "satria fu", "satria f", "satria fu 150"],
        price: 1000000, note: "Full Body Halus", brand: "suzuki"
    },
    {
        model: "pcx", aliases: ["honda pcx", "pcx 150", "pcx 160"],
        price: 1500000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "adv", aliases: ["honda adv", "adv 150", "adv 160"],
        price: 1500000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "aerox", aliases: ["yamaha aerox", "aerox 155"],
        price: 1000000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "lexi", aliases: ["yamaha lexi"],
        price: 800000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "jupiter", aliases: ["yamaha jupiter", "jupiter z", "jupiter mx"],
        price: 800000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "vespa", aliases: ["vespa lx", "vespa s", "vespa sprint", "vespa lx 125", "vespa primavera", "vespa gts", "vespa gts 150", "vespa gts 300", "vespa klasik", "vespa px", "vespa excel"],
        price: 2500000, note: "Full Body Halus", brand: "vespa"
    },
    {
        model: "revo", aliases: ["honda revo"],
        price: 800000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "sonic", aliases: ["honda sonic", "sonic 150r"],
        price: 800000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "blade", aliases: ["honda blade", "blade 110", "blade 125"],
        price: 800000, note: "Full Body Halus", brand: "honda"
    },

    // ─── BODY 3: Sport & Fairing ───
    {
        model: "cbr", aliases: ["honda cbr", "cbr 150r", "cbr150r", "cbr 150", "cbr 250rr", "cbr250rr"],
        price: 1500000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "gsx", aliases: ["suzuki gsx", "gsx-r150", "gsxr150", "gsx-s150", "gsxs150", "gsx r150", "gsx s150"],
        price: 1800000, note: "Full Body Halus", brand: "suzuki"
    },
    {
        model: "vixion", aliases: ["yamaha vixion", "vixion r", "new vixion"],
        price: 1500000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "byson", aliases: ["yamaha byson"],
        price: 1200000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "tiger", aliases: ["honda tiger", "tiger revo", "gl pro", "honda gl pro", "gl max"],
        price: 1800000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "xabre", aliases: ["yamaha xabre"],
        price: 1600000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "thunder", aliases: ["suzuki thunder", "thunder 125"],
        price: 1800000, note: "Full Body Halus", brand: "suzuki"
    },
    {
        model: "mt", aliases: ["yamaha mt-15", "mt15", "mt-25", "mt25", "yamaha mt-25", "yamaha mt"],
        price: 1600000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "r15", aliases: ["yamaha r15", "r15 v3", "r15 v4"],
        price: 1500000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "r25", aliases: ["yamaha r25"],
        price: 1500000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "ninja", aliases: ["kawasaki ninja", "ninja 250", "ninja 250 fi", "ninja karbu", "ninja 250 sl", "ninja rr mono", "ninja mono", "zx-25r", "zx25r", "ninja zx-25r"],
        price: 1800000, note: "Full Body Halus", brand: "kawasaki"
    },
    {
        model: "cb 150", aliases: ["honda cb 150r", "cb150r", "cb150 streetfire", "cb 150", "honda cb", "verza", "honda verza"],
        price: 1300000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "megapro", aliases: ["honda megapro", "mega pro"],
        price: 1500000, note: "Full Body Halus", brand: "honda"
    },
    {
        model: "xsr", aliases: ["yamaha xsr 155", "xsr 155", "yamaha xsr"],
        price: 1800000, note: "Full Body Halus", brand: "yamaha"
    },
    {
        model: "rx king", aliases: ["yamaha rx-king", "rx-king", "rx king", "f1zr", "yamaha f1zr", "fizr"],
        price: 2500000, note: "Full Body Restorasi", brand: "yamaha"
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
    "Harga di atas adalah harga untuk Body Halus.",
    "Harga belum termasuk Body Kasar.",
    "Harga belum termasuk Pretelan/Aksesoris.",
    "Harga bisa berubah sesuai kondisi Body/Motor.",
    "Untuk warna Bunglon, Hologram, atau Chrome, harga melalui kesepakatan khusus.",
];

module.exports = {
    repaintBodiHalus,
    repaintBodiKasar,
    repaintVelg,
    warnaSpesial,
    syaratKetentuan,
};
