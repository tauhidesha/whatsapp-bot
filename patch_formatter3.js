const fs = require('fs');
const path = './src/ai/graph/nodes/formatter.js';
let content = fs.readFileSync(path, 'utf8');

const searchStr = `1. Urutkan dari yang Termahal (Premium) sampai yang Termurah (Ekonomis).`;
const replaceStr = `1. Urutkan dari yang Termahal (Premium) sampai yang Termurah (Ekonomis).
1a. FORMATTING (SANGAT PENTING): Gunakan bullet points (•) untuk setiap paket. JANGAN mengapit seluruh list dengan tanda bintang (*). Jika ingin menebalkan, HANYA tebalkan nama paketnya saja (contoh: • *Paket Standar*: ~Rp1.000.000~ jadi Rp850.000). Pastikan baris baru antar paket agar rapi dan mudah dibaca.`;

content = content.replace(searchStr, replaceStr);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched formatter.js again for strict formatting');
