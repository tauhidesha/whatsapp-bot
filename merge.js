const fs = require('fs');

const kbPath = 'meta_ai_knowledge_base.md';
const repaintPath = 'meta_ai_harga_paket_repaint.md';

let kbContent = fs.readFileSync(kbPath, 'utf8');
let repaintContent = fs.readFileSync(repaintPath, 'utf8');

// Demote headers safely using a function
repaintContent = repaintContent.replace(/^(#+)\s/gm, (match, hashes) => {
    return hashes + '# ';
});

const startIndex = kbContent.indexOf('## DAFTAR HARGA & PAKET REPAINT BODI HALUS');
const endIndex = kbContent.indexOf('## DAFTAR HARGA REPAINT BODI KASAR');

if (startIndex !== -1 && endIndex !== -1) {
    const before = kbContent.substring(0, startIndex);
    const after = kbContent.substring(endIndex);
    
    const newContent = before + repaintContent + '\n\n' + after;
    fs.writeFileSync(kbPath, newContent);
    console.log("Merged successfully.");
} else {
    console.log("Could not find sections to merge.");
}
