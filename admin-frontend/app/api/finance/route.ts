import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { syncBookingFinance } from '@/lib/services/financeSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/finance
// Create a new transaction
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, amount, category, description, paymentMethod, customerId, bookingId, vehicleId, plateNumber, serviceType, customerName } = body;

    if (!type || !amount || (!category && type === 'expense')) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, amount, category' },
        { status: 400 }
      );
    }

    // Build description with extra details for income transactions
    let finalDescription = description || '';
    const details = [];
    if (serviceType) details.push(`Layanan: ${serviceType}`);
    if (plateNumber) details.push(`Plat: ${plateNumber}`);
    if (details.length > 0) {
      finalDescription = details.join(' | ') + (finalDescription ? `\n${finalDescription}` : '');
    }

    const transaction = await prisma.transaction.create({
      data: {
        type: type.toLowerCase() as any,
        amount: Number(amount),
        category: category || serviceType || 'general',
        description: finalDescription,
        paymentMethod: paymentMethod || 'cash',
        status: 'SUCCESS',
        ...(customerId ? { customerId } : {}),
        ...(bookingId ? { bookingId } : {}),
      }
    });

    // Handle data correlation: sync booking if bookingId is provided
    if (bookingId) {
      await syncBookingFinance(bookingId);
    }

    return NextResponse.json({
      success: true,
      data: transaction,
      message: 'Transaksi berhasil dicatat',
    });
  } catch (error: any) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mencatat transaksi', details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/finance
// Fetch transactions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const type = searchParams.get('type');

    const where: any = {};
    if (type) where.type = type.toLowerCase();

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        customer: { 
          select: { 
            name: true, 
            phone: true,
            vehicles: {
              select: {
                modelName: true,
                plateNumber: true,
              },
              take: 1,
            }
          } 
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: transactions
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
