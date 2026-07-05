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
    if (!client) {
        throw new Error('WhatsApp client not available');
    }

    // Baileys support
    if (typeof client.sendMessage === 'function') {
        return client.sendMessage(to, { text: content });
    }

    // WPPConnect legacy support
    if (!client.page) {
        throw new Error('WhatsApp client/page not available for WPPConnect');
    }
    
    // Bypass wppconnect's sendText yang double-evaluate (send + getMessageById)
    // Langsung pakai WPP.chat.sendTextMessage via page.evaluate
    const { evaluateAndReturn } = require('@wppconnect-team/wppconnect/dist/api/helpers');
    return evaluateAndReturn(
        client.page,
        ({ to, content }) => WPP.chat.sendTextMessage(to, content, { waitForAck: false }),
        { to, content }
    );
}

module.exports = {
    sendTextDirect
};
