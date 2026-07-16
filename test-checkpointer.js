const { PrismaClient } = require('@prisma/client');
const { PrismaCheckpointer } = require('./src/ai/graph/PrismaCheckpointer');

async function test() {
  const prisma = new PrismaClient();
  const cp = new PrismaCheckpointer(prisma);
  const config = { configurable: { thread_id: '176665158225970@lid' } };
  const state = await cp.getTuple(config);
  console.log(JSON.stringify(state?.checkpoint?.channel_values?.messages, null, 2));
  process.exit(0);
}
test();
