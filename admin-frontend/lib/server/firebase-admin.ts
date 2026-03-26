/**
 * Firebase Admin SDK — Server-side only
 * Handles Firestore operations for messages, conversations, metadata
 */

import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

let db: Firestore | null = null;

export function getDb(): Firestore {
  if (db) return db;

  if (getApps().length === 0) {
    const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    const json = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (base64) {
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      initializeApp({ credential: cert(JSON.parse(decoded) as ServiceAccount) });
    } else if (json) {
      initializeApp({ credential: cert(JSON.parse(json) as ServiceAccount) });
    } else {
      console.warn('⚠️ [Firebase] No credential found, using ADC');
      initializeApp();
    }
  }

  db = getFirestore();
  return db;
}

// --- Sender Identity Utilities ---
const WHATSAPP_SUFFIX = '@c.us';

export interface SenderIdentity {
  docId: string;
  channel: string;
  platformId: string | null;
  normalizedAddress: string;
}

export function parseSenderIdentity(rawValue: string): SenderIdentity {
  const trimmed = (rawValue || '').trim();
  if (!trimmed) {
    return { docId: '', channel: 'unknown', platformId: null, normalizedAddress: '' };
  }

  if (trimmed.endsWith('@lid')) {
    const baseId = trimmed.slice(0, -4);
    return { docId: baseId, channel: 'whatsapp', platformId: baseId, normalizedAddress: trimmed };
  }

  const hasWhatsappSuffix = trimmed.endsWith(WHATSAPP_SUFFIX);
  const baseId = hasWhatsappSuffix ? trimmed.slice(0, -WHATSAPP_SUFFIX.length) : trimmed;

  let channel = 'whatsapp';
  let platformId: string | null = baseId;

  if (baseId.includes(':')) {
    const [channelPart, ...rest] = baseId.split(':');
    channel = channelPart || 'unknown';
    platformId = rest.length ? rest.join(':') : null;
  }

  const normalizedAddress = channel === 'whatsapp' ? `${baseId}${WHATSAPP_SUFFIX}` : baseId;

  return { docId: baseId, channel, platformId, normalizedAddress };
}

export function normalizeWhatsappNumber(number: string): string | null {
  if (!number) return null;
  let trimmed = number.trim();
  if (!trimmed) return null;

  if (trimmed.endsWith('@c.us') || trimmed.endsWith('@lid')) {
    return trimmed.replace(/\s+/g, '');
  }

  const isPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/[^0-9]/g, '');

  if (!isPlus && digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  }

  if (digits.length >= 14 && !digits.startsWith('62')) {
    return `${digits}@lid`;
  }

  return `${digits}@c.us`;
}

// --- Message Operations ---

export async function saveMessageToFirestore(
  senderNumber: string,
  message: string,
  senderType: 'user' | 'ai' | 'admin'
) {
  const firestore = getDb();
  const { docId, channel, platformId } = parseSenderIdentity(senderNumber);
  if (!docId) return;

  try {
    const messagesRef = firestore.collection('directMessages').doc(docId).collection('messages');
    const serverTimestamp = FieldValue.serverTimestamp();

    await messagesRef.add({
      text: message,
      timestamp: serverTimestamp,
      sender: senderType,
    });

    await firestore.collection('directMessages').doc(docId).set(
      {
        lastMessage: message,
        lastMessageSender: senderType,
        lastMessageAt: serverTimestamp,
        updatedAt: serverTimestamp,
        messageCount: FieldValue.increment(1),
        channel,
        platform: channel,
        platformId: platformId || docId,
        fullSenderId: senderNumber,
      },
      { merge: true }
    );
  } catch (error) {
    console.error('[Firebase] Error saving message:', error);
  }
}

export interface MessageEntry {
  text: string;
  sender: string;
  timestamp: FirebaseFirestore.Timestamp;
}

export async function getConversationHistory(
  senderNumber: string,
  limit = 3
): Promise<MessageEntry[]> {
  const firestore = getDb();
  const { docId } = parseSenderIdentity(senderNumber);
  if (!docId) return [];

  try {
    const snapshot = await firestore
      .collection('directMessages')
      .doc(docId)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const messages: MessageEntry[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        text: data.text,
        sender: data.sender,
        timestamp: data.timestamp,
      });
    });

    return messages.reverse(); // chronological order
  } catch (error) {
    console.error('[Firebase] Error getting history:', error);
    return [];
  }
}

export async function saveSenderMeta(senderNumber: string, displayName: string) {
  const firestore = getDb();
  const { docId, channel, platformId } = parseSenderIdentity(senderNumber);
  if (!docId) return;

  try {
    await firestore.collection('directMessages').doc(docId).set(
      {
        name: displayName,
        channel,
        platform: channel,
        platformId: platformId || docId,
        fullSenderId: senderNumber,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('[Firebase] Error saving sender meta:', error);
  }
}

function serializeTimestamp(timestamp: any): string | null {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return null;
}

export async function listConversations(limit = 100) {
  const firestore = getDb();
  try {
    const snapshot = await firestore.collection('directMessages').get();
    const conversations = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        senderNumber: data.fullSenderId || doc.id,
        name: data.name || null,
        lastMessage: data.lastMessage || null,
        lastMessageSender: data.lastMessageSender || null,
        lastMessageAt: serializeTimestamp(data.lastMessageAt),
        updatedAt: serializeTimestamp(data.updatedAt),
        messageCount: typeof data.messageCount === 'number' ? data.messageCount : null,
        channel: data.channel || 'whatsapp',
        platformId: data.platformId || doc.id,
        label: data.customerLabel || null,
        labelReason: data.labelReason || null,
        profilePicUrl: data.profilePicUrl?.eurl || data.profilePicUrl || null,
      };
    });

    conversations.sort((a, b) => {
      const timeA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const timeB = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return timeB - timeA;
    });

    return limit ? conversations.slice(0, limit) : conversations;
  } catch (error) {
    console.error('[Firebase] Error listing conversations:', error);
    return [];
  }
}

export async function listCustomers(limit = 100) {
  const firestore = getDb();
  try {
    const snapshot = await firestore.collection('customers')
      .orderBy('updatedAt', 'desc')
      .limit(limit || 100)
      .get();
      
    const customers = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      
      return {
        id: doc.id,
        name: data.name || doc.id,
        phone: data.phone || data.realPhone || doc.id,
        lastService: serializeTimestamp(data.lastService) || '-',
        totalSpending: Number(data.totalSpending) || 0,
        bikes: Array.isArray(data.bikes) ? data.bikes : [],
        status: data.status || 'new',
        notes: data.notes || '',
      };
    });

    return customers;
  } catch (error) {
    console.error('[Firebase] Error listing customers:', error);
    return [];
  }
}

export async function listFollowUpQueue() {
  const db = getDb();
  try {
    const [dmSnapshot, ctxSnapshot] = await Promise.all([
      db.collection('directMessages').get(),
      db.collection('customerContext').get()
    ]);

    const ctxMap = new Map();
    ctxSnapshot.forEach(doc => ctxMap.set(doc.id, doc.data()));

    const followUps: any[] = [];
    const now = new Date();

    dmSnapshot.forEach(doc => {
      const data = doc.data();
      const label = data.customerLabel;
      
      // Skip if no label or user explicitly rejected / completely dormant
      if (!label || label === 'dormant_lead') return; 

      const phone = doc.id;
      const ctx = ctxMap.get(phone) || {};
      
      if (ctx.blocked || ctx.followup_converted) return;

      const lastMessageAt = data.lastMessageAt?.toDate();
      const lastFollowUpAt = ctx.last_followup_at?.toDate();
      
      let status = 'upcoming';
      let dueDateStr = 'Hari Ini';
      
      if (lastFollowUpAt) {
          const daysSinceFollowUp = (now.getTime() - lastFollowUpAt.getTime()) / (1000 * 3600 * 24);
          if (daysSinceFollowUp < 1) { 
             status = 'sent';
             dueDateStr = 'Selesai';
          } else if (daysSinceFollowUp > 7 && ['hot_lead', 'cold_lead'].includes(label)) {
             status = 'overdue';
             dueDateStr = 'Terlewat';
          } else if (daysSinceFollowUp <= 7 && status !== 'sent') {
             // Still in holding period, skip from upcoming queue unless they are overdue
             // or we can just categorize them as upcoming but due later
             return; 
          }
      }

      let lastServiceDate = '-';
      if (lastMessageAt) {
          lastServiceDate = lastMessageAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      }

      // Generate a dynamic template 
      let greetPrefix = status === 'sent' ? 'Pesan terkirim:' : 'Template AI:';
      let message = `${greetPrefix} Halo kak ${data.name || ''}, apa kabar? Kami perhatikan motor kakak sudah waktunya di-cek lagi nih. Mampir yuk ke BosMat!`;

      followUps.push({
        id: phone,
        customerName: data.name || 'Pelanggan',
        phone: phone.replace('@c.us', ''),
        lastServiceDate: lastServiceDate,
        serviceType: label.replace('_', ' ').toUpperCase(),
        dueDate: dueDateStr,
        status: status as 'upcoming' | 'sent' | 'overdue',
        message: message,
      });
    });

    // Sort: upcoming first, then overdue, then sent
    return followUps.sort((a, b) => {
        const order: Record<string, number> = { 'upcoming': 1, 'overdue': 2, 'sent': 3 };
        return order[a.status] - order[b.status];
    });

  } catch (error) {
    console.error('[Firebase] Error computing follow-ups:', error);
    return [];
  }
}

export { FieldValue, Timestamp };
