const fs = require('fs');

// Patch formatter.js
let formatterPath = './src/ai/graph/nodes/formatter.js';
let formatterContent = fs.readFileSync(formatterPath, 'utf8');
formatterContent = formatterContent.replace(
  'Jam Buka: Senin-Kamis & Sabtu-Minggu (${studioMetadata.hours.senin}), Jumat (Tutup).',
  'Jam Buka: Senin-Sabtu (${studioMetadata.hours.senin}), Minggu (Tutup).'
);
fs.writeFileSync(formatterPath, formatterContent, 'utf8');

// Patch getStudioInfoTool.js
let getStudioPath = './src/ai/tools/getStudioInfoTool.js';
let getStudioContent = fs.readFileSync(getStudioPath, 'utf8');
getStudioContent = getStudioContent.replace(
  '• Senin-Kamis: ${studioInfo.hours.senin}\\n      • Jumat: ${studioInfo.hours.jumat}\\n      • Sabtu-Minggu: ${studioInfo.hours.sabtu}',
  '• Senin-Sabtu: ${studioInfo.hours.senin}\\n      • Minggu: ${studioInfo.hours.minggu}'
);
getStudioContent = getStudioContent.replace(
  '• Senin-Kamis: ${studioInfo.hours.senin}\\n        • Jumat: ${studioInfo.hours.jumat}\\n        • Sabtu-Minggu: ${studioInfo.hours.sabtu}',
  '• Senin-Sabtu: ${studioInfo.hours.senin}\\n        • Minggu: ${studioInfo.hours.minggu}'
);
fs.writeFileSync(getStudioPath, getStudioContent, 'utf8');

console.log('Patched hours in formatter.js and getStudioInfoTool.js');
