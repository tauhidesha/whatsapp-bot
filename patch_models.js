const fs = require('fs');

function patchFile(file, findStr, replaceStr) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(findStr, replaceStr);
    fs.writeFileSync(file, content, 'utf8');
}

patchFile('./src/ai/graph/nodes/classifier.js', 'model: process.env.AI_MODEL,', 'model: process.env.AI_MODEL || "gemini-1.5-flash",');
patchFile('./src/ai/graph/nodes/formatter.js', 'model: process.env.AI_MODEL,', 'model: process.env.AI_MODEL || "gemini-1.5-flash",');
patchFile('./src/ai/graph/nodes/infoCollector.js', 'model: process.env.VISION_MODEL || process.env.AI_MODEL,', 'model: process.env.VISION_MODEL || process.env.AI_MODEL || "gemini-1.5-flash",');

console.log('Patched models');
