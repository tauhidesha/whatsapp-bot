import prisma from '@/lib/prisma';

/**
 * Synchronizes booking payment status based on related transactions.
 * This ensures data correlation between Finance and Bookings.
 */
export async function syncBookingFinance(bookingId: string) {
  if (!bookingId) return;

  try {
    // 1. Fetch current booking and its transactions
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        transaction: true // This matches the 1-to-1 or 1-to-many relation in schema
      }
    });

    if (!booking) return;

    // 2. Aggregate all SUCCESS income transactions for this booking
    // Note: In current schema, Booking has a 1-to-1 with Transaction, 
    // but the transaction model itself has a bookingId field that can be many-to-1.
    // Let's query Transaction table directly to be safe.
    const aggregation = await prisma.transaction.aggregate({
      where: {
        bookingId: bookingId,
        type: 'income',
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

    console.log(`[FinanceSync] Updated Booking ${bookingId}: Paid=${totalPaid}, Status=${paymentStatus}`);
  } catch (error) {
    console.error(`[FinanceSync] Error syncing booking ${bookingId}:`, error);
  }
}
