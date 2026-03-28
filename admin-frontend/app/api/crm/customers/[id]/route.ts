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
                vehicleModel: true,
              } as any
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
      } as any
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Calculate additional stats
    const anyCustomer = customer as any;
    const bookings = anyCustomer.bookings || [];
    const vehicles = anyCustomer.vehicles || [];

    const stats = {
      totalBookings: bookings.length,
      completedBookings: bookings.filter((b: any) => b.status === 'COMPLETED' || b.status === 'DONE' || b.status === 'SUCCESS').length,
      totalSpent: anyCustomer.totalSpending || 0,
      lastServiceDate: anyCustomer.lastService?.toISOString() || 
        (bookings.length > 0 ? new Date(bookings[0].bookingDate).toISOString() : null),
    };

    // Calculate Warranties
    const warranties: any[] = [];
    const now = new Date();

    // Group bookings by vehicle to calculate per-motor warranties
    vehicles.forEach((v: any) => {
      const vBookings = bookings.filter((b: any) => b.vehicleId === v.id || (b.plateNumber && b.plateNumber === v.plateNumber));
      
      // 1. Repaint Warranty (1 Year)
      const repaintBookings = vBookings.filter((b: any) => 
        b.serviceType?.toLowerCase().includes('repaint') && 
        !b.serviceType?.toLowerCase().includes('maintenance')
      );

      if (repaintBookings.length > 0) {
        const latestRepaint = repaintBookings[0];
        const repaintDate = new Date(latestRepaint.bookingDate);
        const expiryDate = new Date(repaintDate);
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        
        warranties.push({
          id: `repaint-${v.id}`,
          type: 'Repaint',
          vehicle: v.modelName,
          plateNumber: v.plateNumber,
          startDate: repaintDate.toISOString(),
          status: now < expiryDate ? 'ACTIVE' : 'EXPIRED',
          expiryDate: expiryDate.toISOString(),
          serviceType: latestRepaint.serviceType
        });
      }

      // 2. Coating Warranty (1 Year + 3 Month Maintenance Cycle)
      const coatingMainBookings = vBookings.filter((b: any) => 
        b.serviceType?.toLowerCase().includes('coating') && 
        !b.serviceType?.toLowerCase().includes('maintenance')
      );
      
      if (coatingMainBookings.length > 0) {
        // Find the most recent main coating
        const mainCoating = coatingMainBookings[0]; 
        const mainDate = new Date(mainCoating.bookingDate);
        
        // Find maintenance bookings AFTER this main coating
        const maintenanceBookings = vBookings.filter((b: any) => 
          (b.serviceType?.toLowerCase().includes('maintenance') || 
           b.serviceType?.toLowerCase().includes('maint')) &&
          new Date(b.bookingDate) > mainDate
        );

        const lastServiceDate = maintenanceBookings.length > 0 ? new Date(maintenanceBookings[0].bookingDate) : mainDate;
        
        // Calculate diffs
        const threeMonthsInMs = 1000 * 60 * 60 * 24 * 30 * 3.25; // 3.25 months grace
        const isMaintenanceValid = (now.getTime() - lastServiceDate.getTime()) < threeMonthsInMs;
        
        const expiryDate = new Date(mainDate);
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        const isOneYearValid = now < expiryDate;

        let status = 'ACTIVE';
        if (!isOneYearValid) {
          status = 'EXPIRED';
        } else if (!isMaintenanceValid) {
          status = 'VOID';
        }

        const nextMaint = new Date(lastServiceDate);
        nextMaint.setMonth(nextMaint.getMonth() + 3);

        warranties.push({
          id: `coating-${v.id}`,
          type: 'Coating',
          vehicle: v.modelName,
          plateNumber: v.plateNumber,
          startDate: mainDate.toISOString(),
          lastMaintenance: lastServiceDate.toISOString(),
          status: status,
          expiryDate: expiryDate.toISOString(),
          nextMaintenance: status === 'ACTIVE' ? nextMaint.toISOString() : null,
          serviceType: mainCoating.serviceType
        });
      }
    });

    return NextResponse.json({
      success: true,
      customer: {
        ...customer,
        lastService: customer.lastService?.toISOString() || null,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
      },
      stats,
      warranties
    });
  } catch (error: any) {
    console.error('[API Customer Detail] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
