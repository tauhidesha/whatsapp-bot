// File: src/ai/tools/financeManagementTool.js
const { z } = require('zod');
const admin = require('firebase-admin');
const { getFirebaseAdmin } = require('../../lib/firebaseAdmin.js');

function ensureFirestore() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return getFirebaseAdmin().firestore();
}

const TransactionTypeEnum = z.enum(['income', 'expense']);

const addTransactionSchema = z.object({
  type: TransactionTypeEnum.describe("Tipe transaksi: 'income' (pemasukan) atau 'expense' (pengeluaran)."),
  amount: z.number().positive().describe('Nominal transaksi dalam rupiah (IDR), tanpa titik/koma pemisah.'),
  category: z
    .string()
    .min(1)
    .describe("Kategori, contoh: 'repaint', 'detailing', 'sparepart', 'listrik', 'gaji', dll."),
  description: z
    .string()
    .min(1)
    .describe('Deskripsi singkat transaksi (boleh bahasa natural).'),
  paymentMethod: z
    .string()
    .min(1)
    .describe("Metode pembayaran, contoh: 'cash', 'transfer', 'qris'."),
  date: z
    .string()
    .optional()
    .describe('Tanggal transaksi dalam ISO string (opsional). Jika kosong, pakai waktu server sekarang.'),
});

const getTransactionHistorySchema = z.object({
  fromDate: z
    .string()
    .optional()
    .describe('Tanggal awal (ISO). Jika kosong, default 30 hari ke belakang dari hari ini.'),
  toDate: z
    .string()
    .optional()
    .describe('Tanggal akhir (ISO). Jika kosong, default hari ini.'),
  type: TransactionTypeEnum.optional().describe("Filter tipe transaksi: 'income' atau 'expense' (opsional)."),
  category: z.string().optional().describe('Filter kategori spesifik (opsional).'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe('Batas jumlah transaksi yang diambil (default 100, max 500).'),
});

const calculateFinancesSchema = z.object({
  fromDate: z
    .string()
    .optional()
    .describe('Tanggal awal periode (ISO). Jika kosong, gunakan awal bulan berjalan.'),
  toDate: z
    .string()
    .optional()
    .describe('Tanggal akhir periode (ISO). Jika kosong, gunakan akhir bulan berjalan (hari ini).'),
  period: z
    .enum(['day', 'week', 'month'])
    .optional()
    .describe(
      "Periode ringkas untuk laporan: 'day' (hari ini), 'week' (7 hari terakhir), 'month' (bulan berjalan). Akan override fromDate/toDate jika diisi.",
    ),
});

function formatCurrencyIDR(amount) {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(Math.round(amount));
  } catch {
    return `${amount} IDR`;
  }
}

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getDefaultRangeFromPeriod(period) {
  const now = new Date();
  let from;
  let to;

  if (period === 'day') {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
    to = new Date(now);
    to.setHours(23, 59, 59, 999);
  } else if (period === 'week') {
    to = new Date(now);
    to.setHours(23, 59, 59, 999);
    from = new Date(to);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  } else {
    // default month
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { from, to };
}

function getDefaultHistoryRange() {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

const addTransactionTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'addTransaction',
      description:
        'Mencatat transaksi pemasukan atau pengeluaran keuangan Bosmat ke koleksi "transactions" di Firestore.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['income', 'expense'],
            description: "Tipe transaksi: 'income' (pemasukan) atau 'expense' (pengeluaran).",
          },
          amount: {
            type: 'number',
            description: 'Nominal transaksi dalam rupiah (IDR), tanpa titik/koma pemisah.',
          },
          category: {
            type: 'string',
            description: "Kategori, contoh: 'repaint', 'detailing', 'sparepart', 'listrik', 'gaji', dll.",
          },
          description: {
            type: 'string',
            description: 'Deskripsi singkat transaksi.',
          },
          paymentMethod: {
            type: 'string',
            description: "Metode pembayaran, contoh: 'cash', 'transfer', 'qris'.",
          },
          date: {
            type: 'string',
            description:
              'Tanggal transaksi dalam ISO string (opsional). Jika tidak diisi, otomatis pakai waktu server sekarang.',
          },
        },
        required: ['type', 'amount', 'category', 'description', 'paymentMethod'],
      },
    },
  },
  implementation: async (input = {}) => {
    try {
      const parsed = addTransactionSchema.parse(input || {});
      const db = ensureFirestore();

      const now = admin.firestore.FieldValue.serverTimestamp();
      const dateValue = parsed.date ? parseDateOrNull(parsed.date) : null;
      const dateField = dateValue ? admin.firestore.Timestamp.fromDate(dateValue) : now;

      const docRef = db.collection('transactions').doc();

      const payload = {
        id: docRef.id,
        type: parsed.type,
        amount: parsed.amount,
        category: parsed.category,
        description: parsed.description,
        paymentMethod: parsed.paymentMethod,
        date: dateField,
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(payload);

      const summary = `[Finance] Tercatat ${parsed.type === 'income' ? 'pemasukan' : 'pengeluaran'} ` +
        `${formatCurrencyIDR(parsed.amount)} kategori "${parsed.category}".`;

      return {
        success: true,
        message: 'Transaksi berhasil dicatat.',
        summary,
        data: payload,
      };
    } catch (error) {
      console.error('[addTransactionTool] Error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal mencatat transaksi.',
      };
    }
  },
};

const getTransactionHistoryTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'getTransactionHistory',
      description:
        'Mengambil riwayat transaksi keuangan Bosmat dari koleksi "transactions" dengan filter tanggal, tipe, dan kategori.',
      parameters: {
        type: 'object',
        properties: {
          fromDate: {
            type: 'string',
            description:
              'Tanggal awal (ISO). Jika kosong, default 30 hari ke belakang dari hari ini (zona waktu server).',
          },
          toDate: {
            type: 'string',
            description: 'Tanggal akhir (ISO). Jika kosong, default hari ini.',
          },
          type: {
            type: 'string',
            enum: ['income', 'expense'],
            description: "Filter tipe transaksi: 'income' atau 'expense' (opsional).",
          },
          category: {
            type: 'string',
            description: 'Filter kategori tertentu (opsional).',
          },
          limit: {
            type: 'number',
            description: 'Batas jumlah transaksi (default 100, maksimal 500).',
          },
        },
      },
    },
  },
  implementation: async (input = {}) => {
    try {
      const parsed = getTransactionHistorySchema.parse(input || {});
      const db = ensureFirestore();

      let from = parseDateOrNull(parsed.fromDate || '');
      let to = parseDateOrNull(parsed.toDate || '');

      if (!from || !to) {
        const fallback = getDefaultHistoryRange();
        from = from || fallback.from;
        to = to || fallback.to;
      }

      const fromTs = admin.firestore.Timestamp.fromDate(from);
      const toTs = admin.firestore.Timestamp.fromDate(to);

      let query = db
        .collection('transactions')
        .where('date', '>=', fromTs)
        .where('date', '<=', toTs)
        .orderBy('date', 'desc');

      if (parsed.type) {
        query = query.where('type', '==', parsed.type);
      }

      if (parsed.category) {
        query = query.where('category', '==', parsed.category);
      }

      const limit = parsed.limit || 100;
      query = query.limit(limit);

      const snapshot = await query.get();
      if (snapshot.empty) {
        return {
          success: true,
          message: 'Tidak ada transaksi pada rentang waktu tersebut.',
          data: [],
          summary: 'Tidak ditemukan transaksi dalam periode yang diminta.',
        };
      }

      const transactions = [];
      let totalIncome = 0;
      let totalExpense = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const dateJs = data.date?.toDate ? data.date.toDate() : null;
        const clean = {
          id: data.id || doc.id,
          type: data.type,
          amount: data.amount,
          category: data.category,
          description: data.description,
          paymentMethod: data.paymentMethod,
          date: dateJs ? dateJs.toISOString() : null,
        };
        transactions.push(clean);

        if (data.type === 'income') {
          totalIncome += data.amount || 0;
        } else if (data.type === 'expense') {
          totalExpense += data.amount || 0;
        }
      });

      const net = totalIncome - totalExpense;

      const summary =
        `[Finance] Periode ${from.toISOString().slice(0, 10)} s/d ${to.toISOString().slice(0, 10)}:\n` +
        `- Total pemasukan: ${formatCurrencyIDR(totalIncome)}\n` +
        `- Total pengeluaran: ${formatCurrencyIDR(totalExpense)}\n` +
        `- Selisih (net): ${formatCurrencyIDR(net)}\n` +
        `- Jumlah transaksi: ${transactions.length}`;

      return {
        success: true,
        message: 'Riwayat transaksi berhasil diambil.',
        data: {
          transactions,
          totalIncome,
          totalExpense,
          netProfit: net,
        },
        summary,
      };
    } catch (error) {
      console.error('[getTransactionHistoryTool] Error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal mengambil riwayat transaksi.',
      };
    }
  },
};

const calculateFinancesTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'calculateFinances',
      description:
        'Menghitung total pemasukan, pengeluaran, dan profit bersih pada periode tertentu (harian, mingguan, bulanan, atau custom).',
      parameters: {
        type: 'object',
        properties: {
          fromDate: {
            type: 'string',
            description:
              'Tanggal awal periode (ISO). Jika kosong dan tidak ada period, gunakan awal bulan berjalan.',
          },
          toDate: {
            type: 'string',
            description:
              'Tanggal akhir periode (ISO). Jika kosong dan tidak ada period, gunakan akhir bulan berjalan/hari ini.',
          },
          period: {
            type: 'string',
            enum: ['day', 'week', 'month'],
            description:
              "Opsi cepat: 'day' (hari ini), 'week' (7 hari terakhir), 'month' (bulan berjalan). Jika ini diisi, fromDate/toDate akan diabaikan.",
          },
        },
      },
    },
  },
  implementation: async (input = {}) => {
    try {
      const parsed = calculateFinancesSchema.parse(input || {});
      const db = ensureFirestore();

      let from;
      let to;

      if (parsed.period) {
        const range = getDefaultRangeFromPeriod(parsed.period);
        from = range.from;
        to = range.to;
      } else {
        from = parseDateOrNull(parsed.fromDate || '');
        to = parseDateOrNull(parsed.toDate || '');

        if (!from || !to) {
          const fallback = getDefaultRangeFromPeriod('month');
          from = from || fallback.from;
          to = to || fallback.to;
        }
      }

      const fromTs = admin.firestore.Timestamp.fromDate(from);
      const toTs = admin.firestore.Timestamp.fromDate(to);

      let query = db
        .collection('transactions')
        .where('date', '>=', fromTs)
        .where('date', '<=', toTs);

      const snapshot = await query.get();

      if (snapshot.empty) {
        const emptySummary =
          `[Finance] Tidak ada transaksi pada periode ` +
          `${from.toISOString().slice(0, 10)} s/d ${to.toISOString().slice(0, 10)}.`;

        return {
          success: true,
          message: 'Tidak ada transaksi pada periode tersebut.',
          data: {
            totalIncome: 0,
            totalExpense: 0,
            netProfit: 0,
            transactionCount: 0,
          },
          summary: emptySummary,
        };
      }

      let totalIncome = 0;
      let totalExpense = 0;
      let countIncome = 0;
      let countExpense = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const amount = data.amount || 0;
        if (data.type === 'income') {
          totalIncome += amount;
          countIncome += 1;
        } else if (data.type === 'expense') {
          totalExpense += amount;
          countExpense += 1;
        }
      });

      const net = totalIncome - totalExpense;

      const summaryLines = [
        `[Finance] Laporan keuangan ${from.toISOString().slice(0, 10)} s/d ${to.toISOString().slice(0, 10)}:`,
        `1) Total pemasukan: ${formatCurrencyIDR(totalIncome)} (${countIncome} transaksi)`,
        `2) Total pengeluaran: ${formatCurrencyIDR(totalExpense)} (${countExpense} transaksi)`,
        `3) Profit bersih (net): ${formatCurrencyIDR(net)}`,
      ];

      return {
        success: true,
        message: 'Perhitungan keuangan berhasil.',
        data: {
          totalIncome,
          totalExpense,
          netProfit: net,
          incomeCount: countIncome,
          expenseCount: countExpense,
          from: from.toISOString(),
          to: to.toISOString(),
        },
        summary: summaryLines.join('\n'),
      };
    } catch (error) {
      console.error('[calculateFinancesTool] Error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Gagal menghitung laporan keuangan.',
      };
    }
  },
};

module.exports = {
  addTransactionTool,
  getTransactionHistoryTool,
  calculateFinancesTool,
};

