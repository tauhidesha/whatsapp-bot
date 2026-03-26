import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/bookings
// Query params:
// - limit: number of bookings to return (default 50)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status');
    const customerPhone = searchParams.get('customerPhone');

    const where: any = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (customerPhone) {
      where.customerPhone = { contains: customerPhone };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, phone: true, profilePicUrl: true }
        },
        vehicle: {
          select: { id: true, modelName: true, plateNumber: true, color: true }
        },
        transaction: true,
      },
      orderBy: { bookingDate: 'desc' },
      take: limit
    });

    const transformedBookings = bookings.map(b => ({
      id: b.id,
      customerName: b.customerName || b.customer?.name,
      customerPhone: b.customerPhone || b.customer?.phone,
      vehicleInfo: b.vehicleModel ? `${b.vehicleModel}${b.plateNumber ? ' - ' + b.plateNumber : ''}` : b.vehicle?.modelName,
      services: [b.serviceType], // Convert to array
      bookingDate: b.bookingDate.toISOString().split('T')[0],
      bookingTime: b.bookingDate.toISOString().slice(11, 16),
      status: b.status.toLowerCase(),
      subtotal: b.subtotal,
      downPayment: b.downPayment,
      paymentMethod: b.paymentMethod,
      homeService: b.homeService,
      notes: b.notes || b.adminNotes,
      createdAt: b.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: transformedBookings
    });
  } catch (error: any) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/bookings
// Create a new booking
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      customerName, 
      customerPhone, 
      serviceName, 
      bookingDate, 
      bookingTime, 
      vehicleInfo, 
      plateNumber,
      motorModel,
      color,
      notes, 
      subtotal, 
      homeService, 
      invoiceName, 
      dpAmount,
      paymentMethod
    } = body;

    if (!customerName || !customerPhone || !serviceName || !bookingDate || !bookingTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: customerName, customerPhone, serviceName, bookingDate, bookingTime' },
        { status: 400 }
      );
    }

    const normalizedPhone = customerPhone.replace(/\D/g, '');
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}:00`);
    const downPayment = dpAmount || 0;

    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { phone: normalizedPhone }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          phone: normalizedPhone,
          name: customerName,
          status: 'new'
        }
      });
    }

    // Handle vehicle
    let vehicleId = null;
    let finalPlateNumber = plateNumber;
    let finalVehicleModel = motorModel;

    const modelToUse = motorModel || (vehicleInfo ? extractModelFromText(vehicleInfo) : null);
    const plateToUse = plateNumber || extractPlateFromText(vehicleInfo);

    if (modelToUse) {
      try {
        const vehicle = await createOrUpdateVehicleAdmin({
          phone: normalizedPhone,
          modelName: modelToUse,
          plateNumber: plateToUse,
          color
        });
        vehicleId = vehicle.id;
        finalPlateNumber = vehicle.plateNumber;
        finalVehicleModel = vehicle.modelName;
      } catch (err) {
        console.error('Vehicle creation failed:', err);
      }
    }

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        vehicleId,
        customerName,
        customerPhone: normalizedPhone,
        plateNumber: finalPlateNumber,
        vehicleModel: finalVehicleModel,
        bookingDate: bookingDateTime,
        serviceType: serviceName,
        status: 'PENDING',
        notes,
        subtotal: subtotal || 0,
        downPayment: downPayment || null,
        homeService: homeService || false,
        paymentMethod,
        category: getServiceCategory(serviceName),
      }
    });

    // Create down payment transaction if provided
    if (downPayment > 0) {
      await prisma.transaction.create({
        data: {
          customerId: customer.id,
          bookingId: booking.id,
          amount: downPayment,
          type: 'income',
          status: 'PAID',
          description: `Down Payment - ${serviceName}`,
          paymentMode: paymentMethod || 'transfer',
        }
      });

      // Update customer totalSpending
      await prisma.customer.update({
        where: { id: customer.id },
        data: { 
          totalSpending: { increment: downPayment },
          lastService: bookingDateTime
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: { 
        id: booking.id,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        vehicleInfo: finalVehicleModel,
        plateNumber: finalPlateNumber,
        services: [booking.serviceType], // Convert to array
        bookingDate: booking.bookingDate.toISOString().split('T')[0],
        bookingTime: booking.bookingDate.toISOString().slice(11, 16),
        status: 'pending',
        subtotal: booking.subtotal,
        downPayment: booking.downPayment,
      },
      message: `Booking untuk ${customerName} berhasil dibuat`,
    });
  } catch (error: any) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal membuat booking', details: error.message },
      { status: 500 }
    );
  }
}

async function createOrUpdateVehicleAdmin({ phone, modelName, plateNumber, color }: { phone: string, modelName: string, plateNumber?: string | null, color?: string }) {
  const customer = await prisma.customer.findUnique({ where: { phone } });
  if (!customer) throw new Error(`Customer not found: ${phone}`);

  const plate = plateNumber ? plateNumber.toUpperCase().replace(/\s+/g, ' ').trim() : null;

  if (plate) {
    const existing = await prisma.vehicle.findUnique({ where: { plateNumber: plate } });
    if (existing) {
      return prisma.vehicle.update({
        where: { id: existing.id },
        data: {
          modelName: modelName || existing.modelName,
          color: color || existing.color,
          customerId: customer.id
        }
      });
    }
  }

  const existingByModel = modelName ? await prisma.vehicle.findFirst({
    where: {
      customerId: customer.id,
      modelName: { equals: modelName, mode: 'insensitive' },
      plateNumber: null
    }
  }) : null;

  if (existingByModel && plate) {
    return prisma.vehicle.update({
      where: { id: existingByModel.id },
      data: { plateNumber: plate, color }
    });
  }

  return prisma.vehicle.create({
    data: {
      customerId: customer.id,
      modelName,
      plateNumber: plate,
      color
    }
  });
}

function getServiceCategory(serviceName: string): string {
  const lower = serviceName.toLowerCase();
  if (lower.includes('repaint') || lower.includes('cat')) return 'repaint';
  if (lower.includes('coating')) return 'coating';
  if (lower.includes('detailing')) return 'detailing';
  return 'service';
}

function extractModelFromText(text: string | null): string | null {
  if (!text) return null;
  const keywords = ['beat', 'vario', 'supra', 'mio', 'nmax', 'vixion', 'rx', 'scoopy', 'crf', 'cbr', 'ninja', 'mt', 'duke', 'domi', 'sprint', 'adv', 'pcx', 'sh', 'jazz', 'brio', 'city'];
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      return text;
    }
  }
  return null;
}

function extractPlateFromText(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/([A-Z]{1,2})\s*([0-9]{1,5})\s*([A-Z]{0,4})/i);
  return match ? match[0].toUpperCase().replace(/\s+/g, ' ') : null;
}
// PATCH /api/bookings
// Update an existing booking
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, notes, adminNotes, bookingDate, serviceType } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    const data: any = {};
    if (status) data.status = status.toUpperCase();
    if (notes !== undefined) data.notes = notes;
    if (adminNotes !== undefined) data.adminNotes = adminNotes;
    if (bookingDate) data.bookingDate = new Date(bookingDate);
    if (serviceType) data.serviceType = serviceType;

    const booking = await prisma.booking.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: booking,
      message: 'Booking berhasil diperbarui',
    });
  } catch (error: any) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal memperbarui booking', details: error.message },
      { status: 500 }
    );
  }
}
