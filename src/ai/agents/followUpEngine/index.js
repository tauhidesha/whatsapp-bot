// File: src/ai/agents/followUpEngine/index.js
// Entry point & exports for Follow-Up Engine.

const { startFollowUpScheduler, stopFollowUpScheduler, runDailyFollowUp, STRATEGY_CONFIG } = require('./scheduler.js');
const { updateSignalsOnIncomingMessage, markAsConverted } = require('./signalTracker.js');
const { shouldStop, handleStopAction } = require('./stopCondition.js');

module.exports = {
    // Scheduler
    startFollowUpScheduler,
    stopFollowUpScheduler,
    runDailyFollowUp,
    STRATEGY_CONFIG,

    // Signal Tracker (realtime)
    updateSignalsOnIncomingMessage,
    markAsConverted,

    // Stop Conditions
    shouldStop,
    handleStopAction,
};
