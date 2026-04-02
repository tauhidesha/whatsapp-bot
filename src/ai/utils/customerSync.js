const prisma = require('../../lib/prisma.js');
const { parseServiceType } = require('./serviceTypeMapper.js');

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
        type: { in: ['income', 'INCOME'] },
        status: { in: ['PAID', 'SUCCESS'] }
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
    const oldCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { lastService: true, phone: true }
    });

    const serviceType = parseServiceType(lastBooking?.serviceType);

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        totalSpending,
        lastService: lastServiceAt,
        status: newStatus,
        updatedAt: new Date()
      }
    });

    // 5. Update CustomerContext & Reset Flags
    if (oldCustomer?.phone) {
      const lastServiceDate = lastServiceAt ? new Date(lastServiceAt) : null;
      const oldServiceDate = oldCustomer.lastService ? new Date(oldCustomer.lastService) : null;

      const isNewService = !oldServiceDate || (lastServiceDate && lastServiceDate.getTime() > oldServiceDate.getTime());

      await prisma.customerContext.upsert({
        where: { phone: oldCustomer.phone },
        update: {
          lastServiceAt: lastServiceDate,
          lastServiceType: serviceType,
          ...(isNewService ? { reviewFollowUpSent: false } : {})
        },
        create: {
          id: oldCustomer.phone,
          phone: oldCustomer.phone,
          lastServiceAt: lastServiceDate,
          lastServiceType: serviceType,
          reviewFollowUpSent: false
        }
      });

      if (isNewService) {
        console.log(`[CustomerSync] Updated lastServiceType to ${serviceType} and reset flags for ${oldCustomer.phone}`);
      }
    }

    console.log(`[CustomerSync] Synced ${customerId}: Spending=${totalSpending}, Status=${newStatus}`);
  } catch (error) {
    console.error(`[CustomerSync] Error syncing customer ${customerId}:`, error.message);
  }
}

module.exports = { syncCustomer };
