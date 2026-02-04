// File: src/ai/tools/sendMessageTool.js
const { z } = require('zod');
const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');
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

      let target = destination.trim();
      // Heuristik: LID biasanya berupa angka panjang (>15 digit), sedangkan nomor HP biasanya <15 digit
      // Tambahan: Pastikan tidak diawali '62' agar nomor HP panjang tidak dianggap LID
      const isLikelyLid = /^\d{15,}$/.test(target) && !target.startsWith('62');

      if (target.endsWith('@lid')) {
        // Sudah format LID, biarkan
      } else if (isLikelyLid && !target.endsWith('@c.us')) {
        target = `${target}@lid`;
      } else {
        target = normalizeWhatsappNumber(destination);
      }

      if (!target) {
        return {
          success: false,
          message: `Nomor tujuan tidak valid: ${destination}`,
        };
      }

      await client.sendText(target, message);

      // --- Simpan ke Firestore agar AI punya konteks ---
      try {
        const db = getFirebaseAdmin().firestore();
        // Hapus suffix @c.us untuk mendapatkan docId standar
        const docId = target.replace(/@c\.us$|@lid$/, '');
        const timestamp = admin.firestore.FieldValue.serverTimestamp();

        // 1. Simpan di subcollection messages
        await db.collection('directMessages').doc(docId).collection('messages').add({
          text: message,
          sender: 'admin', // Ditandai 'admin' karena dikirim manual/via tool
          timestamp: timestamp,
        });

        // 2. Update metadata percakapan
        await db.collection('directMessages').doc(docId).set({
          lastMessage: message,
          lastMessageSender: 'admin',
          lastMessageAt: timestamp,
          updatedAt: timestamp,
          messageCount: admin.firestore.FieldValue.increment(1),
        }, { merge: true });
      } catch (err) {
        console.warn('[sendMessageTool] Gagal menyimpan pesan ke Firestore:', err.message);
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
