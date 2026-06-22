const prisma = require('./src/lib/prisma');
async function check() {
  const row = await prisma.keyValueStore.findUnique({
    where: { collection_key: { collection: 'settings', key: 'ai_config' } }
  });
  if (row && row.value && row.value.systemPrompt) {
    // Print just the repaint strategy section
    const prompt = row.value.systemPrompt;
    const idx = prompt.indexOf('STRATEGI PAKET REPAINT');
    if (idx !== -1) {
      console.log('=== DB PROMPT (Repaint Section) ===');
      console.log(prompt.substring(idx, idx + 2000));
    } else {
      console.log('No STRATEGI PAKET found in DB prompt');
      console.log('DB Prompt length:', prompt.length);
    }
  } else {
    console.log('No custom prompt in DB — using hardcoded.');
  }
  process.exit(0);
}
check();
