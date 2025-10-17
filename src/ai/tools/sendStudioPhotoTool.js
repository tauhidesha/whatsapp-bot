// File: src/ai/tools/sendStudioPhotoTool.js
// Mengirim foto eksterior studio Bosmat ke pelanggan melalui WhatsApp.

const path = require('path');
const fs = require('fs');
const { z } = require('zod');
const { sendMetaAttachment } = require('../../server/metaClient.js');

const sendStudioPhotoSchema = z.object({
  caption: z.string().min(1).max(500).optional(),
  senderNumber: z.string().optional(),
});

const DEFAULT_CAPTION = 'Studio Bosmat: rumah hijau No. B3/2 dekat portal Jl. Medan. Silakan masuk ke garasi depan.';
const STUDIO_PHOTO_PATH = path.resolve(__dirname, '../../../data/45e8f69d-f540-41c4-b6c6-9d65463007f8.JPG');
const SUPPORTED_META_CHANNELS = new Set(['instagram', 'messenger']);

function parseRecipientIdentity(rawValue) {
  const trimmed = (rawValue || '').trim();
  if (!trimmed) {
    return { channel: null, recipientId: null, raw: rawValue };
  }

  if (trimmed.includes(':')) {
    const [channelPart, ...rest] = trimmed.split(':');
    const channelRaw = (channelPart || '').trim().toLowerCase();
    const identifier = rest.join(':').trim();

    if (!channelRaw || !identifier) {
      throw new Error('[sendStudioPhoto] senderNumber tidak valid.');
    }

    if (channelRaw === 'wa' || channelRaw === 'whatsapp') {
      const normalized = identifier.endsWith('@c.us') ? identifier : `${identifier}@c.us`;
      return { channel: 'whatsapp', recipientId: normalized, raw: trimmed };
    }

    return { channel: channelRaw, recipientId: identifier, raw: trimmed };
  }

  const normalized = trimmed.endsWith('@c.us') ? trimmed : `${trimmed}@c.us`;
  return { channel: 'whatsapp', recipientId: normalized, raw: trimmed };
}

async function ensurePhotoExists() {
  try {
    await fs.promises.access(STUDIO_PHOTO_PATH, fs.constants.R_OK);
  } catch (error) {
    throw new Error('[sendStudioPhoto] Foto studio tidak ditemukan di folder data.');
  }
}

async function implementation(input = {}) {
  const parsed = sendStudioPhotoSchema.parse(input);
  const senderNumberRaw = parsed.senderNumber || input.recipient || null;
  const identity = parseRecipientIdentity(senderNumberRaw);

  if (!identity.channel || !identity.recipientId) {
    throw new Error('[sendStudioPhoto] senderNumber wajib tersedia untuk mengirim foto.');
  }

  await ensurePhotoExists();

  const caption = parsed.caption && parsed.caption.trim().length > 0 ? parsed.caption.trim() : DEFAULT_CAPTION;

  if (identity.channel === 'whatsapp') {
    const client = global.whatsappClient;
    if (!client || typeof client.sendImage !== 'function') {
      throw new Error('[sendStudioPhoto] WhatsApp client belum siap.');
    }

    await client.sendImage(identity.recipientId, STUDIO_PHOTO_PATH, 'bosmat-studio.jpg', caption);

    return {
      success: true,
      message: 'Foto studio berhasil dikirim.',
      data: {
        senderNumber: identity.recipientId,
        channel: 'whatsapp',
        caption,
        imagePath: STUDIO_PHOTO_PATH,
      },
    };
  }

  if (SUPPORTED_META_CHANNELS.has(identity.channel)) {
    await sendMetaAttachment(
      identity.channel,
      identity.recipientId,
      STUDIO_PHOTO_PATH,
      {
        caption,
        filename: 'bosmat-studio.jpg',
        mimetype: 'image/jpeg',
        type: 'image',
      },
      console,
    );

    return {
      success: true,
      message: 'Foto studio berhasil dikirim.',
      data: {
        senderNumber: `${identity.channel}:${identity.recipientId}`,
        channel: identity.channel,
        caption,
        imagePath: STUDIO_PHOTO_PATH,
      },
    };
  }

  throw new Error(`[sendStudioPhoto] Kanal ${identity.channel} belum didukung untuk pengiriman foto studio.`);
}

const sendStudioPhotoTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'sendStudioPhoto',
      description: 'Kirim foto eksterior Bosmat Studio (rumah hijau B3/2 dekat portal Jl. Menda) ke pelanggan via WhatsApp. Gunakan saat pelanggan sulit menemukan lokasi.',
      parameters: {
        type: 'object',
        properties: {
          caption: {
            type: 'string',
            description: 'Caption opsional yang akan disertakan bersama foto.',
          },
        },
      },
    },
  },
  implementation,
};

module.exports = { sendStudioPhotoTool };
