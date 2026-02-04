// File: src/ai/tools/readDirectMessagesTool.js
const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');

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

function ensureFirestore() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  // Gunakan helper jika ada, atau fallback ke admin default
  try {
    return getFirebaseAdmin().firestore();
  } catch (e) {
    return admin.firestore();
  }
}

const readDirectMessagesTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'readDirectMessages',
      description: 'KHUSUS ADMIN. Membaca database pesan (directMessages) di Firestore. Bisa melihat daftar percakapan terbaru atau detail chat dengan nomor tertentu.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list_recent', 'read_conversation'],
            description: 'Pilih "list_recent" untuk melihat daftar chat aktif terakhir, atau "read_conversation" untuk membaca isi chat dengan orang tertentu.'
          },
          targetNumber: {
            type: 'string',
            description: 'Nomor WA target (hanya jika action="read_conversation"). Contoh: "08123456789".'
          },
          days: {
            type: 'number',
            description: 'Filter berapa hari ke belakang (untuk list_recent). Default 7 hari.'
          },
          limit: {
            type: 'number',
            description: 'Jumlah maksimal data yang diambil. Default 10.'
          },
          senderNumber: {
            type: 'string',
            description: 'Nomor pengirim (otomatis diisi sistem).'
          }
        },
        required: ['action', 'senderNumber']
      }
    }
  },
  implementation: async (input) => {
    const { action, targetNumber, days = 7, limit = 10, senderNumber } = input;

    // 1. Security Check
    if (!isAdmin(senderNumber)) {
      return {
        success: false,
        message: "⛔ Akses Ditolak. Tool ini hanya untuk Admin."
      };
    }

    const db = ensureFirestore();

    try {
      if (action === 'list_recent') {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const snapshot = await db.collection('directMessages')
          .where('updatedAt', '>=', admin.firestore.Timestamp.fromDate(cutoffDate))
          .orderBy('updatedAt', 'desc')
          .limit(limit)
          .get();

        if (snapshot.empty) {
          return { success: true, message: `Tidak ada percakapan aktif dalam ${days} hari terakhir.` };
        }

        const conversations = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          
          // Fix: Jika di Firestore @lid hilang (hanya ID angka panjang), kita format ulang
          let senderId = data.fullSenderId || doc.id;
          if (!data.fullSenderId && /^\d{15,}$/.test(doc.id) && !doc.id.startsWith('62')) {
            senderId = `${doc.id}@lid`;
          }

          conversations.push({
            number: senderId,
            name: data.name || 'Tanpa Nama',
            lastMessage: data.lastMessage || '-',
            time: data.updatedAt ? data.updatedAt.toDate().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-'
          });
        });

        // Format output agar mudah dibaca AI
        const summaryList = conversations.map((c, i) => 
          `${i+1}. ${c.name} (${c.number})\n   🕒 ${c.time}\n   💬 "${c.lastMessage.substring(0, 50)}..."`
        ).join('\n\n');

        return {
          success: true,
          data: conversations,
          formattedResponse: `Daftar ${conversations.length} percakapan terakhir (${days} hari):\n\n${summaryList}`
        };

      } else if (action === 'read_conversation') {
        if (!targetNumber) {
          return { success: false, message: 'targetNumber wajib diisi untuk membaca percakapan.' };
        }

        // Normalisasi nomor target (hapus karakter non-digit)
        let cleanTarget = targetNumber.replace(/\D/g, '');
        // Konversi 08xx ke 628xx jika perlu, asumsi standar ID
        if (cleanTarget.startsWith('08')) {
          cleanTarget = '62' + cleanTarget.slice(1);
        }
        
        const docId = cleanTarget; 
        
        const messagesRef = db.collection('directMessages').doc(docId).collection('messages');
        const snapshot = await messagesRef
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();

        if (snapshot.empty) {
          return { success: true, message: `Belum ada riwayat pesan tersimpan dengan ID: ${docId}.` };
        }

        const messages = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          messages.push({
            sender: data.sender, // 'user', 'ai', 'admin'
            text: data.text,
            time: data.timestamp ? data.timestamp.toDate().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-'
          });
        });

        // Urutkan dari lama ke baru untuk pembacaan
        const sortedMessages = messages.reverse();
        
        const chatLog = sortedMessages.map(m => 
          `[${m.time}] ${m.sender.toUpperCase()}: ${m.text}`
        ).join('\n');

        return {
          success: true,
          target: cleanTarget,
          formattedResponse: `Riwayat chat dengan ${cleanTarget} (${limit} pesan terakhir):\n\n${chatLog}`
        };
      }

      return { success: false, message: 'Action tidak dikenali.' };

    } catch (error) {
      console.error('[readDirectMessages] Error:', error);
      return { success: false, message: `Error database: ${error.message}` };
    }
  }
};

module.exports = { readDirectMessagesTool };