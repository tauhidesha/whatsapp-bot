// File: src/ai/tools/sendStudioPhotoTool.js
// Mengirim foto eksterior studio Bosmat ke pelanggan melalui WhatsApp.

const path = require('path');
const fs = require('fs');
const { z } = require('zod');

const sendStudioPhotoSchema = z.object({
  caption: z.string().min(1).max(500).optional(),
  senderNumber: z.string().optional(),
});

const DEFAULT_CAPTION = 'Studio Bosmat: rumah hijau No. B3/2 dekat portal Jl. Medan. Silakan masuk ke garasi depan.';
const STUDIO_PHOTO_PATH = path.resolve(__dirname, '../../../data/45e8f69d-f540-41c4-b6c6-9d65463007f8.JPG');

function normalizeWhatsappId(value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes(':')) {
    throw new Error('[sendStudioPhoto] Kanal ini belum mendukung pengiriman foto studio otomatis.');
  }
  return trimmed.endsWith('@c.us') ? trimmed : `${trimmed}@c.us`;
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
  const senderNumber = normalizeWhatsappId(senderNumberRaw);

  if (!senderNumber) {
    throw new Error('[sendStudioPhoto] senderNumber wajib tersedia untuk mengirim foto.');
  }

  await ensurePhotoExists();

  const client = global.whatsappClient;
  if (!client || typeof client.sendImage !== 'function') {
    throw new Error('[sendStudioPhoto] WhatsApp client belum siap.');
  }

  const caption = parsed.caption && parsed.caption.trim().length > 0 ? parsed.caption.trim() : DEFAULT_CAPTION;

  await client.sendImage(senderNumber, STUDIO_PHOTO_PATH, 'bosmat-studio.jpg', caption);

  return {
    success: true,
    message: 'Foto studio berhasil dikirim.',
    data: {
      senderNumber,
      caption,
      imagePath: STUDIO_PHOTO_PATH,
    },
  };
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
