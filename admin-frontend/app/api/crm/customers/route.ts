import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/crm/customers
// Query params:
// - limit: number of customers to return (default 50)
// - status: filter by status (active, new, churned)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        vehicles: {
          select: {
            id: true,
            modelName: true,
            plateNumber: true,
            color: true,
            _count: { select: { bookings: true } }
          }
        },
        bookings: {
          orderBy: { bookingDate: 'desc' },
          take: 1,
          select: {
            bookingDate: true,
            serviceType: true,
            status: true,
          }
        },
        _count: {
          select: { 
            bookings: true,
            transactions: true,
            vehicles: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    });

    // Transform to match frontend interface
    const transformedCustomers = customers.map(c => ({
      id: c.id,
      name: c.name || c.phone,
      phone: c.phone,
      status: c.status,
      totalSpending: c.totalSpending,
      lastService: c.lastService?.toISOString() || c.bookings[0]?.bookingDate?.toISOString() || null,
      bikes: c.vehicles.map(v => v.modelName),
      vehicles: c.vehicles.map(v => ({
        id: v.id,
        modelName: v.modelName,
        plateNumber: v.plateNumber,
        color: v.color,
        serviceCount: v._count.bookings
      })),
      bookingCount: c._count.bookings,
      transactionCount: c._count.transactions,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return NextResponse.json({ 
      success: true, 
      customers: transformedCustomers,
      total: transformedCustomers.length
    });
  } catch (error: any) {
    console.error('[API CRM] Fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
