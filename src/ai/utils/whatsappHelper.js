/**
 * WhatsApp Helper Utilities
 * Provides optimized methods to interact with WPPConnect
 */

/**
 * Direct send without fetch by ID (Bypass WPPConnect sendText double-evaluate)
 * This avoids CDP timeouts on @lid identifiers by bypassing getMessageById.
 * 
 * @param {object} client - WPPConnect client instance
 * @param {string} to - Destination ID (@c.us or @lid)
 * @param {string} content - Message content
 * @returns {Promise<any>}
 */
async function sendTextDirect(client, to, content) {
    if (!client || !client.page) {
        throw new Error('WhatsApp client/page not available');
    }
    
    // Bypass wppconnect's sendText yang double-evaluate (send + getMessageById)
    // Langsung pakai WPP.chat.sendTextMessage via page.evaluate
    const { evaluateAndReturn } = require('@wppconnect-team/wppconnect/dist/lib/helpers');
    return evaluateAndReturn(
        client.page,
        ({ to, content }) => WPP.chat.sendTextMessage(to, content, { waitForAck: false }),
        { to, content }
    );
}

module.exports = {
    sendTextDirect
};
