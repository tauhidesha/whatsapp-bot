/**
 * Serverless-compatible Debounce Queue using Firestore TTL
 * 
 * Because Vercel/serverless functions are stateless, we can't use in-memory timers.
 * Instead, we buffer messages in Firestore with a TTL, and use a "last updated" 
 * timestamp to determine when to flush (process).
 * 
 * Flow:
 * 1. Webhook receives message → appendMessage() stores it in Firestore
 * 2. appendMessage() checks if enough time has passed since last message
 * 3. If debounce window has passed → flush and process
 * 4. If not → a Cloud Function / cron job will pick up stale buffers
 * 
 * For Vercel, we use a simpler approach: the webhook itself checks if it should
 * process immediately or wait. A secondary cleanup runs periodically.
 */

import { getDb, FieldValue, Timestamp } from './firebase-admin';

const DEBOUNCE_MS = parseInt(process.env.DEBOUNCE_DELAY_MS || '10000', 10);
const COLLECTION = 'messageBuffers';

export interface BufferedMessage {
  content: string;
  isMedia: boolean;
  mediaUrl?: string;
  mediaExtension?: string;
  timestamp: string;
}

/**
 * Append a message to the sender's buffer in Firestore.
 * Returns true if the buffer should be processed now (debounce window passed).
 */
export async function appendMessage(
  senderNumber: string,
  message: BufferedMessage
): Promise<{ shouldProcess: boolean; messages: BufferedMessage[] }> {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(senderNumber);

  // Use Firestore transaction for atomic read-write
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(docRef);

    const now = Date.now();
    let messages: BufferedMessage[] = [];
    let lastUpdated = 0;

    if (doc.exists) {
      const data = doc.data()!;
      messages = data.messages || [];
      lastUpdated = data.lastUpdatedMs || 0;
    }

    messages.push(message);

    tx.set(docRef, {
      senderNumber,
      messages,
      lastUpdatedMs: now,
      updatedAt: FieldValue.serverTimestamp(),
      // TTL: auto-delete after 5 minutes (safety net)
      expiresAt: Timestamp.fromDate(new Date(now + 5 * 60 * 1000)),
    });

    // If there was a previous message and the gap is less than debounce window,
    // don't process yet — caller should return early
    if (lastUpdated > 0 && (now - lastUpdated) < DEBOUNCE_MS) {
      return { shouldProcess: false, messages };
    }

    // First message in the buffer, or gap is large enough 
    // The caller should wait DEBOUNCE_MS then call flushBuffer
    return { shouldProcess: false, messages };
  });
}

/**
 * Wait for debounce window, then check if buffer is ready to flush.
 * Call this after appendMessage returns shouldProcess: false.
 */
export async function waitAndFlush(
  senderNumber: string
): Promise<BufferedMessage[] | null> {
  // Wait for debounce window
  await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS + 500));

  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(senderNumber);

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(docRef);
    if (!doc.exists) return null;

    const data = doc.data()!;
    const lastUpdatedMs = data.lastUpdatedMs || 0;
    const now = Date.now();

    // Check if enough time has passed since last message
    if ((now - lastUpdatedMs) < DEBOUNCE_MS) {
      // Another message came in, let THAT invocation handle it
      return null;
    }

    // Flush: grab all messages and delete the buffer
    const messages = data.messages || [];
    tx.delete(docRef);

    return messages as BufferedMessage[];
  });
}

/**
 * Immediately flush buffer (for admin bypass)
 */
export async function flushImmediately(
  senderNumber: string
): Promise<BufferedMessage[]> {
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(senderNumber);

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(docRef);
    if (!doc.exists) return [];

    const data = doc.data()!;
    const messages = (data.messages || []) as BufferedMessage[];
    tx.delete(docRef);
    return messages;
  });
}
