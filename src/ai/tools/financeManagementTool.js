// File: src/ai/tools/financeManagementTool.js
const { z } = require('zod');
const prisma = require('../../lib/prisma.js');
const { isAdmin } = require('../utils/adminAuth.js');
const { traceable } = require('../utils/langsmith.js');
const { parseSenderIdentity } = require('../../lib/utils.js');
const { syncCustomer } = require('../utils/customerSync.js');

const TransactionTypeEnum = z.enum(['income', 'expense']);

const addTransactionSchema = z.object({
  type: TransactionTypeEnum,
  amount: z.number().positive(),
  category: z.string().min(1),
  description: z.string().min(1),
  paymentMethod: z.string().min(1),
  date: z.string().optional(),
  customerName: z.string().optional(),
  customerNumber: z.string().optional(),
  customerId: z.string().optional(), // In SQL this will be the customer.id (phone)
  senderNumber: z.string(),
});

const getTransactionHistorySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  type: TransactionTypeEnum.optional(),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  senderNumber: z.string(),
});

const calculateFinancesSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  period: z.enum(['day', 'week', 'month']).optional(),
  senderNumber: z.string(),
});

function formatCurrencyIDR(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Math.round(amount || 0));
}

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const addTransactionTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'addTransaction',
      description: 'KHUSUS ADMIN. Mencatat keuangan BosMat (income/expense) ke SQL.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['income', 'expense'], description: "income atau expense." },
          amount: { type: 'number', description: 'Nominal Rp.' },
          category: { type: 'string', description: "Kategori (repaint, detailing, dll)." },
          description: { type: 'string', description: 'Deskripsi transaksi.' },
          paymentMethod: { type: 'string', description: "cash, transfer, qris." },
          date: { type: 'string', description: 'ISO string (opsional).' },
          customerName: { type: 'string', description: 'Nama customer (pilihan).' },
          customerNumber: { type: 'string', description: 'Nomor WA (pilihan).' },
          senderNumber: { type: 'string', description: 'Otomatis.' },
        },
        required: ['type', 'amount', 'category', 'description', 'paymentMethod', 'senderNumber'],
      },
    },
  },
  implementation: traceable(async (input = {}) => {
    try {
      const parsed = addTransactionSchema.parse(input);

      if (!isAdmin(parsed.senderNumber)) {
        return { success: false, message: "⛔ Akses Ditolak. Khusus Admin." };
      }

      let linkedPhone = parsed.customerId || parsed.customerNumber;
      if (linkedPhone) {
        const { docId } = parseSenderIdentity(linkedPhone);
        linkedPhone = docId;
      }

      // If no ID but name exists, try to find customer if it's income
      if (!linkedPhone && parsed.customerName && parsed.type === 'income') {
        const fuzzy = await prisma.customer.findFirst({
           where: { name: { contains: parsed.customerName, mode: 'insensitive' } }
        });
        if (fuzzy) linkedPhone = fuzzy.phone;
      }

      const txDate = parsed.date ? new Date(parsed.date) : new Date();

      const tx = await prisma.transaction.create({
        data: {
          type: parsed.type === 'income' ? 'INCOME' : 'EXPENSE',
          status: 'PAID',
          amount: parsed.amount,
          category: parsed.category,
          description: parsed.description,
          paymentMethod: parsed.paymentMethod,
          createdAt: txDate,
          customerName: parsed.customerName,
          customerId: linkedPhone,
          createdBy: parsed.senderNumber
        }
      });

      // SYNC CUSTOMER statistics after income
      if (linkedPhone && parsed.type === 'income') {
        await syncCustomer(linkedPhone);
      }

      return {
        success: true,
        message: 'Transaksi SQL berhasil dicatat.',
        summary: `[Finance] Tercatat SQL ${parsed.type} ${formatCurrencyIDR(parsed.amount)} kategori "${parsed.category}".`,
        data: tx,
      };
    } catch (err) {
      console.error('[addTransactionTool] SQL Error:', err);
      return { success: false, message: `SQL Error: ${err.message}` };
    }
  }, { name: "addTransactionTool" }),
};

const getTransactionHistoryTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'getTransactionHistory',
      description: 'KHUSUS ADMIN. Riwayat keuangan SQL.',
      parameters: {
        type: 'object',
        properties: {
          fromDate: { type: 'string' },
          toDate: { type: 'string' },
          type: { type: 'string', enum: ['income', 'expense'] },
          category: { type: 'string' },
          limit: { type: 'number' },
          senderNumber: { type: 'string' },
        },
        required: ['senderNumber']
      },
    },
  },
  implementation: traceable(async (input = {}) => {
    try {
      const parsed = getTransactionHistorySchema.parse(input);
      if (!isAdmin(parsed.senderNumber)) return { success: false, message: "⛔ Akses Ditolak." };

      const from = parseDateOrNull(parsed.fromDate) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = parseDateOrNull(parsed.toDate) || new Date();

      const txs = await prisma.transaction.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          type: parsed.type ? (parsed.type === 'income' ? 'INCOME' : 'EXPENSE') : undefined,
          category: parsed.category || undefined
        },
        orderBy: { createdAt: 'desc' },
        take: parsed.limit || 100
      });

      const income = txs.filter(t => t.type === 'INCOME').reduce((s, t) => s + (t.amount || 0), 0);
      const expense = txs.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (t.amount || 0), 0);

      const summary = `📊 *Laporan SQL (${from.toISOString().slice(0, 10)} - ${to.toISOString().slice(0, 10)})*:\n` +
        `- Total Pemasukan: ${formatCurrencyIDR(income)}\n` +
        `- Total Pengeluaran: ${formatCurrencyIDR(expense)}\n` +
        `- Net Profit: *${formatCurrencyIDR(income - expense)}*`;

      return { success: true, data: { transactions: txs, income, expense, net: income - expense }, summary };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, { name: "getTransactionHistoryTool" }),
};

const calculateFinancesTool = {
  toolDefinition: {
    type: 'function',
    function: {
      name: 'calculateFinances',
      description: 'Menghitung laporan laba rugi SQL.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['day', 'week', 'month'] },
          senderNumber: { type: 'string' },
        },
        required: ['senderNumber']
      },
    },
  },
  implementation: traceable(async (input = {}) => {
    try {
      const parsed = calculateFinancesSchema.parse(input);
      if (!isAdmin(parsed.senderNumber)) return { success: false, message: "⛔ Akses Ditolak." };

      let from = new Date();
      if (parsed.period === 'week') from.setDate(from.getDate() - 7);
      else if (parsed.period === 'month') from.setDate(1);
      else from.setHours(0, 0, 0, 0);

      const stats = await prisma.transaction.groupBy({
        by: ['type'],
        where: { createdAt: { gte: from } },
        _sum: { amount: true },
        _count: { _all: true }
      });

      let income = 0, expense = 0;
      stats.forEach(s => {
        if (s.type === 'INCOME') income = s._sum.amount || 0;
        else if (s.type === 'EXPENSE') expense = s._sum.amount || 0;
      });

      return {
        success: true,
        summary: `📈 *SQL Profit Report (${parsed.period || 'custom'})*:\n` +
          `- Pemasukan: ${formatCurrencyIDR(income)}\n` +
          `- Pengeluaran: ${formatCurrencyIDR(expense)}\n` +
          `- Net: *${formatCurrencyIDR(income - expense)}*`
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }, { name: "calculateFinancesTool" }),
};

module.exports = {
  addTransactionTool,
  getTransactionHistoryTool,
  calculateFinancesTool,
};
