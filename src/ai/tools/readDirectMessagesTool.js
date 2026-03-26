// File: src/ai/tools/readDirectMessagesTool.js
const prisma = require('../../lib/prisma');
const { isAdmin } = require('../utils/adminAuth.js');


const readDirectMessagesTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'readDirectMessages',
      description: 'Baca pesan: list_recent (daftar chat aktif) atau read_conversation (isi chat nomor tertentu).',
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

    try {
      if (action === 'list_recent') {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const customers = await prisma.customer.findMany({
          where: {
            updatedAt: { gte: cutoffDate }
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        });

        if (customers.length === 0) {
          return { success: true, message: `Tidak ada percakapan aktif dalam ${days} hari terakhir.` };
        }

        const conversations = customers.map(c => {
          const lastMessage = c.messages[0];
          return {
            number: c.phone + '@c.us',
            name: c.name || 'Tanpa Nama',
            lastMessage: lastMessage?.content || '-',
            time: c.updatedAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
          };
        });

        // Format output agar mudah dibaca AI
        const summaryList = conversations.map((c, i) =>
          `${i + 1}. ${c.name} (${c.number})\n   🕒 ${c.time}\n   💬 "${c.lastMessage.substring(0, 50)}..."`
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

        // Find customer
        const customer = await prisma.customer.findUnique({
          where: { phone: cleanTarget },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: limit
            }
          }
        });

        if (!customer || customer.messages.length === 0) {
          return { success: true, message: `Belum ada riwayat pesan tersimpan dengan nomor: ${cleanTarget}.` };
        }

        // Urutkan dari lama ke baru
        const sortedMessages = customer.messages.reverse();

        const chatLog = sortedMessages.map(m =>
          `[${m.createdAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] ${m.role.toUpperCase()}: ${m.content}`
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