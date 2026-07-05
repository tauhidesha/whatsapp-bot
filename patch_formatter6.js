const fs = require('fs');
const path = './src/ai/graph/nodes/formatter.js';
let content = fs.readFileSync(path, 'utf8');

const searchStr = `5. WAJIB NUDGE PAKET STANDAR: Setelah menampilkan harga, kamu WAJIB menuliskan kalimat rekomendasi untuk memilih "Paket Standar". Contoh: "Dari 4 paket di atas, Zoya paling saranin kakak ambil Paket Standar ya! Hasilnya udah mantap mirror finish dan dapet garansi 1 tahun lho." (JANGAN SAMPAI LUPA BAGIAN INI!).`;
const replaceStr = `5. WAJIB NUDGE PAKET STANDAR: Setelah menampilkan harga, kamu WAJIB menuliskan kalimat rekomendasi untuk memilih "Paket Standar". Contoh: "Dari 4 paket di atas, Zoya paling saranin kakak ambil Paket Standar ya! Hasilnya udah mantap mirror finish dan dapet garansi 1 tahun lho." (JANGAN SAMPAI LUPA BAGIAN INI!).
6. TAMPILKAN LAYANAN LAIN: JIKA ada layanan lain selain Bodi Halus di dalam TOOL RESULT JSON (misalnya Repaint Bodi Kasar, Cuci Komplit, dll), WAJIB berikan juga harga layanan tersebut. Jangan pernah bilang "harga akan diinfokan nanti", harganya sudah ada di JSON!`;

if(content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Patched formatter.js for instruction 6');
} else {
    console.log('Search string not found!');
}
