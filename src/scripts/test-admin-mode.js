const { zoyaAgent } = require('../ai/graph/index');
const { HumanMessage } = require('@langchain/core/messages');
require('dotenv').config();

async function testAdminRouting() {
    console.log('--- Testing Admin Routing ---');
    
    // Simulasikan nomor admin (sesuaikan dengan .env)
    const adminPhone = (process.env.BOSMAT_ADMIN_NUMBER || '').replace(/\D/g, '');
    
    if (!adminPhone) {
        console.error('BOSMAT_ADMIN_NUMBER not set in .env');
        return;
    }

    const initialState = {
        messages: [new HumanMessage('Halo Zoya, kasih laporan keuangan bulan ini dong')],
        metadata: {
            phoneReal: adminPhone,
            fullSenderId: `${adminPhone}@c.us`
        }
    };

    console.log(`Testing with phone: ${adminPhone}`);
    
    try {
        const result = await zoyaAgent.invoke(initialState, {
            configurable: { thread_id: 'test-admin-thread' }
        });

        console.log('--- Result ---');
        console.log('isAdmin:', result.isAdmin);
        console.log('Last Message:', result.messages[result.messages.length - 1].content);
        
        if (result.isAdmin) {
            console.log('✅ Success: Routed to Admin Mode');
        } else {
            console.log('❌ Failure: Routed to Customer Mode');
        }

    } catch (error) {
        console.error('Test Error:', error);
    }
}

testAdminRouting();
