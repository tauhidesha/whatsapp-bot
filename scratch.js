const { execSync } = require('child_process');
const fs = require('fs');
let code = fs.readFileSync('scripts/backfillContextPrisma.js', 'utf8');
code = code.replace('async function processCustomers(dryRun = false) {', 'async function processCustomers(dryRun = false) {\n    const targetPhone = process.argv.includes("--phone") ? process.argv[process.argv.indexOf("--phone") + 1] : null;');
code = code.replace('orderBy: { updatedAt: \'desc\' }', 'orderBy: { updatedAt: \'desc\' }, where: targetPhone ? { phone: targetPhone } : undefined');
fs.writeFileSync('scripts/backfillContextPrisma.js', code);
