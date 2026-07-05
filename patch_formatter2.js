const fs = require('fs');
const path = './src/ai/graph/nodes/formatter.js';
let content = fs.readFileSync(path, 'utf8');

const searchStr = `5. NUDGE PAKET STANDAR: Secara halus, arahkan dan sangat sarankan user untuk memilih "Paket Standar" (misal: "Zoya paling saranin Paket Standar kak, hasilnya udah mantap mirror finish dan dapet garansi 1 tahun"). Tentu sampaikan juga kalau mau pilih paket lain bebas.`;
const replaceStr = `5. WAJIB NUDGE PAKET STANDAR: Setelah menampilkan harga, kamu WAJIB menuliskan kalimat rekomendasi untuk memilih "Paket Standar". Contoh: "Dari 4 paket di atas, Zoya paling saranin kakak ambil Paket Standar ya! Hasilnya udah mantap mirror finish dan dapet garansi 1 tahun lho." (JANGAN SAMPAI LUPA BAGIAN INI!).`;

content = content.replace(searchStr, replaceStr);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched formatter.js again for strong nudge');
