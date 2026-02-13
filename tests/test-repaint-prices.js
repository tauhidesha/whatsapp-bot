// File: tests/test-repaint-prices.js
// Quick verification script for model-based repaint pricing

const path = require('path');

// Minimal mock for motorSizeMemory to avoid Firebase dependency
jest_mock_motorSizeMemory();

function jest_mock_motorSizeMemory() {
    const modPath = path.resolve(__dirname, '../src/ai/utils/motorSizeMemory.js');
    const Module = require('module');
    const origResolve = Module._resolveFilename;
    Module._resolveFilename = function (request, parent, ...rest) {
        if (request.endsWith('motorSizeMemory.js') || request.endsWith('motorSizeMemory')) {
            // Return a fake module
            return '__mock_motorSizeMemory__';
        }
        return origResolve.call(this, request, parent, ...rest);
    };
    require.cache['__mock_motorSizeMemory__'] = {
        id: '__mock_motorSizeMemory__',
        filename: '__mock_motorSizeMemory__',
        loaded: true,
        exports: {
            getMotorSizesForSender: () => null,
            getPreferredSizeForService: () => null,
            setPreferredSizeForService: () => { },
            setMotorSizeForSender: () => { },
        },
    };
}

const { getServiceDetailsTool } = require('../src/ai/tools/getServiceDetailsTool.js');
const impl = getServiceDetailsTool.implementation;

async function runTests() {
    console.log('=== Test Repaint Price Migration ===\n');
    let passed = 0;
    let failed = 0;

    async function test(name, input, check) {
        const result = await impl(input);
        const ok = check(result);
        if (ok) {
            console.log(`✅ PASS: ${name}`);
            passed++;
        } else {
            console.log(`❌ FAIL: ${name}`);
            console.log('   Result:', JSON.stringify(result, null, 2));
            failed++;
        }
    }

    // 1. Scoopy – harga fixed
    await test(
        'Repaint Bodi Halus + Scoopy → Rp 1.275.000',
        { service_name: 'Repaint Bodi Halus', motor_model: 'Scoopy' },
        r => r.success && r.price === 1275000 && r.price_type === 'fixed'
    );

    // 2. Beat – harga range
    await test(
        'Repaint Bodi Halus + Beat → Range 600rb - 1.25jt',
        { service_name: 'Repaint Bodi Halus', motor_model: 'Beat' },
        r => r.success && r.price_type === 'range' && r.price_min === 600000 && r.price_max === 1250000
    );

    // 3. NMax – harga fixed
    await test(
        'Repaint Bodi Halus + NMax → Rp 1.020.000',
        { service_name: 'Repaint Bodi Halus', motor_model: 'NMax' },
        r => r.success && r.price === 1020000
    );

    // 4. Tanpa model motor – hint
    await test(
        'Repaint Bodi Halus tanpa model → hint',
        { service_name: 'Repaint Bodi Halus' },
        r => r.success && r.hint && r.hint.includes('model motor')
    );

    // 5. Non-repaint service – tidak terpengaruh
    await test(
        'Detailing Mesin + Scoopy → Tidak terpengaruh, pakai variants',
        { service_name: 'Detailing Mesin', motor_model: 'Scoopy', size: 'S' },
        r => r.success && r.price === 100000
    );

    // 6. CBR 250RR
    await test(
        'Repaint Bodi Halus + CBR 250RR → Rp 1.700.000',
        { service_name: 'Repaint Bodi Halus', motor_model: 'CBR 250RR' },
        r => r.success && r.price === 1700000
    );

    // 7. Vespa Sprint (alias)
    await test(
        'Repaint Bodi Halus + Vespa Sprint → Rp 2.125.000',
        { service_name: 'Repaint Bodi Halus', motor_model: 'Vespa Sprint' },
        r => r.success && r.price === 2125000
    );

    // 8. Repaint Bodi Kasar – ranges
    await test(
        'Repaint Bodi Kasar + Beat → category_ranges',
        { service_name: 'Repaint Bodi Kasar', motor_model: 'Beat' },
        r => r.success && r.price_type === 'category_ranges' && r.ranges && r.ranges.length > 0
    );

    // 9. Repaint Velg – ranges
    await test(
        'Repaint Velg + NMax → category_ranges',
        { service_name: 'Repaint Velg', motor_model: 'NMax' },
        r => r.success && r.price_type === 'category_ranges' && r.ranges && r.ranges.length > 0
    );

    // 10. RX King (2-tak)
    await test(
        'Repaint Bodi Halus + RX King → Rp 2.125.000',
        { service_name: 'Repaint Bodi Halus', motor_model: 'RX King' },
        r => r.success && r.price === 2125000
    );

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
