const { generateFollowUpMessage } = require('./src/ai/agents/followUpEngine/messageGenerator.js');

async function testReviewLogic() {
  console.log('🧪 Testing Updated Review Follow-Up Prompt Directly...');
  
  const customer = {
    name: 'Budi Test',
    context: {
      motor_model: 'Vespa Sprint',
      motor_color: 'Matt Grey',
      motor_condition: 'Kinclong banget habis coating',
      customer_label: 'loyal_customer'
    },
    metadata: {
      lastMessageAt: new Date(Date.now() - 3 * 86400000)
    }
  };

  const strategy = { angle: 'review' };

  const message = await generateFollowUpMessage(customer, strategy);
  
  console.log('\n--- GENERATED MESSAGE ---');
  console.log(message);
  console.log('--------------------------\n');

  const lowerMessage = message.toLowerCase();
  const prohibited = ['tarikan', 'akselerasi', 'mesin', 'oli', 'servis rutin', 'tune up', 'suara mesin', 'busi', 'karburator', 'injeksi'];
  const foundProhibited = prohibited.filter(p => lowerMessage.includes(p));

  if (foundProhibited.length > 0) {
    console.log('❌ FAIL: Still mentioned mechanical terms:', foundProhibited.join(', '));
  } else {
    console.log('✅ PASS: No mechanical terms found.');
  }
  
  process.exit(0);
}

testReviewLogic().catch(console.error);
