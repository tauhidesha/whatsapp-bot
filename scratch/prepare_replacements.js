const fs = require('fs');
let fileStr = fs.readFileSync('src/data/repaintPrices.js', 'utf8');

const newMoge = `
    // ─── NEW ADDITIONS (MOGE / TRAIL / CLASSIC / OTHERS) ───
    { model: "vario", aliases: ["honda vario", "vario 125", "vario 150", "vario 160"], price: 1200000, note: "Full Body Halus", brand: "honda" },
    { model: "grand filano", aliases: ["yamaha grand filano", "filano"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },
    { model: "viar cross x 200", aliases: ["viar cross x"], price: 1500000, note: "Full Body Halus", brand: "viar" },
    { model: "crf 150", aliases: ["honda crf 150", "crf150l"], price: 1500000, note: "Full Body Halus", brand: "honda" },
    { model: "crf 250 rally", aliases: ["honda crf 250 rally", "crf250"], price: 1800000, note: "Full Body Halus", brand: "honda" },
    { model: "xmax", aliases: ["yamaha xmax", "x-max 250"], price: 2000000, note: "Full Body Halus", brand: "yamaha" },
    { model: "wr 155", aliases: ["yamaha wr 155", "wr155r"], price: 1500000, note: "Full Body Halus", brand: "yamaha" },
    { model: "klx 150", aliases: ["kawasaki klx 150"], price: 1500000, note: "Full Body Halus", brand: "kawasaki" },
    { model: "klx 250", aliases: ["kawasaki klx 250"], price: 1800000, note: "Full Body Halus", brand: "kawasaki" },
    { model: "d-tracker 150", aliases: ["kawasaki d-tracker 150", "dtracker 150"], price: 1500000, note: "Full Body Halus", brand: "kawasaki" },
    { model: "d-tracker 250", aliases: ["kawasaki d-tracker 250", "dtracker 250"], price: 1800000, note: "Full Body Halus", brand: "kawasaki" },
    { model: "versys 250", aliases: ["kawasaki versys 250", "versys-x 250"], price: 1800000, note: "Full Body Halus", brand: "kawasaki" },
    { model: "downtown 250i", aliases: ["kymco downtown 250i"], price: 2000000, note: "Full Body Halus", brand: "kymco" },
    { model: "x-town 250i", aliases: ["kymco x-town 250i"], price: 2000000, note: "Full Body Halus", brand: "kymco" },
    { model: "zero fx", aliases: ["zero"], price: 1800000, note: "Full Body Halus", brand: "ev" },
    { model: "ninja 1000sx", aliases: ["kawasaki ninja 1000sx"], price: 3500000, note: "Full Body Halus (Moge)", brand: "kawasaki" },
    { model: "ninja h2", aliases: ["kawasaki ninja h2"], price: 4000000, note: "Full Body Halus (Moge)", brand: "kawasaki" },
    { model: "versys 650", aliases: ["kawasaki versys 650"], price: 3000000, note: "Full Body Halus (Moge)", brand: "kawasaki" },
    { model: "versys 1000", aliases: ["kawasaki versys 1000"], price: 3500000, note: "Full Body Halus (Moge)", brand: "kawasaki" },
    { model: "kymco ak550", aliases: ["ak550"], price: 3000000, note: "Full Body Halus (Moge)", brand: "kymco" },
    { model: "harley livewire", aliases: ["harley davidson livewire"], price: 4000000, note: "Full Body Halus (Moge)", brand: "harley" },
    { model: "bmw f800r", aliases: ["f800r"], price: 3500000, note: "Full Body Halus (Moge)", brand: "bmw" },
    { model: "bmw f700gs", aliases: ["f700gs"], price: 3500000, note: "Full Body Halus (Moge)", brand: "bmw" },
    { model: "bmw r ninet", aliases: ["r ninet"], price: 4000000, note: "Full Body Halus (Moge)", brand: "bmw" },
    { model: "patagonian eagle 250", aliases: ["benelli patagonian eagle", "patagonian eagle"], price: 1800000, note: "Full Body Halus", brand: "benelli" },
    { model: "motobi 200 evo", aliases: ["benelli motobi 200", "motobi 200"], price: 1500000, note: "Full Body Halus", brand: "benelli" },
    { model: "motobi 152", aliases: ["benelli motobi 152", "motobi 152"], price: 1500000, note: "Full Body Halus", brand: "benelli" },
    { model: "leoncino 500", aliases: ["benelli leoncino 500", "leoncino"], price: 2500000, note: "Full Body Halus (Moge)", brand: "benelli" },
    { model: "leoncino 250", aliases: ["benelli leoncino 250"], price: 1800000, note: "Full Body Halus", brand: "benelli" },
    { model: "trk 502x", aliases: ["benelli trk 502", "trk 502"], price: 3000000, note: "Full Body Halus (Moge)", brand: "benelli" },
    { model: "trk 251", aliases: ["benelli trk 251"], price: 1800000, note: "Full Body Halus", brand: "benelli" },
    { model: "tnt 249s", aliases: ["benelli tnt 249s", "tnt 250"], price: 1800000, note: "Full Body Halus", brand: "benelli" },
    { model: "502c", aliases: ["benelli 502c"], price: 2500000, note: "Full Body Halus (Moge)", brand: "benelli" },
    { model: "imperiale 400", aliases: ["benelli imperiale 400"], price: 2000000, note: "Full Body Halus", brand: "benelli" },
    { model: "yamaha v80", aliases: ["yamaha v75", "bebek v80"], price: 1700000, note: "Restorasi Klasik", brand: "yamaha" },
    { model: "suzuki satria 120r", aliases: ["satria 2 tak", "satria hiu", "satria lumba"], price: 2125000, note: "Full Body Restorasi", brand: "suzuki" },
    { model: "suzuki ts 125", aliases: ["suzuki ts", "ts 125"], price: 2500000, note: "Restorasi Bodi", brand: "suzuki" },
    { model: "kawasaki binter merzy", aliases: ["binter merzy", "kz200"], price: 2500000, note: "Restorasi Bodi", brand: "kawasaki" },
];`;

const originalBodyArr = `    { model: "bmw g310r", aliases: ["g310r"], price: 3000000, note: "Full Body Halus (Moge)", brand: "bmw" },
];`;

fileStr = fileStr.replace(originalBodyArr, `    { model: "bmw g310r", aliases: ["g310r"], price: 3000000, note: "Full Body Halus (Moge)", brand: "bmw" },${newMoge}`);

const velgNew = `    // 500k tier (Moge/Trail)
    "xmax": 500000, "crf 150": 500000, "crf 250 rally": 500000, "wr 155": 500000,
    "klx 150": 500000, "klx 250": 500000, "d-tracker 150": 500000, "d-tracker 250": 500000,
    "versys 250": 500000, "downtown 250i": 500000, "x-town 250i": 500000, "zero fx": 500000,
    "ninja 1000sx": 500000, "ninja h2": 500000, "versys 650": 500000, "versys 1000": 500000,
    "kymco ak550": 500000, "harley livewire": 500000, "bmw f800r": 500000, "bmw f700gs": 500000,
    "bmw r ninet": 500000, "patagonian eagle 250": 500000, "motobi 200 evo": 500000,
    "motobi 152": 500000, "leoncino 500": 500000, "leoncino 250": 500000, "trk 502x": 500000,
    "trk 251": 500000, "tnt 249s": 500000, "502c": 500000, "imperiale 400": 500000,
    "yamaha v80": 350000, "suzuki satria 120r": 400000, "suzuki ts 125": 500000, "kawasaki binter merzy": 500000,
    "grand filano": 350000, "viar cross x 200": 500000
};`;

const originalVelgMap = `    "xsr": 450000, "r15": 450000, "r25": 450000, "ninja": 450000, "cb 150": 450000, "megapro": 450000, "mt": 450000, "xabre": 450000\n};`;
fileStr = fileStr.replace(originalVelgMap, `    "xsr": 450000, "r15": 450000, "r25": 450000, "ninja": 450000, "cb 150": 450000, "megapro": 450000, "mt": 450000, "xabre": 450000,\n${velgNew}`);

const originalVelgArray = `    { category: "Sport 150cc - 250cc", price: 450000, note: "Velg Lebar (CBR, Ninja, GSX, Vixion)" },
];`;

fileStr = fileStr.replace(originalVelgArray, `    { category: "Sport 150cc - 250cc", price: 450000, note: "Velg Lebar (CBR, Ninja, GSX, Vixion)" },
    { category: "Moge / Trail 250cc+", price: 500000, note: "Velg Super Lebar / Jari-jari (XMAX, CRF, KLX, Versys, Moge)" },
];`);

fs.writeFileSync('src/data/repaintPrices.js', fileStr);
console.log('Update done in memory and written to src/data/repaintPrices.js');
