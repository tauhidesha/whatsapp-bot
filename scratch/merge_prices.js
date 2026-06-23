const fs = require('fs');

const daftarUkuranMotorStr = fs.readFileSync('src/data/daftarUkuranMotor.ts', 'utf8');
const repaintPricesStr = fs.readFileSync('src/data/repaintPrices.js', 'utf8');

const modelRegex = /"model":\s*"([^"]+)",\n\s*"service_size":\s*"([^"]+)",\n\s*"repaint_size":\s*"([^"]+)",\n\s*"aliases":\s*(\[[^\]]+\])/g;
let match;
const allModels = [];
while ((match = modelRegex.exec(daftarUkuranMotorStr)) !== null) {
  allModels.push({
    model: match[1],
    service_size: match[2],
    repaint_size: match[3],
    aliases: JSON.parse(match[4].replace(/'/g, '"'))
  });
}

// Manually extract existing models from repaintPrices.js string
const existingModels = new Set();
const existingRegex = /\{ model: "([^"]+)",/g;
while ((match = existingRegex.exec(repaintPricesStr)) !== null) {
    existingModels.add(match[1]);
}

// Special cases that group aliases under a general model in repaintPrices.js
// For example, "vespa", "cbr", "ninja"
const groupedModels = {
    "cbr": ["cbr 150r", "cbr 250rr"],
    "ninja": ["ninja 250 karbu", "ninja 250 fi", "ninja 250 sl", "ninja zx-25r"],
    "vespa": ["vespa lx 125", "vespa primavera 150", "vespa sprint 150", "vespa gts 150", "vespa gts super sport 150", "vespa gts 300 super tech", "vespa gtv sei giorni", "vespa elettrica", "vespa 946 snake", "vespa px 150"],
    "cb 100": ["honda cb 100"],
    "c70": ["honda c70"],
    "astrea grand": ["honda astrea grand"],
    "tiger": ["honda tiger", "honda gl pro"],
    "win 100": ["honda win 100"],
    "rx-king": ["yamaha rx-king"],
    "f1zr": ["yamaha f1zr"],
    "satria fu": ["satria f150"]
};

for (const grouped in groupedModels) {
    if (existingModels.has(grouped)) {
        groupedModels[grouped].forEach(m => existingModels.add(m));
    }
}

const missingModels = allModels.filter(m => !existingModels.has(m.model));
console.log(`Missing models: ${missingModels.length}`);
console.log(missingModels.map(m => m.model).join(', '));

// Let's create lines to add them manually
let output = "\n// ─── NEW ADDITIONS ───\n";
for (const m of missingModels) {
    let brand = "unknown";
    if (m.model.includes("honda") || m.aliases.some(a => a.includes("honda"))) brand = "honda";
    else if (m.model.includes("yamaha") || m.aliases.some(a => a.includes("yamaha"))) brand = "yamaha";
    else if (m.model.includes("suzuki") || m.aliases.some(a => a.includes("suzuki"))) brand = "suzuki";
    else if (m.model.includes("kawasaki") || m.aliases.some(a => a.includes("kawasaki"))) brand = "kawasaki";
    else if (m.model.includes("bmw") || m.aliases.some(a => a.includes("bmw"))) brand = "bmw";
    else if (m.model.includes("benelli") || m.aliases.some(a => a.includes("benelli"))) brand = "benelli";
    else if (m.model.includes("kymco") || m.aliases.some(a => a.includes("kymco"))) brand = "kymco";
    else if (m.model.includes("harley") || m.aliases.some(a => a.includes("harley"))) brand = "harley";
    else if (m.model.includes("viar") || m.aliases.some(a => a.includes("viar"))) brand = "viar";
    else if (m.model.includes("zero") || m.aliases.some(a => a.includes("zero"))) brand = "ev";
    else if (m.model.includes("energica") || m.aliases.some(a => a.includes("energica"))) brand = "ev";

    let price = 1500000;
    let note = "Full Body Halus";
    if (m.repaint_size === 'S') price = 800000;
    else if (m.repaint_size === 'M') price = 1000000;
    else if (m.repaint_size === 'L') price = 1800000;
    else if (m.repaint_size === 'XL') price = 2500000;

    output += `    { model: "${m.model}", aliases: ${JSON.stringify(m.aliases)}, price: ${price}, note: "${note}", brand: "${brand}" },\n`;
}

console.log(output);
