// File: src/ai/tools/generateColorMockupTool.js
// Generate AI color mockup of a motorcycle using Gemini image generation.
// Sends the generated image to the customer via WhatsApp.
// NOTE: @google/genai is lazy-loaded to prevent app crash if not installed.

const { z } = require('zod');
const { markBotMessage } = require('../utils/adminMessageSync.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

const inputSchema = z.object({
  motorModel: z.string().describe('Tipe motor (e.g. Vario 125, Nmax, Scoopy)'),
  bodyColor: z.string().optional().describe('Warna bodi halus yang diminta'),
  velgColor: z.string().optional().describe('Warna velg yang diminta'),
  senderNumber: z.string().describe('Nomor WA penerima'),
});

/**
 * Build an optimized prompt for motorcycle color mockup generation.
 */
function buildMockupPrompt(motorModel, bodyColor, velgColor) {
  const parts = [
    `Professional automotive studio photograph of a ${motorModel} motorcycle scooter.`,
  ];

  if (bodyColor && velgColor) {
    parts.push(
      `The entire body panels (bodi halus) are custom repainted in ${bodyColor} color.`,
      `The wheels/rims (velg) are custom painted in ${velgColor} color.`
    );
  } else if (bodyColor) {
    parts.push(
      `The entire body panels (bodi halus) are custom repainted in ${bodyColor} color.`
    );
  } else if (velgColor) {
    parts.push(
      `The wheels/rims (velg) are custom painted in ${velgColor} color.`
    );
  }

  parts.push(
    '3/4 front angle view, clean white cyclorama background,',
    'professional studio lighting, photorealistic rendering,',
    'high quality, sharp details, no text overlay, no watermark, no human.'
  );

  return parts.join(' ');
}

/**
 * Generate a color mockup image using Gemini API.
 * Returns { success, tempPath, caption } or throws on failure.
 */
async function generateMockupImage(motorModel, bodyColor, velgColor) {
  const apiKey = process.env.IMAGEN_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('[generateColorMockup] GOOGLE_API_KEY tidak ditemukan.');
  }

  // Lazy-load to prevent crash if @google/genai is not installed
  const { GoogleGenAI } = require('@google/genai');

  const client = new GoogleGenAI({ apiKey });
  const prompt = buildMockupPrompt(motorModel, bodyColor, velgColor);
  console.log(`[generateColorMockup] Prompt: ${prompt}`);

  // Imagen 4 uses generateImages() API, NOT generateContent()
  const response = await client.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: '3:4',
      includeRaiReason: true,
    },
  });

  // Extract image from Imagen response
  const images = response?.generatedImages || [];
  if (images.length === 0 || !images[0]?.image?.imageBytes) {
    const raiReason = images[0]?.raiFilteredReason;
    throw new Error(`[generateColorMockup] Imagen tidak mengembalikan gambar.${raiReason ? ` RAI: ${raiReason}` : ''}`);
  }

  const base64Data = images[0].image.imageBytes;
  const ext = 'png';

  // Save to temp file for WA sending
  const tempDir = path.join(os.tmpdir(), 'zoya-mockups');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, `mockup_${Date.now()}.${ext}`);
  fs.writeFileSync(tempPath, Buffer.from(base64Data, 'base64'));

  // Build caption
  const colorDesc = [];
  if (bodyColor) colorDesc.push(`bodi ${bodyColor}`);
  if (velgColor) colorDesc.push(`velg ${velgColor}`);
  const caption = `🎨 Preview AI Mockup: ${motorModel} — ${colorDesc.join(' + ')}\n⚠️ Ini preview AI ya kak, hasil asli bisa sedikit berbeda tergantung kondisi motor.`;

  return { tempPath, caption, ext };
}

/**
 * Send the mockup image via WhatsApp (follows sendStudioPhotoTool pattern).
 */
async function sendMockupViaWA(senderNumber, tempPath, caption) {
  // Parse recipient (same logic as sendStudioPhotoTool)
  let recipientId = senderNumber;
  if (!recipientId.endsWith('@lid') && !recipientId.endsWith('@c.us')) {
    recipientId = `${recipientId.replace(/\D/g, '')}@c.us`;
  }

  const client = global.whatsappClient;
  if (!client || typeof client.sendImage !== 'function') {
    throw new Error('[generateColorMockup] WhatsApp client belum siap.');
  }

  const filename = path.basename(tempPath);
  markBotMessage(recipientId, caption);
  await client.sendImage(recipientId, tempPath, filename, caption);

  // Cleanup temp file after sending
  try { fs.unlinkSync(tempPath); } catch (_) { /* ignore */ }
}

/**
 * Main implementation function.
 */
async function implementation(input = {}) {
  const startTime = Date.now();

  try {
    let parsedInput = input;
    if (typeof parsedInput === 'string') {
      parsedInput = JSON.parse(parsedInput);
    }

    const validated = inputSchema.parse(parsedInput);
    const { motorModel, bodyColor, velgColor, senderNumber } = validated;

    if (!bodyColor && !velgColor) {
      return { success: false, message: 'Minimal satu warna (bodi atau velg) harus diisi.' };
    }

    if (!senderNumber) {
      return { success: false, message: 'senderNumber wajib tersedia.' };
    }

    console.log(`[generateColorMockup] Generating mockup for ${motorModel} | body=${bodyColor || '-'} | velg=${velgColor || '-'}`);

    // Generate image
    const { tempPath, caption } = await generateMockupImage(motorModel, bodyColor, velgColor);

    // Send via WhatsApp
    await sendMockupViaWA(senderNumber, tempPath, caption);

    const elapsed = Date.now() - startTime;
    console.log(`[generateColorMockup] ✅ Mockup sent in ${elapsed}ms`);

    return {
      success: true,
      message: `Mockup ${motorModel} berhasil digenerate dan dikirim.`,
      data: {
        motorModel,
        bodyColor: bodyColor || null,
        velgColor: velgColor || null,
        generationTimeMs: elapsed,
      },
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[generateColorMockup] ❌ Error after ${elapsed}ms:`, error.message);
    return {
      success: false,
      message: `Gagal generate mockup: ${error.message}`,
    };
  }
}

const generateColorMockupTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'generateColorMockup',
      description: 'Generate AI mockup preview motor dengan warna pilihan customer. Kirim gambar via WhatsApp.',
      parameters: {
        type: 'object',
        properties: {
          motorModel: {
            type: 'string',
            description: 'Tipe motor (e.g. Vario 125, Nmax, Scoopy)',
          },
          bodyColor: {
            type: 'string',
            description: 'Warna bodi halus yang diminta',
          },
          velgColor: {
            type: 'string',
            description: 'Warna velg yang diminta',
          },
        },
        required: ['motorModel'],
      },
    },
  },
  implementation,
};

module.exports = { generateColorMockupTool };
