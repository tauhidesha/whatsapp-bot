import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/crm/customers/[id]
// Get detailed customer info including vehicles and booking history
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        vehicles: {
          include: {
            _count: { select: { bookings: true } },
            bookings: {
              orderBy: { bookingDate: 'desc' },
              take: 3,
              select: {
                id: true,
                bookingDate: true,
                serviceType: true,
                status: true,
                plateNumber: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        bookings: {
          include: {
            vehicle: {
              select: { plateNumber: true, modelName: true }
            },
            transaction: true
          },
          orderBy: { bookingDate: 'desc' },
          take: 20
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20
        },
        customerContext: true
      }
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Calculate additional stats
    const stats = {
      totalBookings: customer.bookings.length,
      completedBookings: customer.bookings.filter(b => b.status === 'COMPLETED').length,
      totalSpent: customer.totalSpending,
      lastServiceDate: customer.lastService?.toISOString() || 
        customer.bookings.find(b => b.status === 'COMPLETED')?.bookingDate?.toISOString() || null,
    };

    return NextResponse.json({
      success: true,
      customer: {
        ...customer,
        lastService: customer.lastService?.toISOString() || null,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
      },
      stats
    });
  } catch (error: any) {
    console.error('[API Customer Detail] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
