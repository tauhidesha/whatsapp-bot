import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/vehicles
// Query params:
// - q: search query (plate, model, or owner name)
// - customerId: filter by customer
// - plate: get specific vehicle by plate number
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    const customerId = searchParams.get('customerId');
    const plate = searchParams.get('plate');

    // Get vehicle by specific plate number
    if (plate) {
      const normalizedPlate = plate.toUpperCase().replace(/\s+/g, ' ');
      const vehicle = await prisma.vehicle.findUnique({
        where: { plateNumber: normalizedPlate },
        include: {
          customer: {
            select: { id: true, name: true, phone: true }
          },
          bookings: {
            orderBy: { bookingDate: 'desc' },
            take: 10,
            select: {
              id: true,
              bookingDate: true,
              serviceType: true,
              status: true,
              plateNumber: true,
              vehicleModel: true,
            }
          },
          _count: {
            select: { bookings: true }
          }
        }
      });

      if (!vehicle) {
        return NextResponse.json(
          { success: false, error: 'Vehicle not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, vehicle });
    }

    // Get vehicles for a specific customer
    if (customerId) {
      const vehicles = await prisma.vehicle.findMany({
        where: { customerId },
        include: {
          _count: { select: { bookings: true } },
          bookings: {
            orderBy: { bookingDate: 'desc' },
            take: 1,
            select: { bookingDate: true, serviceType: true, status: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({ success: true, vehicles });
    }

    // Search vehicles
    if (query) {
      const normalizedQuery = query.toUpperCase().replace(/\s+/g, '');
      
      const vehicles = await prisma.vehicle.findMany({
        where: {
          OR: [
            { plateNumber: { contains: normalizedQuery } },
            { modelName: { contains: query, mode: 'insensitive' } },
            {
              customer: {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { phone: { contains: query } }
                ]
              }
            }
          ]
        },
        include: {
          customer: {
            select: { id: true, name: true, phone: true }
          },
          _count: { select: { bookings: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 50
      });

      return NextResponse.json({ success: true, vehicles });
    }

    // List all vehicles (default)
    const vehicles = await prisma.vehicle.findMany({
      include: {
        customer: {
          select: { id: true, name: true, phone: true }
        },
        _count: { select: { bookings: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    return NextResponse.json({ success: true, vehicles });
  } catch (error: any) {
    console.error('[API Vehicles] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/vehicles
// Create a new vehicle
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerPhone, modelName, plateNumber, color } = body;

    if (!customerPhone || !modelName) {
      return NextResponse.json(
        { success: false, error: 'customerPhone and modelName are required' },
        { status: 400 }
      );
    }

    // Find customer by phone
    const normalizedPhone = customerPhone.replace(/[^0-9]/g, '');
    const customer = await prisma.customer.findUnique({
      where: { phone: normalizedPhone }
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if plate already exists
    if (plateNumber) {
      const normalizedPlate = plateNumber.toUpperCase().replace(/\s+/g, ' ');
      const existing = await prisma.vehicle.findUnique({
        where: { plateNumber: normalizedPlate }
      });

      if (existing) {
        // Update existing vehicle
        const updated = await prisma.vehicle.update({
          where: { id: existing.id },
          data: {
            customerId: customer.id,
            modelName,
            color
          }
        });

        return NextResponse.json({
          success: true,
          vehicle: updated,
          message: 'Vehicle updated'
        });
      }
    }

    // Create new vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        customerId: customer.id,
        modelName,
        plateNumber: plateNumber?.toUpperCase().replace(/\s+/g, ' ') || null,
        color
      }
    });

    return NextResponse.json({
      success: true,
      vehicle,
      message: 'Vehicle created'
    });
  } catch (error: any) {
    console.error('[API Vehicles] Create error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
