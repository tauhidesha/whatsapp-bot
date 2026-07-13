const fs = require('fs');
const repaintPrices = require('./src/data/repaintPrices.js');
const masterLayanan = require('./src/data/masterLayanan.js');
const daftarUkuran = require('./src/data/daftarUkuranMotor.js');

let output = "# KNOWLEDGE BASE BENGKEL BOSMAT\n\n";

output += "## DAFTAR HARGA REPAINT BODI HALUS\n";
repaintPrices.repaintBodiHalus.forEach(item => {
    output += `- Motor: ${item.model.toUpperCase()} (Alias: ${item.aliases.join(', ')})\n`;
    output += `  Harga: Rp ${item.price.toLocaleString('id-ID')}\n`;
    output += `  Note: ${item.note}\n\n`;
});

output += "## DAFTAR HARGA REPAINT BODI KASAR\n";
repaintPrices.repaintBodiKasar.forEach(item => {
    output += `- Kategori: ${item.category}\n`;
    output += `  Harga: Rp ${item.price.toLocaleString('id-ID')}\n`;
    output += `  Contoh Motor: ${item.examples}\n\n`;
});

output += "## DAFTAR HARGA REPAINT VELG\n";
repaintPrices.repaintVelg.forEach(item => {
    output += `- Kategori: ${item.category}\n`;
    output += `  Harga: Rp ${item.price.toLocaleString('id-ID')}\n`;
    output += `  Note: ${item.note}\n\n`;
});

output += "## TAMBAHAN WARNA SPESIAL (REPAINT)\n";
repaintPrices.warnaSpesial.forEach(item => {
    output += `- Tipe Warna: ${item.type} (Alias: ${item.aliases.join(', ')})\n`;
    output += `  Tambahan Biaya: Rp ${item.surcharge.toLocaleString('id-ID')}\n\n`;
});

output += "## SYARAT & KETENTUAN REPAINT\n";
repaintPrices.syaratKetentuan.forEach(item => {
    output += `- ${item}\n`;
});
output += "\n";

output += "## MASTER LAYANAN (DETAILING & COATING)\n";
masterLayanan.forEach(item => {
    output += `### ${item.name}\n`;
    output += `- Ringkasan: ${item.summary}\n`;
    output += `- Deskripsi: ${item.description}\n`;
    if (item.variants) {
        output += `- Varian Harga (Berdasarkan Ukuran Motor S/M/L/XL):\n`;
        item.variants.forEach(v => {
            output += `  - Ukuran ${v.name}: Rp ${v.price.toLocaleString('id-ID')}\n`;
        });
    } else if (item.price > 0) {
        output += `- Harga Dasar: Rp ${item.price.toLocaleString('id-ID')}\n`;
    }
    if (item.note) {
        output += `- Keterangan: ${item.note}\n`;
    }
    output += "\n";
});

output += "## UKURAN MOTOR (Untuk Harga Detailing/Coating)\n";
daftarUkuran.forEach(item => {
    output += `- Motor: ${item.model} | Ukuran Servis: ${item.service_size} | Ukuran Repaint (Jika Beda): ${item.repaint_size}\n`;
});

fs.writeFileSync('meta_ai_knowledge.txt', output);
console.log('Knowledge base generated!');
