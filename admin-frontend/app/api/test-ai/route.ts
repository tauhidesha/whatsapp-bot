import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const playgroundDocId = 'playground_test';

/**
 * Test AI endpoint for the admin playground
 * Langsung panggil LangChain engine — tanpa proxy ke ADK
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history, mode, media, model_override } = body;

    if (!message && (!media || media.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Pesan atau media wajib diisi' },
        { status: 400 }
      );
    }

    // Build providedHistory dari format playground [{role, content}]
    const providedHistory = (history || []).map((h: { role: string; content: string }) => ({
      role: h.role === 'assistant' || h.role === 'ai' ? 'ai' : 'human',
      content: h.content,
    }));

    // Extract media info jika ada (playground kirim base64 atau URL)
    const firstMedia = media?.[0] ?? null;
    const mediaUrl = firstMedia?.url ?? null;
    const mediaExtension = firstMedia?.extension ?? firstMedia?.mimeType?.split('/')?.[1] ?? null;

    const isAdminOverride = mode === 'admin' ? true : mode === 'customer' ? false : undefined;

    // Proxy to GCP backend
    const gcpBackendUrl = 'https://ebd7-104-197-168-252.ngrok-free.app/test-ai';
    
    console.log(`[Test-AI] Proxying to GCP: ${gcpBackendUrl}`);

    const response = await fetch(gcpBackendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message || '',
        senderNumber: playgroundDocId,
        mode: mode || 'customer',
        model_override,
        history: providedHistory,
        media: media, // Forward media as-is
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GCP Backend Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      response: result.ai_response,
      isAdmin: result.mode === 'admin',
      toolsCalled: result.toolsCalled || [], // app.js doesn't return toolsCalled in the snippet I saw, but it's okay
      runId: result.run_id,
    });

  } catch (error: any) {
    console.error('[Test-AI] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
