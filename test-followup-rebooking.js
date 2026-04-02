require('dotenv').config();
const prisma = require('./src/lib/prisma.js');
const { syncCustomer } = require('./src/ai/utils/customerSync.js');
const { runDailyFollowUp } = require('./src/ai/agents/followUpEngine/scheduler.js');

async function test() {
    console.log('--- Testing Post-Service Review & Rebooking Logic ---');

    // 1. Setup a test customer
    const phone = '6281234567890';
    const customer = await prisma.customer.upsert({
        where: { phone },
        update: {
            name: 'Test Customer',
            lastMessageAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
        },
        create: {
            phone,
            name: 'Test Customer',
            lastMessageAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        }
    });

    // 2. Setup a mock booking (3 days ago, Coating)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const booking = await prisma.booking.create({
        data: {
            customerId: customer.id,
            status: 'COMPLETED',
            bookingDate: threeDaysAgo,
            serviceType: 'Coating Motor Glossy',
            customerName: 'Test Customer',
            customerPhone: phone
        }
    });

    console.log('Created mock booking:', booking.id, 'Status:', booking.status);

    // 3. Sync Customer
    console.log('Syncing customer...');
    await syncCustomer(customer.id);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const context = await prisma.customerContext.findUnique({ where: { phone } });
    console.log('Customer Context after sync:', {
        lastServiceAt: context.lastServiceAt,
        lastServiceType: context.lastServiceType,
        reviewFollowUpSent: context.reviewFollowUpSent
    });

    if (context.lastServiceType !== 'coating') {
        console.error('❌ Error: lastServiceType should be "coating"');
    }

    // 4. Run Scheduler (Dry Run / Simulation)
    console.log('\nRunning Daily Follow-Up Scheduler simulation...');
    // Note: This will actually try to send a message if global.whatsappClient is set.
    // For safety in this test, we can mock the whatsappClient if we want, 
    // but here we just want to see if the logic picks it up.
    
    // Mocking global.whatsappClient to prevent actual sending but see the logs
    global.whatsappClient = {
        sendText: async (to, text) => {
            console.log(`[MOCK SEND] To: ${to}, Message: ${text}`);
            return { id: 'mock_msg_id' };
        }
    };

    const result = await runDailyFollowUp();
    console.log('Scheduler Result:', result);

    // 5. Check if flags updated
    const finalContext = await prisma.customerContext.findUnique({ where: { phone } });
    console.log('Final Context:', {
        reviewFollowUpSent: finalContext.reviewFollowUpSent,
        lastFollowUpStrategy: finalContext.lastFollowUpStrategy
    });

    if (finalContext.reviewFollowUpSent === true && finalContext.lastFollowUpStrategy === 'review') {
        console.log('✅ Review follow-up logic works!');
    }

    // 6. Test Rebooking (Simulate 6 months later)
    console.log('\nTesting Rebooking Logic (Simulating 6 months later)...');
    const sixMonthsAgo = new Date(Date.now() - 181 * 24 * 60 * 60 * 1000);
    await prisma.customerContext.update({
        where: { phone },
        data: {
            lastServiceAt: sixMonthsAgo,
            lastServiceType: 'coating',
            reviewFollowUpSent: true, // Already done review
            lastFollowUpAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days since last nurturing
        }
    });

    const rebookingResult = await runDailyFollowUp();
    console.log('Rebooking Scheduler Result:', rebookingResult);

    const rebookingContext = await prisma.customerContext.findUnique({ where: { phone } });
    console.log('Rebooking Context:', {
        lastFollowUpStrategy: rebookingContext.lastFollowUpStrategy
    });

    if (rebookingContext.lastFollowUpStrategy === 'rebooking_coating') {
        console.log('✅ Rebooking follow-up logic works!');
    }

    // Cleanup
    await prisma.booking.delete({ where: { id: booking.id } });
    console.log('\nTest Completed.');
    process.exit(0);
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
