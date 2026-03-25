const fetch = require('node-fetch');

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_GLOBAL_KEY = process.env.AUTHENTICATION_API_KEY || 'BOSMAT_STUDIO_LOKAL_KEY_123';
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'BosmatStudio';

async function sendEvolutionText(targetNumber, text) {
    const cleanNumber = targetNumber.split('@')[0];
    const url = `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': EVOLUTION_GLOBAL_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: cleanNumber,
                text: text,
                delay: 1200
            })
        });
        return await response.json();
    } catch (e) {
        console.error('[Evolution API] Error sending text:', e);
        throw e;
    }
}

async function sendEvolutionMedia(targetNumber, base64, mimetype, caption = '') {
    const cleanNumber = targetNumber.split('@')[0];
    const url = `${EVOLUTION_API_URL}/message/sendMedia/${INSTANCE_NAME}`;
    
    // Clean raw base64 payload if it has the data:image prefix
    let rawBase64 = base64;
    if (base64.startsWith('data:')) {
        rawBase64 = base64.split(',')[1];
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': EVOLUTION_GLOBAL_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: cleanNumber,
                media: rawBase64,
                mediatype: mimetype.startsWith('video') ? 'video' : 'image',
                mimetype: mimetype,
                caption: caption
            })
        });
        return await response.json();
    } catch (e) {
        console.error('[Evolution API] Error sending media:', e);
        throw e;
    }
}

module.exports = {
    sendEvolutionText,
    sendEvolutionMedia
};
