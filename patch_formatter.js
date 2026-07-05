const fs = require('fs');
const path = './src/ai/graph/nodes/formatter.js';
let content = fs.readFileSync(path, 'utf8');

const searchStr = `    // Pass combo data without hardcoding visual display rules`;
const patchStr = `    // Custom Instruction for 4 Paket Repaint Bodi Halus
    let repaintBodiHalusInstruction = '';
    if (replyMode === 'inform' && toolResult?.category === 'repaint_bodi_halus' && toolResult?.candidates) {
        repaintBodiHalusInstruction = \`
INSTRUKSI KHUSUS 4 PAKET REPAINT BODI HALUS:
Kamu harus langsung menampilkan ke-4 pilihan paket ini ke user (Ekonomis, Basic, Standar, Premium).
Aturan penyajian:
1. Urutkan dari yang Termahal (Premium) sampai yang Termurah (Ekonomis).
2. TAMPILKAN PROMO CORET: Untuk paket Premium, Standar, dan Basic, kalikan harga dasar dengan 0.85 (diskon 15%), lalu coret harga asli dan tampilkan harga diskonnya. (Contoh: ~Rp1.000.000~ jadi Rp850.000).
3. Paket Ekonomis TIDAK MENDAPAT DISKON (jangan dicoret).
4. WAJIB sampaikan dengan jelas bahwa Promo Diskon 15% ini HANYA BERLAKU jika kakak sekalian mengambil layanan \${upsellSuggestion || 'Cuci Komplit, Repaint Velg, atau Repaint Bodi Kasar'}.
5. NUDGE PAKET STANDAR: Secara halus, arahkan dan sangat sarankan user untuk memilih "Paket Standar" (misal: "Zoya paling saranin Paket Standar kak, hasilnya udah mantap mirror finish dan dapet garansi 1 tahun"). Tentu sampaikan juga kalau mau pilih paket lain bebas.
\`;
    }

`;

content = content.replace(searchStr, patchStr + searchStr);

// Now I need to append it into modeInstructions.inform
const informSearch = `inform: \`Mode INFO HARGA/JADWAL. Sampaikan detail biaya atau ketersediaan jadwal dari Tool Result secara transparan. \${comboOfferInstruction} \${comboResultInstruction}\`,`;
const informPatch = `inform: \`Mode INFO HARGA/JADWAL. Sampaikan detail biaya atau ketersediaan jadwal dari Tool Result secara transparan. \${comboOfferInstruction} \${comboResultInstruction} \${repaintBodiHalusInstruction}\`,`;

content = content.replace(informSearch, informPatch);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched formatter.js');
