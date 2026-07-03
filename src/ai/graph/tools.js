const { generateMarketingCopyTool } = require('../tools/generateMarketingCopyTool.js');
const { getServiceDetailsTool } = require('../tools/getServiceDetailsTool.js');
const { getStudioInfoTool } = require('../tools/getStudioInfoTool.js');
const { checkBookingAvailabilityTool } = require('../tools/checkBookingAvailabilityTool.js');
const { createBookingTool } = require('../tools/createBookingTool.js');
const { updateBookingTool } = require('../tools/updateBookingTool.js');
const { crmManagementTool } = require('../tools/crmManagementTool.js');
const { 
    addTransactionTool, 
    updateTransactionTool, 
    deleteTransactionTool, 
    getTransactionHistoryTool, 
    calculateFinancesTool 
} = require('../tools/financeManagementTool.js');
const { readDirectMessagesTool } = require('../tools/readDirectMessagesTool.js');
const { sendMessageTool } = require('../tools/sendMessageTool.js');
const { getCurrentDateTimeTool } = require('../tools/getCurrentDateTimeTool.js');
const { updateCustomerLabelTool } = require('../tools/updateCustomerLabelTool.js');
const { updateCustomerContextTool } = require('../tools/updateCustomerContextTool.js');
const { triggerBosMatTool } = require('../tools/triggerBosMatTool.js');
const { sendStudioPhotoTool } = require('../tools/sendStudioPhotoTool.js');
const { calculateHomeServiceFeeTool } = require('../tools/calculateHomeServiceFeeTool.js');

/**
 * Daftar tool yang akan digunakan oleh LangGraph.
 * Kita menggunakan implementasi yang sudah ada di folder src/ai/tools/.
 */
const zoyaTools = [
    generateMarketingCopyTool,
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
];

// Mapping nama ke implementasi (untuk manual call jika diperlukan)
const toolsByName = Object.fromEntries(
    zoyaTools
        .filter(t => t && t.toolDefinition) // Defensive filter
        .map(t => [t.toolDefinition.function.name, t.implementation])
);

module.exports = {
    zoyaTools,
    toolsByName
};
