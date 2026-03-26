import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMedia } from '@/lib/server/fonnte-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { number, mediaUrl, caption, filename } = body;

    if (!number || !mediaUrl) {
      return NextResponse.json(
        { success: false, error: 'number dan mediaUrl wajib diisi' },
        { status: 400 }
      );
    }

    // Send via Fonnte API
    const response = await sendMedia(number, mediaUrl, filename, caption);

    if (response.status) {
      // Save to Prisma
      const normalizedPhone = number.replace(/[^0-9]/g, '');
      
      const customer = await prisma.customer.findUnique({
        where: { phone: normalizedPhone }
      });

      let customerId: string;
      const textToSave = caption ? `[Media: ${mediaUrl}] ${caption}` : `[Media: ${mediaUrl}]`;

      if (!customer) {
        const newCustomer = await prisma.customer.create({
          data: {
            phone: normalizedPhone,
            name: 'New Customer',
            lastMessage: textToSave,
            lastMessageAt: new Date()
          }
        });
        customerId = newCustomer.id;
      } else {
        customerId = customer.id;
        await prisma.customer.update({
          where: { id: customer.id },
          data: {
            lastMessage: textToSave,
            lastMessageAt: new Date()
          }
        });
      }

      await prisma.directMessage.create({
        data: {
          customerId: customerId,
          senderId: number,
          role: 'admin',
          content: textToSave,
          mediaUrl: mediaUrl
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Media terkirim',
        details: response
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Gagal mengirim media via Fonnte', details: response },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error sending media:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}