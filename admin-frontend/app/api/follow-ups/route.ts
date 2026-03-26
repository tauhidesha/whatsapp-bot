import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/follow-ups
// Returns follow-up queue based on customer classification and last contact
export async function GET() {
  try {
    // Get customers that need follow-up based on:
    // 1. Ghosted (no response after initial contact)
    // 2. Due for follow-up (based on followUpStrategy)
    // 3. Recently completed service (for satisfaction check)
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get customers with customerContext for follow-up logic
    const customersToFollowUp = await prisma.customer.findMany({
      where: {
        status: { in: ['active', 'new'] },
        OR: [
          // Ghosted: no messages in last 7 days but has bookings
          {
            lastMessageAt: { lt: sevenDaysAgo },
            bookings: { some: {} }
          },
          // Completed service 7-14 days ago (satisfaction check)
          {
            lastService: {
              gte: sevenDaysAgo,
              lte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        ]
      },
      include: {
        customerContext: true,
        bookings: {
          where: { status: { in: ['COMPLETED', 'PAID'] } },
          orderBy: { bookingDate: 'desc' },
          take: 1,
          select: {
            id: true,
            bookingDate: true,
            serviceType: true,
            vehicleModel: true,
            plateNumber: true
          }
        },
        _count: { select: { bookings: true, transactions: true } }
      },
      orderBy: { lastService: 'desc' },
      take: 50
    });

    // Transform to follow-up format
    const items = customersToFollowUp.map(c => {
      const lastBooking = c.bookings[0];
      const context = c.customerContext;
      
      let followUpReason = 'general';
      let priority = 'medium';
      
      if (context?.customerLabel === 'hot' || context?.customerLabel === 'warm') {
        priority = 'high';
        followUpReason = 'high_value_customer';
      } else if (context?.followUpStrategy === 'aggressive') {
        priority = 'high';
        followUpReason = 'aggressive_followup';
      } else if (lastBooking && c.lastService) {
        const daysSinceService = Math.floor((now.getTime() - new Date(c.lastService).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceService >= 7 && daysSinceService <= 14) {
          followUpReason = 'post_service_check';
          priority = 'medium';
        }
      }

      return {
        customerId: c.id,
        phone: c.phone,
        name: c.name || c.phone,
        profilePicUrl: c.profilePicUrl,
        followUpReason,
        priority,
        lastBooking: lastBooking ? {
          id: lastBooking.id,
          serviceType: lastBooking.serviceType,
          bookingDate: lastBooking.bookingDate.toISOString(),
          vehicle: lastBooking.vehicleModel ? `${lastBooking.vehicleModel}${lastBooking.plateNumber ? ' ' + lastBooking.plateNumber : ''}` : null
        } : null,
        totalSpending: c.totalSpending,
        bookingCount: c._count.bookings,
        transactionCount: c._count.transactions,
        context: context ? {
          customerLabel: context.customerLabel,
          followUpStrategy: context.followUpStrategy,
          conversationStage: context.conversationStage
        } : null
      };
    });

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error('[API Follow-ups] Fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}