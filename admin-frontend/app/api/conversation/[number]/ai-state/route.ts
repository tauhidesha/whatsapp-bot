import { NextRequest, NextResponse } from 'next/server';
import { setSnoozeMode, clearSnoozeMode } from '@/lib/server/human-handover';

export async function POST(
  req: NextRequest,
  { params }: { params: { number: string } }
) {
  try {
    const number = params.number;
    if (!number) {
      return NextResponse.json(
        { success: false, error: 'Nomor WhatsApp tidak valid' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { enabled, reason } = body;

    // "enabled" means AI should be active. 
    // If AI is NOT enabled, we PAUSE it (snooze mode).
    if (enabled) {
      await clearSnoozeMode(number);
    } else {
      await setSnoozeMode(number, 60, { manual: true, reason });
    }

    return NextResponse.json({
      success: true,
      message: enabled ? 'AI bot diaktifkan' : 'AI bot dijeda (snooze active)',
      state: {
        aiEnabled: enabled,
        aiPaused: !enabled
      }
    });
  } catch (error: any) {
    console.error(`Error updating AI state for ${params.number}:`, error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
