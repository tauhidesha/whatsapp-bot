/**
 * Progress Sender — Zoya Motor Progress Update Delivery
 *
 * Sends motor progress photos/videos directly to a customer's WhatsApp
 * as native media (not links), with a Zoya-style caption composed by LLM.
 *
 * Flow:
 *   1. Load ProgressUpdate from DB
 *   2. Compose Zoya-style caption via Gemini (paraphrase admin caption)
 *   3. Download each media from Cloudinary URL as buffer
 *   4. Send via global.whatsappClient.sendFile()
 *   5. Mark progressUpdate.sentAt = now()
 */

const prisma      = require('../../lib/prisma');
const fetch       = require('node-fetch');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');

// MIME type helpers
const MIME_MAP = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif',
    mp4: 'video/mp4', mov: 'video/quicktime', mpeg: 'video/mpeg',
};

function getMimeFromUrl(url) {
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    return MIME_MAP[ext] || 'image/jpeg';
}

function buildDataUri(buffer, mimeType) {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * Download a file from a URL into a Buffer.
 */
async function downloadBuffer(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
}

/**
 * Compose a Zoya-style caption from the admin's raw caption.
 * Zoya is casual, warm, and uses informal Indonesian (like texting a friend).
 */
async function composeZoyaCaption(adminCaption, bookingService) {
    if (!adminCaption) {
        // Generic progress message if no caption given
        return `update progress motornya ya! 😊 kalau ada pertanyaan langsung hubungi kita aja!`;
    }

    try {
        const llm = new ChatGoogleGenerativeAI({
            model: process.env.AI_MODEL || 'gemini-1.5-flash-latest',
            temperature: 0.7,
            maxOutputTokens: 256,
            apiKey: process.env.GOOGLE_API_KEY,
        });

        const systemPrompt = `Kamu adalah Zoya, asisten Bosmat Repaint Studio yang ramah dan casual.
Tugasmu: Tulis ulang update progress pengerjaan motor dari admin dalam gaya bahasa ZOYA yang:
- Casual, hangat, seperti teman texting
- Pakai bahasa Indonesia informal / gaul (tapi jangan lebay)
- Boleh pakai 1-2 emoji yang relevan
- JANGAN ubah fakta teknis / informasi yang disampaikan admin
- Maksimal 3 kalimat
- JANGAN mulai dengan sapaan formal`;

        const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(`Layanan: ${bookingService || 'Repaint'}\nUpdate admin: "${adminCaption}"\n\nTulis ulang dalam gaya Zoya:`)
        ]);

        const text = typeof response.content === 'string'
            ? response.content
            : response.content?.[0]?.text || adminCaption;

        return text.trim();
    } catch (err) {
        console.error('[progressSender] LLM caption failed, using raw caption:', err.message);
        return adminCaption;
    }
}

/**
 * Send a progress update to a customer's WhatsApp.
 *
 * @param {string} progressId  - DB ProgressUpdate ID
 * @param {string} phone       - Customer phone (e.g. '6281234567890')
 * @returns {Promise<{success: boolean, sent: number, error?: string}>}
 */
async function sendProgressUpdate(progressId, phone) {
    if (!global.whatsappClient) {
        throw new Error('WhatsApp client not connected');
    }

    // Load progress update + booking info
    const update = await prisma.progressUpdate.findUnique({
        where: { id: progressId },
        include: {
            booking: {
                select: { serviceType: true, vehicleModel: true, customerName: true }
            }
        }
    });

    if (!update) throw new Error(`ProgressUpdate ${progressId} not found`);
    if (!update.mediaUrls || update.mediaUrls.length === 0) {
        throw new Error('No media URLs in this progress update');
    }

    const booking = update.booking;
    const serviceLabel = booking?.serviceType?.split('\n')[0] || 'Pengerjaan Motor';

    // Compose Zoya-style caption
    const zoyaCaption = await composeZoyaCaption(update.caption, serviceLabel);
    console.log(`[progressSender] Composed caption: "${zoyaCaption}"`);

    // Normalize phone (add @s.whatsapp.net if needed)
    const toJid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    let sentCount = 0;
    const errors = [];

    for (let i = 0; i < update.mediaUrls.length; i++) {
        const url      = update.mediaUrls[i];
        const resType  = (update.mediaTypes?.[i] || 'image').toLowerCase();
        const mimeType = getMimeFromUrl(url) || (resType === 'video' ? 'video/mp4' : 'image/jpeg');
        const isVideo  = resType === 'video' || mimeType.startsWith('video');

        try {
            console.log(`[progressSender] Downloading media ${i + 1}/${update.mediaUrls.length}: ${url}`);
            const buffer  = await downloadBuffer(url);
            const dataUri = buildDataUri(buffer, mimeType);

            // Only attach caption to the LAST media item (or first if only one)
            const captionForThis = (i === update.mediaUrls.length - 1) ? zoyaCaption : '';
            const filename = isVideo ? `progress_${i + 1}.mp4` : `progress_${i + 1}.jpg`;

            await global.whatsappClient.sendFile(toJid, dataUri, filename, captionForThis);
            sentCount++;

            // Small delay between media to avoid WA rate limits
            if (i < update.mediaUrls.length - 1) {
                await new Promise(r => setTimeout(r, 800));
            }
        } catch (err) {
            console.error(`[progressSender] Failed to send media ${i + 1}:`, err.message);
            errors.push(`Media ${i + 1}: ${err.message}`);
        }
    }

    // Mark as sent if at least one was delivered
    if (sentCount > 0) {
        await prisma.progressUpdate.update({
            where: { id: progressId },
            data: { sentAt: new Date() }
        });
        console.log(`[progressSender] Marked progress ${progressId} as sent (${sentCount}/${update.mediaUrls.length} delivered)`);
    }

    return {
        success: sentCount > 0,
        sent: sentCount,
        total: update.mediaUrls.length,
        errors: errors.length > 0 ? errors : undefined,
    };
}

module.exports = { sendProgressUpdate, composeZoyaCaption };
