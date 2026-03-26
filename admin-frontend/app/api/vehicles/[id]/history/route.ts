import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

// GET /api/vehicles/[id]/history
// Get all bookings for a specific vehicle
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const vehicleId = params.id;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        customer: {
          select: { id: true, name: true, phone: true }
        }
      }
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    const bookings = await prisma.booking.findMany({
      where: { vehicleId },
      include: {
        transaction: true,
        customer: {
          select: { id: true, name: true, phone: true }
        }
      },
      orderBy: { bookingDate: 'desc' }
    });

    // Calculate stats
    const stats = {
      totalServices: bookings.length,
      totalSpent: bookings.reduce((sum, b) => sum + (b.subtotal || 0), 0),
      completedServices: bookings.filter(b => b.status === 'COMPLETED').length,
      pendingServices: bookings.filter(b => b.status === 'PENDING' || b.status === 'CONFIRMED').length,
      lastServiceDate: bookings.length > 0 ? bookings[0].bookingDate : null,
    };

    return NextResponse.json({
      success: true,
      vehicle,
      bookings,
      stats
    });
  } catch (error: any) {
    console.error('[API Vehicle History] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
