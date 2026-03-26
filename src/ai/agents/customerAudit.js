// File: src/ai/agents/customerAudit.js
// Customer Audit Agent — deterministic multi-turn flow via WhatsApp.
// Scan customer historis yang belum punya label, auto-label yang jelas,
// dan tanya admin untuk yang ambigu.

const prisma = require('../../lib/prisma');
const {
    createSession,
    getSession,
    hasActiveSession,
    advanceSession,
    updateSessionStep,
    pauseSession,
    resumeSession,
    touchSession,
} = require('../utils/auditSession.js');
const { mergeAndSaveContext } = require('../utils/mergeCustomerContext.js');

// ─── Constants ────────────────────────────────────────────────────────────────

const PAUSE_KEYWORDS = ['pause', 'stop audit', 'nanti', 'bukan', 'cancel', 'batal'];

const LABEL_MAP = {
    '1_once': 'existing_customer',
    '1_multiple': 'loyal_customer',
    '1_unknown': 'existing_customer',
    '2': 'lead',
};

// ─── Scan Logic ───────────────────────────────────────────────────────────────

/**
 * Scan semua customer yang belum punya label.
 * Cross-reference customers, customerContext, dan transactions.
 */
async function scanUnlabeledCustomers() {
    // 1. Ambil semua customer
    const customers = await prisma.customer.findMany({
        include: {
            customerContext: true,
            transactions: {
                select: { id: true }
            },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1
            }
        }
    });

    if (customers.length === 0) {
        return { autoLabeled: [], pendingReview: [] };
    }

    const autoLabeled = [];
    const pendingReview = [];

    for (const customer of customers) {
        const ctx = customer.customerContext;
        const lastMessage = customer.messages[0];
        const txCount = customer.transactions.length;

        // Skip jika sudah punya label
        if (ctx?.customerLabel && ctx.customerLabel !== 'unknown') {
            continue;
        }

        const lastMessageAt = customer.lastMessageAt || customer.updatedAt;
        const daysSinceLastMessage = lastMessageAt
            ? Math.floor((Date.now() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        const customerInfo = {
            docId: customer.phone,
            name: customer.name || `Customer ${customer.phone.slice(-4)}`,
            lastMessageAt: lastMessageAt?.toISOString() || null,
            daysSince: daysSinceLastMessage,
            motorModel: ctx?.motorModel || null,
            targetService: ctx?.targetServices?.[0] || null,
            lastMessageSender: lastMessage?.role || null,
            messageCount: customer.transactions.length, // Approximate
            txCount,
            saidExpensive: ctx?.saidExpensive || false,
            budgetSignal: ctx?.budgetSignal || null,
            askedAvailability: ctx?.askedAvailability || false,
            intentLevel: ctx?.customerLabel || null,
        };

        // ─── Bucket YAKIN (auto-label) ───────────────────────────────────

        // DORMANT_LEAD: 0 transaksi, > 60 hari, ghosted (lastSender = ai)
        if (
            txCount === 0 &&
            daysSinceLastMessage !== null &&
            daysSinceLastMessage > 60 &&
            lastMessage?.role === 'assistant'
        ) {
            autoLabeled.push({ ...customerInfo, label: 'dormant_lead' });
            continue;
        }

        // HOT_LEAD: > 0 tx, dalam 30 hari, lastSender = user
        if (
            txCount > 0 &&
            daysSinceLastMessage !== null &&
            daysSinceLastMessage <= 30 &&
            lastMessage?.role === 'user'
        ) {
            autoLabeled.push({ ...customerInfo, label: txCount > 1 ? 'loyal' : 'existing' });
            continue;
        }

        // WARM_LEAD: pernah mention budgeting, Tanya harga
        if (
            ctx?.budgetSignal === 'ketat' ||
            ctx?.askedAvailability === true
        ) {
            autoLabeled.push({ ...customerInfo, label: 'warm_lead' });
            continue;
        }

        // ─── Bucket TIDAK YAKIN → pendingReview ─────────────────────────
        pendingReview.push(customerInfo);
    }

    return { autoLabeled, pendingReview };
}

/**
 * Auto-label customers yang jelas (from scanUnlabeledCustomers)
 */
async function autoLabelCustomers(customers) {
    const results = [];

    for (const c of customers) {
        try {
            await prisma.customerContext.upsert({
                where: { id: c.docId.replace(/\D/g, '') },
                create: {
                    id: c.docId.replace(/\D/g, ''),
                    phone: c.docId.replace(/\D/g, ''),
                    customerLabel: c.label,
                    labelReason: 'auto_audit',
                },
                update: {
                    customerLabel: c.label,
                    labelReason: 'auto_audit',
                }
            });

            // Update customer status
            const labelToStatus = {
                'hot_lead': 'active',
                'warm_lead': 'active',
                'cold_lead': 'churned',
                'dormant_lead': 'churned',
                'existing': 'active',
                'loyal': 'active'
            };

            if (labelToStatus[c.label]) {
                await prisma.customer.update({
                    where: { phone: c.docId.replace(/\D/g, '') },
                    data: { status: labelToStatus[c.label] }
                });
            }

            results.push({ docId: c.docId, label: c.label, success: true });
            console.log(`[Audit] Auto-labeled ${c.docId} as ${c.label}`);
        } catch (err) {
            results.push({ docId: c.docId, label: c.label, success: false, error: err.message });
        }
    }

    return results;
}

/**
 * Get all customers for audit display (regardless of label)
 */
async function getAuditCustomerList() {
    const customers = await prisma.customer.findMany({
        include: {
            customerContext: true,
            _count: { select: { transactions: true, bookings: true, messages: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 100
    });

    return customers.map(c => ({
        docId: c.phone,
        name: c.name,
        status: c.status,
        totalSpending: c.totalSpending,
        lastService: c.lastService?.toISOString(),
        label: c.customerContext?.customerLabel,
        labelReason: c.customerContext?.labelReason,
        txCount: c._count.transactions,
        bookingCount: c._count.bookings,
        messageCount: c._count.messages,
    }));
}

/**
 * Get customer detail for audit view
 */
async function getCustomerAuditDetail(phone) {
    const customer = await prisma.customer.findUnique({
        where: { phone },
        include: {
            customerContext: true,
            transactions: { orderBy: { createdAt: 'desc' }, take: 10 },
            bookings: { orderBy: { bookingDate: 'desc' }, take: 10 },
            messages: { orderBy: { createdAt: 'desc' }, take: 20 },
            vehicles: true
        }
    });

    return customer;
}

/**
 * Manual label from audit UI
 */
async function manualLabelCustomer(phone, label, reason) {
    const normalizedPhone = phone.replace(/\D/g, '');

    await prisma.customerContext.upsert({
        where: { id: normalizedPhone },
        create: {
            id: normalizedPhone,
            phone: normalizedPhone,
            customerLabel: label,
            labelReason: reason,
        },
        update: {
            customerLabel: label,
            labelReason: reason,
        }
    });

    // Update customer status
    const labelToStatus = {
        'hot_lead': 'active',
        'warm_lead': 'active',
        'cold_lead': 'churned',
        'dormant_lead': 'churned',
        'existing': 'active',
        'loyal': 'active'
    };

    if (labelToStatus[label]) {
        await prisma.customer.update({
            where: { phone: normalizedPhone },
            data: { status: labelToStatus[label] }
        });
    }

    return { success: true, label, reason };
}

module.exports = {
    scanUnlabeledCustomers,
    autoLabelCustomers,
    getAuditCustomerList,
    getCustomerAuditDetail,
    manualLabelCustomer,
    createSession,
    getSession,
    hasActiveSession,
    advanceSession,
    updateSessionStep,
    pauseSession,
    resumeSession,
    touchSession,
};