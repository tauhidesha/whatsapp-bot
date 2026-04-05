// File: src/ai/tools/sendMessageTool.js
const { z } = require('zod');
const prisma = require('../../lib/prisma');
const { isAdmin } = require('../utils/adminAuth.js');
const { markBotMessage } = require('../utils/adminMessageSync.js');

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

      let target = destination.trim();

      // If it's just numbers, add @c.us
      if (!target.includes('@')) {
        let digits = target.replace(/\D/g, '');
        if (digits.startsWith('0')) digits = '62' + digits.slice(1);
        target = `${digits}@c.us`;
      }

      // Auto-fix: if target (from manual input or AI) matches a known LID, use that
      try {
        const phoneDigits = target.replace(/@c\.us$|@lid$/, '').replace(/\D/g, '');
        const customer = await prisma.customer.findFirst({
          where: { whatsappLid: { contains: phoneDigits } },
          select: { whatsappLid: true }
        });
        if (customer?.whatsappLid) {
          target = customer.whatsappLid;
        }
      } catch (e) {}

      if (!target) {
        return {
          success: false,
          message: `Nomor tujuan tidak valid: ${destination}`,
        };
      }

      // Mark pesan agar onAnyMessage tidak trigger auto-snooze
      markBotMessage(target, message);
      await client.sendText(target, message);

      // --- Simpan ke Prisma agar AI punya konteks ---
      try {
        const normalizedPhone = target.replace(/@c\.us$|@lid$/, '').replace(/\D/g, '');
        
        // Find or create customer
        let customer = await prisma.customer.findUnique({
          where: { phone: normalizedPhone }
        });

        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              phone: normalizedPhone,
              name: normalizedPhone,
              status: 'new'
            }
          });
        }

        // 1. Simpan message
        await prisma.directMessage.create({
          data: {
            customerId: customer.id,
            senderId: target,
            role: 'admin',
            content: message
          }
        });

        // 2. Update metadata customer
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            lastMessage: message,
            lastMessageAt: new Date()
          }
        });

      } catch (err) {
        console.warn('[sendMessageTool] Gagal menyimpan pesan ke Prisma:', err.message);
      }

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