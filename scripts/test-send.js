require('dotenv').config();
const { sendTextDirect } = require('./src/ai/utils/whatsapp');
const { initWhatsAppClient } = require('./src/ai/utils/whatsapp'); // Assuming there's a way to get the client

async function testSend() {
    console.log('Initializing WhatsApp client...');
    const client = await initWhatsAppClient();
    
    // Wait a bit for client to be ready
    await new Promise(r => setTimeout(r, 3000));
    
    const target = '81287205363766@lid';
    console.log(`Sending test message to ${target}...`);
    try {
        await sendTextDirect(client, target, 'Test message dari AI system debugging');
        console.log('Message sent successfully!');
    } catch (e) {
        console.error('Failed to send:', e);
    }
    process.exit(0);
}

testSend().catch(console.error);
