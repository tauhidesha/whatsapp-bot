/**
 * Script: backfill-customer-labels.js
 * One-time run to classify all customers who have null customerLabel.
 * Safe to re-run (won't overwrite existing labels unless --force flag is used).
 *
 * Usage:
 *   node src/scripts/backfill-customer-labels.js            # dry run (preview only)
 *   node src/scripts/backfill-customer-labels.js --run      # actually write to DB
 *   node src/scripts/backfill-customer-labels.js --force    # re-classify ALL (even existing labels)
 */

require('dotenv').config();
const { classifyAndSaveCustomer } = require('../../src/ai/agents/customerClassifier.js');
const prisma = require('../../src/lib/prisma.js');

const isDryRun = !process.argv.includes('--run') && !process.argv.includes('--force');
const isForce  = process.argv.includes('--force');

async function main() {
    console.log('='.repeat(60));
    console.log('  Backfill Customer Labels');
    console.log(`  Mode: ${isDryRun ? '🔍 DRY RUN (preview only)' : isForce ? '⚡ FORCE (re-classify ALL)' : '✅ WRITE'}`);
    console.log('='.repeat(60));

    // Find customers to classify
    const whereClause = isForce
        ? {} // all customers
        : { customerContext: { is: null } }; // only those without a context row

    // Also catch customers who HAVE a context row but label is null
    const customersWithNullLabel = await prisma.customer.findMany({
        where: {
            AND: [
                {
                    OR: [
                        { customerContext: { is: null } },
                        { customerContext: { customerLabel: null } },
                    ]
                },
                ...(isForce ? [] : []),
            ]
        },
        select: {
            id: true,
            phone: true,
            name: true,
            lastMessageAt: true,
            customerContext: {
                select: { customerLabel: true }
            }
        },
        orderBy: { lastMessageAt: 'desc' }
    });

    if (isForce) {
        // In force mode, get all customers
        const allCustomers = await prisma.customer.findMany({
            select: {
                id: true,
                phone: true,
                name: true,
                lastMessageAt: true,
                customerContext: {
                    select: { customerLabel: true }
                }
            },
            orderBy: { lastMessageAt: 'desc' }
        });
        await processCustomers(allCustomers);
    } else {
        await processCustomers(customersWithNullLabel);
    }
}

async function processCustomers(customers) {
    const adminNumbers = [
        process.env.BOSMAT_ADMIN_NUMBER,
        process.env.ADMIN_WHATSAPP_NUMBER,
    ].filter(Boolean).map(n => n.toString().replace(/\D/g, ''));

    // Filter out admins
    const toProcess = customers.filter(c => {
        const cleanPhone = c.phone.replace(/\D/g, '').replace(/@.*/, '');
        return !adminNumbers.some(admin => cleanPhone.includes(admin));
    });

    console.log(`\nFound ${toProcess.length} customer(s) to classify.\n`);

    if (isDryRun) {
        console.log('📋 Preview list:');
        toProcess.forEach((c, i) => {
            const currentLabel = c.customerContext?.customerLabel || 'null';
            const lastChat = c.lastMessageAt
                ? new Date(c.lastMessageAt).toLocaleDateString('id-ID')
                : 'never';
            console.log(`  ${i + 1}. ${c.name || 'Unknown'} | ${c.phone} | label: ${currentLabel} | last chat: ${lastChat}`);
        });
        console.log('\n⚠️  DRY RUN: No changes made. Run with --run or --force to apply.');
        return;
    }

    let success = 0;
    let failed  = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const customer = toProcess[i];
        const currentLabel = customer.customerContext?.customerLabel || 'null';

        try {
            await classifyAndSaveCustomer(customer.phone);
            // Read back the result
            const updated = await prisma.customerContext.findUnique({
                where: { id: customer.phone.replace(/\D/g, '') },
                select: { customerLabel: true }
            });
            const newLabel = updated?.customerLabel || 'unknown';
            console.log(`[${i + 1}/${toProcess.length}] ✅ ${customer.name || customer.phone} → ${currentLabel} → ${newLabel}`);
            success++;
        } catch (err) {
            console.error(`[${i + 1}/${toProcess.length}] ❌ ${customer.name || customer.phone}: ${err.message}`);
            failed++;
        }

        // Small delay to avoid hammering DB
        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`  Done! ✅ ${success} classified, ❌ ${failed} failed`);
    console.log('='.repeat(60));
}

main()
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
