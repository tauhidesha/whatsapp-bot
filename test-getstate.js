const { PrismaClient } = require('@prisma/client');
const { PrismaCheckpointer } = require('./src/ai/graph/PrismaCheckpointer');
const { zoyaAgent } = require('./src/ai/graph/index');

async function test() {
  const prisma = new PrismaClient();
  const config = { configurable: { thread_id: '176665158225970@lid' } };
  const currentState = await zoyaAgent.getState(config);
  
  if (currentState && currentState.values && currentState.values.messages) {
      console.log("Is array of objects?", typeof currentState.values.messages[0]);
      console.log("Keys:", Object.keys(currentState.values.messages[0]));
      console.log("Has _getType?", typeof currentState.values.messages[0]._getType);
      console.log("Content type:", typeof currentState.values.messages[0].content);
      console.log("Content:", currentState.values.messages[0].content);
  } else {
      console.log("No messages in state");
  }
  process.exit(0);
}
test();
