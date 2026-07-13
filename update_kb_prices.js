const fs = require('fs');

const file = fs.readFileSync('meta_ai_knowledge_base.md', 'utf8');

const sizes = {};
const sizeSection = file.split('## UKURAN MOTOR (Untuk Harga Detailing/Coating)')[1];
const sizeLines = sizeSection.split('\n');
for (const line of sizeLines) {
  if (line.startsWith('- Motor:')) {
    const match = line.match(/- Motor: (.*?) \| Ukuran Servis: (.*?) \| Ukuran Repaint \(Jika Beda\): (.*)/);
    if (match) {
      const motor = match[1].trim();
      const repaintSize = match[3].trim();
      sizes[motor] = repaintSize;
    }
  }
}

// Manually map some known from the list
const priceMap = {
  'S': 800000,
  'M': 1000000,
  'L': 1200000,
  'XL': 2500000
};

let inBodiHalus = false;
let updatedFile = [];
let currentMotorAliases = '';
let currentMotorSize = '';

const lines = file.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.startsWith('## DAFTAR HARGA REPAINT BODI HALUS')) {
    inBodiHalus = true;
    updatedFile.push(line);
    continue;
  }
  
  if (line.startsWith('## DAFTAR HARGA REPAINT BODI KASAR')) {
    inBodiHalus = false;
    updatedFile.push(line);
    continue;
  }
  
  if (inBodiHalus) {
    if (line.startsWith('- Motor:')) {
      // e.g. - Motor: SCOOPY (Alias: honda scoopy, ...)
      const match = line.match(/- Motor: (.*?) \(/);
      if (match) {
        const motorName = match[1].trim().toLowerCase();
        
        // Find size
        let size = 'S'; // default
        if (sizes[motorName]) {
          size = sizes[motorName];
        } else {
            // Some manual fallbacks for those not exactly matching
            if (motorName.includes('ninja 650') || motorName.includes('z650') || motorName.includes('z900') || motorName.includes('z1000') || motorName.includes('harley') || motorName.includes('bmw')) size = 'XL';
            if (motorName.includes('vespa')) {
                if (motorName === 'vespa') size = 'XL'; // Generally Vespa is XL repaint
            }
            if (motorName === 'rx-king') size = 'XL';
            if (motorName === 'f1zr') size = 'M';
            if (motorName === 'c70' || motorName === 'astrea grand') size = 'L';
            if (motorName === 'cb 100' || motorName === 'win 100') size = 'XL';
        }
        currentMotorSize = size;
      }
      updatedFile.push(line);
    } else if (line.startsWith('  Harga: Rp')) {
        // Moge and restorasi might have special pricing in the original list.
        // Let's check original price to avoid overwriting special custom prices.
        const originalPrice = parseInt(line.replace(/[^0-9]/g, ''), 10);
        // Only overwrite if it was a standard price before, or if we confidently know the size.
        // Actually, the new rules say S=800, M=1000, L=1200, XL=2500
        
        // Let's just use the mapped price for everything, EXCEPT maybe restorasi.
        let newPrice = priceMap[currentMotorSize];
        
        // Check next line for 'Restorasi' or 'Moge' to keep their special pricing if any?
        // Wait, Moge is XL (2.5M). Some were 3.0M or 3.5M. Let's keep those > 2.5M as is.
        // Restorasi was 1.5M, 1.7M, etc. Let's keep those if original > newPrice or special case.
        if (originalPrice !== newPrice) {
            // Keep original if it's a special restorasi/moge price that is higher than the base size price
            // BUT wait, for Vespa (XL), base is 2.5M now. Old was 1.5M. So it should become 2.5M.
            if (originalPrice > 2500000) {
               newPrice = originalPrice; // keep 3M, 3.5M
            }
        }
        
        // Format to Rp X.XXX.XXX
        const formattedPrice = 'Rp ' + newPrice.toLocaleString('id-ID').replace(/,/g, '.');
        updatedFile.push(`  Harga: ${formattedPrice}`);
    } else {
      updatedFile.push(line);
    }
  } else {
    updatedFile.push(line);
  }
}

fs.writeFileSync('meta_ai_knowledge_base_updated.md', updatedFile.join('\n'));
console.log('Prices updated in new file. Comparing diff...');
