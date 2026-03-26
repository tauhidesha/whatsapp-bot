const prisma = require('../../lib/prisma.js');

/**
 * Synchronizes customer statistics (spending, last service, status) into the Customer model.
 * Call this after creating/updating/deleting Bookings or Transactions.
 */
async function syncCustomer(customerId) {
  if (!customerId) return;

  try {
    // 1. Calculate Total Spending from PAID income transactions
    const aggregateSpending = await prisma.transaction.aggregate({
      where: {
        customerId,
        type: 'income',
        status: 'PAID'
      },
      _sum: {
        amount: true
      }
    });

    const totalSpending = aggregateSpending._sum.amount || 0;

    // 2. Find Last COMPLETED Booking
    const lastBooking = await prisma.booking.findFirst({
      where: {
        customerId,
        status: 'COMPLETED'
      },
      orderBy: {
        bookingDate: 'desc'
      }
    });

    const lastServiceAt = lastBooking ? lastBooking.bookingDate : null;

    // 3. Determine Status
    let newStatus = 'new';
    const now = new Date();

    if (totalSpending > 0 || lastServiceAt) {
      newStatus = 'active';
      
      if (lastServiceAt) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        if (lastServiceAt < sixMonthsAgo) {
          newStatus = 'churned';
        }
      }
    }

    // 4. Update Customer Record
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalSpending,
        lastService: lastServiceAt,
        status: newStatus,
        updatedAt: new Date()
      }
    });

    console.log(`[CustomerSync] Synced ${customerId}: Spending=${totalSpending}, Status=${newStatus}`);
  } catch (error) {
    console.error(`[CustomerSync] Error syncing customer ${customerId}:`, error.message);
  }
}

module.exports = { syncCustomer };
