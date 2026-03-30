const { getServiceDetailsTool } = require('../tools/getServiceDetailsTool.js');
const { getStudioInfoTool } = require('../tools/getStudioInfoTool.js');
const { checkBookingAvailabilityTool } = require('../tools/checkBookingAvailabilityTool.js');
const { createBookingTool } = require('../tools/createBookingTool.js');
const { getCurrentDateTimeTool } = require('../tools/getCurrentDateTimeTool.js');
const { triggerBosMatTool } = require('../tools/triggerBosMatTool.js');
const { sendStudioPhotoTool } = require('../tools/sendStudioPhotoTool.js');
const { calculateHomeServiceFeeTool } = require('../tools/calculateHomeServiceFeeTool.js');

/**
 * Daftar tool yang akan digunakan oleh LangGraph.
 * Kita menggunakan implementasi yang sudah ada di folder src/ai/tools/.
 */
const zoyaTools = [
    getServiceDetailsTool,
    getStudioInfoTool,
    checkBookingAvailabilityTool,
    createBookingTool,
    getCurrentDateTimeTool,
    triggerBosMatTool,
    sendStudioPhotoTool,
    calculateHomeServiceFeeTool
];

// Mapping nama ke implementasi (untuk manual call jika diperlukan)
const toolsByName = Object.fromEntries(
    zoyaTools.map(t => [t.toolDefinition.function.name, t.implementation])
);

module.exports = {
    zoyaTools,
    toolsByName
};
