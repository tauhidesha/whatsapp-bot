/**
 * Script to manually trigger the daily follow-up scheduler.
 * Usage: 
 *   node scripts/triggerDailyFollowUp.js          # Dry run (safe, only logs)
 *   node scripts/triggerDailyFollowUp.js --force  # Real run (requires running app or client setup)
 */

const { runDailyFollowUp } = require('../src/ai/agents/followUpEngine/scheduler.js');
const prisma = require('../src/lib/prisma');

async function main() {
    const isForce = process.argv.includes('--force');
    const dryRun = !isForce;

    console.log(`[Manual Trigger] Starting follow-up run. Mode: ${dryRun ? 'DRY RUN (Safe)' : 'REAL RUN'}`);
    
    if (isForce) {
        console.warn('⚠️ WARNING: REAL RUN mode will actually send messages if a WhatsApp client is available.');
        console.warn('This script typically does NOT have access to the running WhatsApp client in app.js.');
        console.warn('Real runs should usually be triggered via the internal scheduler or an API endpoint.');
        console.log('Continuing in 3 seconds...');
        await new Promise(r => setTimeout(r, 3000));
    }

    try {
        const result = await runDailyFollowUp(dryRun);
        console.log('\n[Manual Trigger] Summary:', result);
    } catch (err) {
        console.error('[Manual Trigger] Execution failed:', err);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

main();
