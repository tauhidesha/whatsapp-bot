const fs = require('fs');
const file = 'src/ai/graph/nodes/formatter.js';
let content = fs.readFileSync(file, 'utf8');

const oldLogic = `        const hasHalus = context.serviceTypes?.some(s => s.toLowerCase().includes('bodi halus'));
        const comboPartners = context.serviceTypes?.filter(s => {
            const lower = s.toLowerCase();
            return lower.includes('velg') || lower.includes('kasar') || lower.includes('cuci');
        });
        const alreadyGotHalusCombo = hasHalus && comboPartners?.length > 0;`;

const newLogic = `        const isFullBodi = context.detailingFocus && context.detailingFocus.toLowerCase().includes('full bodi');
        const hasHalus = isFullBodi || context.serviceTypes?.some(s => s.toLowerCase().includes('bodi halus'));
        const comboPartners = context.serviceTypes?.filter(s => {
            const lower = s.toLowerCase();
            return lower.includes('velg') || lower.includes('kasar') || lower.includes('cuci');
        }) || [];
        
        if (isFullBodi) {
            const kasarIncluded = comboPartners.some(p => p.toLowerCase().includes('kasar'));
            if (!kasarIncluded) comboPartners.push('Repaint Bodi Kasar');
        }

        const alreadyGotHalusCombo = hasHalus && comboPartners.length > 0;`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(file, content, 'utf8');
console.log("Updated formatter.js");
