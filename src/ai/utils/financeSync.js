// File: src/ai/utils/financeSync.js
const prisma = require('../../lib/prisma.js');
const { syncCustomer } = require('./customerSync.js');

/**
 * Synchronizes a booking's financial status based on its related SUCCESS transactions.
 * @param {string} bookingId 
 */
async function syncBookingFinance(bookingId) {
    if (!bookingId) return;

    try {
        // 1. Fetch current booking
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { customer: true }
        });

        if (!booking) {
            console.error(`[financeSync] Booking NOT FOUND: ${bookingId}`);
            return;
        }

        // 2. Aggregate all SUCCESS income transactions for this booking
        const aggregation = await prisma.transaction.aggregate({
            where: {
                bookingId: bookingId,
                type: 'INCOME',
                status: 'SUCCESS'
            },
            _sum: { amount: true }
        });

        const totalPaid = aggregation._sum.amount || 0;
        const totalAmount = booking.totalAmount || booking.subtotal || 0;

        // 3. Determine payment status
        let paymentStatus = 'UNPAID';
        if (totalAmount > 0) {
            if (totalPaid >= totalAmount) {
                paymentStatus = 'PAID';
            } else if (totalPaid > 0) {
                paymentStatus = 'PARTIAL';
            }
        } else if (totalPaid > 0) {
            // If totalAmount is not set but there's payment, call it PARTIAL or PAID?
            // Usually, we should follow totalAmount.
            paymentStatus = 'PARTIAL';
        }

        // 4. Update Booking
        await prisma.booking.update({
            where: { id: bookingId },
            data: {
                amountPaid: totalPaid,
                paymentStatus: paymentStatus
            }
        });

        console.log(`[financeSync] Updated Booking ${bookingId}: Paid=${totalPaid}, Status=${paymentStatus}`);

        // 5. Trigger Customer Sync only if booking is COMPLETED
        // This prevents premature lastService update from Down Payments (DP)
        if (booking.customerId && booking.status === 'COMPLETED') {
            await syncCustomer(booking.customerId);
        }

    } catch (error) {
        console.error(`[financeSync] Error syncing booking ${bookingId}:`, error);
    }
}

module.exports = { syncBookingFinance };
