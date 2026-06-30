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
    
    console.log(`[Baileys] Attempting to send message to: ${to}`);
    try {
        const result = await client.sendMessage(to, { text: content });
        // Hanya log status dasar agar tidak terlalu panjang di console
        console.log(`[Baileys] Successfully sent message to ${to}. Status: ${result?.status || 'SENT'}`);
        return result;
    } catch (err) {
        console.error(`[Baileys] ERROR sending message to ${to}:`, err.message || err);
        throw err;
    }
}

module.exports = {
    sendTextDirect
};
