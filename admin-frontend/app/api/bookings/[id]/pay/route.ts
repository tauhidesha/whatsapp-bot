import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: bookingId } = params;
    const body = await req.json();
    const { paymentMethod = 'Transfer BCA', amountPaid } = body;

    // Check if booking exists
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { 
        customer: true,
        transaction: true
      }
    });

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    const dp = booking.downPayment || 0;
    const subtotal = booking.subtotal || 0;
    const remainingBalance = Math.max(0, subtotal - dp);
    const finalAmount = amountPaid || remainingBalance;

    // 1. Send receipt via Express Backend
    const backendUrl = process.env.BACKEND_API_URL || 'https://unblissful-unverdantly-stan.ngrok-free.dev';
    try {
      await fetch(`${backendUrl}/generate-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'bukti_bayar',
          customerName: booking.customerName || booking.customer?.name,
          customerPhone: booking.customerPhone,
          motorDetails: booking.vehicleModel ? `${booking.vehicleModel}${booking.plateNumber ? ' - ' + booking.plateNumber : ''}` : '-',
          items: booking.serviceType,
          totalAmount: subtotal,
          amountPaid: subtotal,
          paymentMethod,
          notes: booking.notes || '',
          bookingDate: booking.bookingDate.toISOString().split('T')[0],
        }),
      });
      console.log(`[Payment] Receipt sent for booking ${bookingId}`);

      const servicesString = booking.serviceType?.toLowerCase() || '';
      const includesRepaint = servicesString.includes('repaint');
      const includesCoating = servicesString.includes('coating');

      if (includesRepaint) {
        await fetch(`${backendUrl}/generate-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType: 'garansi_repaint',
            customerName: booking.customerName || booking.customer?.name,
            customerPhone: booking.customerPhone,
            motorDetails: booking.vehicleModel ? `${booking.vehicleModel}${booking.plateNumber ? ' - ' + booking.plateNumber : ''}` : '-',
            items: booking.serviceType,
            totalAmount: subtotal,
            amountPaid: subtotal,
            paymentMethod,
            notes: booking.notes || '',
            bookingDate: booking.bookingDate.toISOString().split('T')[0],
          }),
        });
        console.log(`[Payment] Warranty Repaint sent for booking ${bookingId}`);
      }

      if (includesCoating) {
        await fetch(`${backendUrl}/generate-invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType: 'garansi_coating',
            customerName: booking.customerName || booking.customer?.name,
            customerPhone: booking.customerPhone,
            motorDetails: booking.vehicleModel ? `${booking.vehicleModel}${booking.plateNumber ? ' - ' + booking.plateNumber : ''}` : '-',
            items: booking.serviceType,
            totalAmount: subtotal,
            amountPaid: subtotal,
            paymentMethod,
            notes: booking.notes || '',
            bookingDate: booking.bookingDate.toISOString().split('T')[0],
          }),
        });
        console.log(`[Payment] Warranty Coating sent for booking ${bookingId}`);

        // Create coating maintenance record (6 months later)
        const maintenanceDate = new Date();
        maintenanceDate.setMonth(maintenanceDate.getMonth() + 6);

        await prisma.coatingMaintenance.create({
          data: {
            bookingId: bookingId,
            customerName: booking.customerName || booking.customer?.name || 'Unknown',
            customerPhone: booking.customerPhone || '',
            vehicleInfo: booking.vehicleModel ? `${booking.vehicleModel}${booking.plateNumber ? ' - ' + booking.plateNumber : ''}` : '-',
            maintenanceDate,
            status: 'pending',
          }
        });
      }
    } catch (e) {
      console.warn(`[Payment] Failed to send document for booking ${bookingId}:`, e);
    }

    // 2. Update Booking Status to PAID
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'PAID',
        paymentMethod,
      }
    });

    // 3. Create or Update Transaction for the payment
    const existingTransaction = await prisma.transaction.findUnique({
      where: { bookingId }
    });

    if (existingTransaction) {
      await prisma.transaction.update({
        where: { id: existingTransaction.id },
        data: {
          amount: finalAmount,
          status: 'PAID',
          paymentMode: paymentMethod.toLowerCase(),
          description: `Pelunasan Service: ${booking.serviceType}${dp > 0 ? ` (DP Rp ${dp.toLocaleString()} sudah dibayar)` : ''}`,
        }
      });
    } else {
      await prisma.transaction.create({
        data: {
          customerId: booking.customerId,
          bookingId,
          amount: finalAmount,
          type: 'income',
          status: 'PAID',
          description: `Pelunasan Service: ${booking.serviceType}${dp > 0 ? ` (DP Rp ${dp.toLocaleString()} sudah dibayar)` : ''}`,
          paymentMode: paymentMethod.toLowerCase(),
        }
      });
    }

    // 4. Update customer totalSpending
    if (booking.customerId && finalAmount > 0) {
      await prisma.customer.update({
        where: { id: booking.customerId },
        data: { 
          totalSpending: { increment: finalAmount },
          lastService: booking.bookingDate
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Pembayaran lunas untuk ${booking.customerName || booking.customer?.name} berhasil disimpan.`
    });
  } catch (error: any) {
    console.error('[Payment] Error processing payment:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}