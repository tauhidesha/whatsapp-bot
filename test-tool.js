const { getServiceDetailsTool } = require('./src/ai/tools/getServiceDetailsTool');
async function test() {
  const result = await getServiceDetailsTool.implementation({ service_name: ['repaint'], motor_model: 'Aerox' });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
test();
