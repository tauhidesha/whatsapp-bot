import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationId = params.id;
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'Conversation ID tidak valid' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { label, reason } = body;

    if (!label) {
      return NextResponse.json(
        { success: false, error: 'Label wajib diisi' },
        { status: 400 }
      );
    }

    // Normalize phone from conversationId (remove @c.us or @lid)
    const phone = conversationId.replace(/@c\.us$|@lid$/, '');

    // Find customer by phone
    const customer = await prisma.customer.findUnique({
      where: { phone }
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Conversation tidak ditemukan' },
        { status: 404 }
      );
    }

    // Update customer label via CustomerContext
    const docId = phone.replace(/\D/g, '');
    
    // Upsert CustomerContext with label
    await prisma.customerContext.upsert({
      where: { id: docId },
      create: {
        id: docId,
        phone,
        customerLabel: label,
        labelReason: reason,
      },
      update: {
        customerLabel: label,
        labelReason: reason,
      }
    });

    // Also update customer status based on label
    let newStatus = customer.status;
    if (label === 'hot' || label === 'warm') {
      newStatus = 'active';
    } else if (label === 'cold') {
      newStatus = 'churned';
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { status: newStatus }
    });

    return NextResponse.json({
      success: true,
      message: 'Label percakapan berhasil diupdate',
      conversationId,
      label
    });
  } catch (error: any) {
    console.error(`Error updating conversation label for ${params.id}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}