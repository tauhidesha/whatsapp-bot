const fs = require('fs');
const path = './src/ai/graph/nodes/formatter.js';
let content = fs.readFileSync(path, 'utf8');

const oldStr = `if (replyMode === 'inform' && toolResult?.category === 'repaint_bodi_halus' && toolResult?.candidates)`;
const newStr = `if (replyMode === 'inform' && (toolResult?.category === 'repaint_bodi_halus' || toolResult?.results?.[0]?.category === 'repaint_bodi_halus') && (toolResult?.candidates || toolResult?.results?.[0]?.candidates))`;

content = content.replace(oldStr, newStr);
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed formatter.js');
