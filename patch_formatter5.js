const fs = require('fs');
const path = './src/ai/graph/nodes/formatter.js';
let content = fs.readFileSync(path, 'utf8');

const searchStr = `2. Ada biaya tambahan untuk warna khusus/tertentu.`;
const replaceStr = `2. Ada biaya tambahan untuk warna khusus/tertentu.
3. KHUSUS "Repaint Bodi Kasar": TIDAK PERLU menanyakan pilihan warna. Bodi kasar selalu direpaint ke warna original pabrik (hitam plastik/doff). JANGAN PERNAH bertanya "Bodi kasarnya mau warna apa?"`;

content = content.replace(searchStr, replaceStr);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched formatter.js for Bodi Kasar color rule');
