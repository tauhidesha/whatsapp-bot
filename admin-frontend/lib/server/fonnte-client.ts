/**
 * Fonnte WhatsApp API Client
 * REST wrapper for sending messages via Fonnte
 * Docs: https://docs.fonnte.com/api-send-message/
 */

const FONNTE_API_URL = 'https://api.fonnte.com/send';

function getFonnteToken(): string {
  const token = process.env.FONNTE_TOKEN;
  if (!token) throw new Error('FONNTE_TOKEN is not configured');
  return token;
}

export interface FonnteSendOptions {
  target: string;
  message?: string;
  url?: string;
  filename?: string;
  typing?: boolean;
  delay?: string;
  countryCode?: string;
  location?: string;
  connectOnly?: boolean;
}

export interface FonnteResponse {
  status: boolean;
  detail?: string;
  id?: string;
}

/**
 * Send a message/media via Fonnte API
 */
async function fonnteSend(options: FonnteSendOptions): Promise<FonnteResponse> {
  const token = getFonnteToken();

  const body: Record<string, string | boolean> = {
    target: options.target,
  };

  if (options.message) body.message = options.message;
  if (options.url) body.url = options.url;
  if (options.filename) body.filename = options.filename;
  if (options.typing !== undefined) body.typing = options.typing;
  if (options.delay) body.delay = options.delay;
  if (options.countryCode) body.countryCode = options.countryCode;
  if (options.location) body.location = options.location;
  if (options.connectOnly !== undefined) body.connectOnly = options.connectOnly;

  const response = await fetch(FONNTE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return data as FonnteResponse;
}

/**
 * Send a text message
 */
export async function sendText(target: string, message: string): Promise<FonnteResponse> {
  console.log(`[Fonnte] Sending text to ${target}: "${message.substring(0, 50)}..."`);
  return fonnteSend({ target, message, typing: true });
}

/**
 * Send a media message (image, video, file, audio)
 */
export async function sendMedia(
  target: string,
  mediaUrl: string,
  filename?: string,
  caption?: string
): Promise<FonnteResponse> {
  console.log(`[Fonnte] Sending media to ${target}: ${mediaUrl}`);
  return fonnteSend({
    target,
    message: caption,
    url: mediaUrl,
    filename,
  });
}

/**
 * Send typing indicator
 */
export async function sendTyping(target: string, durationSeconds = 3): Promise<FonnteResponse> {
  return fonnteSend({
    target,
    typing: true,
    delay: String(durationSeconds),
  });
}

/**
 * Send a location
 */
export async function sendLocation(
  target: string,
  latitude: number,
  longitude: number,
  message?: string
): Promise<FonnteResponse> {
  return fonnteSend({
    target,
    message,
    location: `${latitude},${longitude}`,
  });
}

/**
 * Download attachment from Fonnte webhook URL
 */
export async function downloadAttachment(url: string): Promise<{
  buffer: Buffer;
  arrayBuffer: ArrayBuffer;
}> {
  console.log(`[Fonnte] Downloading attachment: ${url}`);
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    arrayBuffer,
  };
}
