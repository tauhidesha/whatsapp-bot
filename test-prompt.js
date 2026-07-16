const { PrismaClient } = require('@prisma/client');
const { PrismaCheckpointer } = require('./src/ai/graph/PrismaCheckpointer');
const { buildPlannerPrompt } = require('./src/ai/prompts/promptBuilder');

async function test() {
  const prisma = new PrismaClient();
  const cp = new PrismaCheckpointer(prisma);
  const config = { configurable: { thread_id: '176665158225970@lid' } };
  const stateData = await cp.getTuple(config);
  const state = stateData?.checkpoint?.channel_values || {};
  
  const prompt = buildPlannerPrompt(state);
  console.log("=== PLANNER PROMPT START ===");
  console.log(prompt);
  console.log("=== PLANNER PROMPT END ===");
  process.exit(0);
}
test();
