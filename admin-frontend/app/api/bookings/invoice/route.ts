import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      documentType = 'invoice',
      customerName,
      customerPhone,
      motorDetails,
      items,
      totalAmount,
      amountPaid,
      paymentMethod,
      notes,
      bookingDate,
    } = body;

    // Use environment variable if set, otherwise use the ngrok URL for GCP backend
    const backendUrl = process.env.BACKEND_API_URL || 'https://unblissful-unverdantly-stan.ngrok-free.dev';

    console.log(`[Invoice] Forwarding generate-invoice request to Backend: ${backendUrl}/generate-invoice`);

    const response = await fetch(`${backendUrl}/generate-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentType,
        customerName,
        customerPhone,
        motorDetails,
        items,
        totalAmount,
        amountPaid,
        paymentMethod,
        notes,
        bookingDate,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return NextResponse.json({
        success: true,
        message: data.message,
      });
    } else {
      console.error('[Invoice] Backend failed to generate/send invoice:', data);
      return NextResponse.json(
        { success: false, error: data.error || 'Backend failed to send invoice via WA client', details: data },
        { status: response.status || 500 }
      );
    }
  } catch (error: any) {
    console.error('[Invoice] Error proxying to backend:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to backend server', details: error.message },
      { status: 500 }
    );
  }
}

