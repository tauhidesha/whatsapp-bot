const { getServiceDetailsTool } = require('./src/ai/tools/getServiceDetailsTool.js');
const { getStudioInfoTool } = require('./src/ai/tools/getStudioInfoTool.js');
const { checkBookingAvailabilityTool } = require('./src/ai/tools/checkBookingAvailabilityTool.js');
const { createBookingTool } = require('./src/ai/tools/createBookingTool.js');
const { updateBookingTool } = require('./src/ai/tools/updateBookingTool.js');
const { crmManagementTool } = require('./src/ai/tools/crmManagementTool.js');
const { 
    addTransactionTool, 
    updateTransactionTool, 
    deleteTransactionTool, 
    getTransactionHistoryTool, 
    calculateFinancesTool 
} = require('./src/ai/tools/financeManagementTool.js');
const { readDirectMessagesTool } = require('./src/ai/tools/readDirectMessagesTool.js');
const { sendMessageTool } = require('./src/ai/tools/sendMessageTool.js');
const { getCurrentDateTimeTool } = require('./src/ai/tools/getCurrentDateTimeTool.js');
const { updateCustomerLabelTool } = require('./src/ai/tools/updateCustomerLabelTool.js');
const { updateCustomerContextTool } = require('./src/ai/tools/updateCustomerContextTool.js');
const { triggerBosMatTool } = require('./src/ai/tools/triggerBosMatTool.js');
const { sendStudioPhotoTool } = require('./src/ai/tools/sendStudioPhotoTool.js');
const { calculateHomeServiceFeeTool } = require('./src/ai/tools/calculateHomeServiceFeeTool.js');

const check = {
    getServiceDetailsTool,
    getStudioInfoTool,
    checkBookingAvailabilityTool,
    createBookingTool,
    updateBookingTool,
    crmManagementTool,
    addTransactionTool,
    updateTransactionTool,
    deleteTransactionTool,
    getTransactionHistoryTool,
    calculateFinancesTool,
    readDirectMessagesTool,
    sendMessageTool,
    getCurrentDateTimeTool,
    updateCustomerLabelTool,
    updateCustomerContextTool,
    triggerBosMatTool,
    sendStudioPhotoTool,
    calculateHomeServiceFeeTool
};

for (const [name, value] of Object.entries(check)) {
    if (!value) {
        console.log(`❌ ${name} is UNDEFINED`);
    } else if (!value.toolDefinition) {
        console.log(`❌ ${name} is missing toolDefinition`);
    } else {
        console.log(`✅ ${name} is OK`);
    }
}
