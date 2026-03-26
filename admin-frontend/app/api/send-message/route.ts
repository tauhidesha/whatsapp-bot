import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendText } from '@/lib/server/fonnte-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { number, message } = body;

    if (!number || !message) {
      return NextResponse.json(
        { success: false, error: 'number dan message wajib diisi' },
        { status: 400 }
      );
    }

    // Send via Fonnte API
    const response = await sendText(number, message);

    if (response.status) {
      // Save to Prisma
      const normalizedPhone = number.replace(/[^0-9]/g, '');
      
      const customer = await prisma.customer.findUnique({
        where: { phone: normalizedPhone }
      });

      let customerId: string;
      
      if (!customer) {
        const newCustomer = await prisma.customer.create({
          data: {
            phone: normalizedPhone,
            name: 'New Customer',
            lastMessage: message,
            lastMessageAt: new Date()
          }
        });
        customerId = newCustomer.id;
      } else {
        customerId = customer.id;
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            lastMessage: message,
            lastMessageAt: new Date()
          }
        });
      }

      await prisma.directMessage.create({
        data: {
          customerId: customerId,
          senderId: number,
          role: 'admin',
          content: message
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Pesan terkirim',
        details: response
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Gagal mengirim pesan via Fonnte', details: response },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}