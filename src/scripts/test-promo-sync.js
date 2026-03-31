
const { generateFollowUpMessage } = require('../ai/agents/followUpEngine/messageGenerator.js');
const { getActivePromo } = require('../ai/utils/promoConfig.js');

async function testPromoSync() {
    console.log('--- Testing Promo Sync ---');
    
    // 1. Check active promo
    const promo = await getActivePromo();
    console.log('Active Promo from Config:', JSON.stringify(promo, null, 2));

    if (!promo || !promo.isActive) {
        // Mock promo for testing if not set in DB
        console.log('No active promo found in DB, please check Prisma.');
    }

    // 2. Mock customer data
    const mockCustomer = {
        name: 'Budi Test',
        context: {
            motor_model: 'Vespa Sprint',
            motor_condition: 'Kusam parah',
            target_service: 'Repaint Body Halus',
            customer_label: 'lead'
        },
        metadata: {
            lastMessageAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
        }
    };

    const strategy = {
        angle: 'promo'
    };

    console.log('\nGenerating message for promo angle...');
    const message = await generateFollowUpMessage(mockCustomer, strategy);
    console.log('\nGenerated Message:');
    console.log('------------------');
    console.log(message);
    console.log('------------------');

    const valueStrategy = {
        angle: 'value'
    };
    console.log('\nGenerating message for value angle...');
    const valueMessage = await generateFollowUpMessage(mockCustomer, valueStrategy);
    console.log('\nGenerated Message (Value):');
    console.log('------------------');
    console.log(valueMessage);
    console.log('------------------');
}

testPromoSync().catch(console.error);
