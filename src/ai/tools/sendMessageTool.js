// File: src/ai/tools/sendMessageTool.js
const { z } = require('zod');
const { normalizeWhatsappNumber } = require('../utils/humanHandover.js');

// Helper untuk memvalidasi apakah pengirim adalah admin
function isAdmin(senderNumber) {
  const adminNumbers = [
    process.env.BOSMAT_ADMIN_NUMBER,
    process.env.ADMIN_WHATSAPP_NUMBER
  ].filter(Boolean);

  if (!senderNumber || adminNumbers.length === 0) return false;

  // Normalisasi: hapus karakter non-digit dan suffix @c.us
  const normalize = (n) => n.toString().replace(/\D/g, '');
  const sender = normalize(senderNumber);
  
  return adminNumbers.some(admin => normalize(admin) === sender);
}

const sendMessageSchema = z.object({
  destination: z.string().describe('Nomor tujuan (contoh: 08123456789)'),
  message: z.string().describe('Isi pesan yang akan dikirim'),
  senderNumber: z.string().optional().describe('Nomor pengirim (otomatis diisi sistem)'),
});

const sendMessageTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'sendMessage',
      description: 'KHUSUS ADMIN. Mengirim pesan WhatsApp ke nomor tertentu. Gunakan ini jika admin meminta mengirim pesan ke orang lain.',
      parameters: {
        type: 'object',
        properties: {
          destination: {
            type: 'string',
            description: 'Nomor tujuan (contoh: 08123456789)',
          },
          message: {
            type: 'string',
            description: 'Isi pesan yang akan dikirim',
          },
        },
        required: ['destination', 'message'],
      },
    },
  },
  implementation: async (input) => {
    try {
      const { destination, message, senderNumber } = sendMessageSchema.parse(input);

      // 1. Security Check
      if (!isAdmin(senderNumber)) {
        return {
          success: false,
          message: "⛔ Akses Ditolak. Tool ini hanya untuk Admin."
        };
      }

      const client = global.whatsappClient;
      if (!client) {
        return {
          success: false,
          message: 'WhatsApp client belum siap.',
        };
      }

      const target = normalizeWhatsappNumber(destination);
      if (!target) {
        return {
          success: false,
          message: `Nomor tujuan tidak valid: ${destination}`,
        };
      }

      await client.sendText(target, message);

      return {
        success: true,
        message: `Pesan berhasil dikirim ke ${destination}`,
        sentMessage: message
      };

    } catch (error) {
      console.error('[sendMessageTool] Error:', error);
      return { success: false, message: `Gagal mengirim pesan: ${error.message}` };
    }
  }
};

module.exports = { sendMessageTool };
