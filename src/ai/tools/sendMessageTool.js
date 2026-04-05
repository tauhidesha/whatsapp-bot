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

      let target = getIdentifier(destination) || destination;

      // Auto-fix: if target (from manual input or AI) matches a known LID, use that
      try {
        const phone = target.replace(/@c\.us$|@lid$/, '');
        const customer = await prisma.customer.findFirst({
          where: { 
            OR: [
              { whatsappLid: target },
              { whatsappLid: phone },
              { phone: target },
              { phone: phone }
            ]
          },
          select: { whatsappLid: true, phone: true }
        });
        if (customer?.whatsappLid) {
          target = customer.whatsappLid;
        } else if (customer?.phone && customer.phone.includes('@')) {
          target = customer.phone;
        }
      } catch (e) {}

      if (!target) {
        return {
          success: false,
          message: `Nomor tujuan tidak valid: ${destination}`,
        };
      }

      // Auto-fix WID suffix: WPPConnect requires @c.us or @lid
      if (typeof target === 'string' && !target.includes('@')) {
        let cleaned = target.replace(/\D/g, '');
        if (cleaned.startsWith('0')) {
          cleaned = '62' + cleaned.substring(1);
        }
        target = cleaned + '@c.us';
      }

      // Mark pesan agar onAnyMessage tidak trigger auto-snooze
      markBotMessage(target, message);
      try {
        await client.sendText(target, message);
      } catch (initialError) {
        if (initialError.message && initialError.message.includes('No LID')) {
          console.warn(`[sendMessageTool] Send failed with No LID for: ${target}`);
          const cleanPhone = target.replace(/@c\.us$|@lid$/, '');
          const customerFallback = await prisma.customer.findFirst({
            where: {
              OR: [
                { whatsappLid: target },
                { whatsappLid: cleanPhone },
                { phone: target },
                { phone: cleanPhone }
              ]
            },
            select: { phone: true, whatsappLid: true }
          });

          let fallbackTarget = null;
          if (target.endsWith('@c.us') && customerFallback?.whatsappLid) {
            fallbackTarget = customerFallback.whatsappLid;
          } else if (target.endsWith('@lid') && customerFallback?.phone) {
            fallbackTarget = customerFallback.phone.includes('@') ? customerFallback.phone : `${customerFallback.phone}@c.us`;
          }

          if (fallbackTarget && fallbackTarget !== target) {
            console.log(`[sendMessageTool] Retrying with fallback: ${fallbackTarget}`);
            markBotMessage(fallbackTarget, message);
            await client.sendText(fallbackTarget, message);
            // Update target parameter so that subsequent Prisma commands use the correct identifier
            target = fallbackTarget;
          } else {
            throw initialError;
          }
        } else {
          throw initialError;
        }
      }

      // --- Simpan ke Prisma agar AI punya konteks ---
      try {
        const phone = target.replace(/@c\.us$|@lid$/, '');
        
        // Find or create customer
        let customer = await prisma.customer.findFirst({
          where: { 
            OR: [
              { phone: phone },
              { whatsappLid: target }
            ]
          }
        });

        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              phone: phone,
              name: phone,
              status: 'new',
              whatsappLid: target.endsWith('@lid') ? target : undefined
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