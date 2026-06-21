/**
 * WhatsApp Helper Utilities
 * Provides optimized methods to interact with Baileys
 */

/**
 * Direct send message
 * 
 * @param {object} client - Baileys socket instance
 * @param {string} to - Destination ID (@s.whatsapp.net or @lid)
 * @param {string} content - Message content
 * @returns {Promise<any>}
 */
async function sendTextDirect(client, to, content) {
    if (!client) {
        throw new Error('WhatsApp client not available');
    }
    
    return await client.sendMessage(to, { text: content });
}

module.exports = {
    sendTextDirect
};
