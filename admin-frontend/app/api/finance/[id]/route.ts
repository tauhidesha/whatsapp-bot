import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncBookingFinance } from '@/lib/services/financeSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/finance/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        customer: true,
        booking: true
      }
    });

    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: transaction });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH /api/finance/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await req.json();
    const { amount, category, description, paymentMethod, status } = body;

    // Get old transaction to check for bookingId
    const oldTransaction = await prisma.transaction.findUnique({
      where: { id },
      select: { bookingId: true }
    });

    if (!oldTransaction) {
      return NextResponse.json({ success: false, error: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...(amount !== undefined ? { amount: Number(amount) } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
        ...(status !== undefined ? { status } : {}),
      }
    });

    // Sync booking if it exists
    if (oldTransaction.bookingId) {
      await syncBookingFinance(oldTransaction.bookingId);
    }

    return NextResponse.json({ success: true, data: transaction, message: 'Transaksi berhasil diperbarui' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/finance/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    // Get transaction to check for bookingId before deleting
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: { bookingId: true }
    });

    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    await prisma.transaction.delete({
      where: { id }
    });

    // Sync booking if it exists
    if (transaction.bookingId) {
      await syncBookingFinance(transaction.bookingId);
    }

    return NextResponse.json({ success: true, message: 'Transaksi berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
