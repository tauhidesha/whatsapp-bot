# Planning: Follow Up Engine (Full)

## Tujuan

Sistem proaktif yang nurture customer berdasarkan label — tepat waktu, tepat orang, tepat angle. Tidak terasa bot, tidak spam.

---

## Arsitektur Lengkap

```
DAILY CRON (09:00)
        │
        ▼
┌───────────────────┐
│   scheduler.js    │
│                   │
│ 1. Label downgrade│
│ 2. Scan eligible  │
│ 3. Build queue    │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ messageGenerator  │
│                   │
│ 1. Fetch promo    │
│ 2. Fetch context  │
│ 3. Generate pesan │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ stopCondition.js  │
│                   │
│ 1. Cek hard stops │
│ 2. Cek soft stops │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Kirim via WA     │
│  + update signal  │
└───────────────────┘


REALTIME (setiap pesan masuk)
        │
        ▼
┌───────────────────┐
│ signalTracker.js  │
│                   │
│ 1. replied_after  │
│    _followup      │
│ 2. stop keywords  │
│ 3. converted      │
└───────────────────┘
```

---

## File Structure

```
src/ai/agents/followUpEngine/
  ├── index.js              ← Entry point & orchestrator
  ├── scheduler.js          ← Cron + eligibility + downgrade
  ├── messageGenerator.js   ← LLM-generated messages
  ├── signalTracker.js      ← Update sinyal real-time
  └── stopCondition.js      ← Stop logic

src/ai/utils/
  └── promoConfig.js        ← getActivePromo() + cache
```

---

## promoConfig.js

```javascript
// src/ai/utils/promoConfig.js

const admin = require('firebase-admin');

let promoCache = null;
let promoCacheAt = 0;
const PROMO_CACHE_TTL = 5 * 60 * 1000; // 5 menit

async function getActivePromo() {
  const now = Date.now();

  // Return cache kalau masih fresh
  if (promoCache !== null && (now - promoCacheAt) < PROMO_CACHE_TTL) {
    return promoCache;
  }

  try {
    const db = admin.firestore();
    const doc = await db.collection('settings')
      .doc('promo_config').get();

    const data = doc.exists ? doc.data() : null;
    promoCache = (data?.isActive && data?.promoText)
      ? data.promoText
      : null;
    promoCacheAt = now;

    return promoCache;
  } catch (error) {
    console.warn('[PromoConfig] Gagal fetch promo:', error.message);
    return promoCache; // Return cache lama kalau gagal
  }
}

function invalidatePromoCache() {
  promoCache = null;
  promoCacheAt = 0;
  console.log('[PromoConfig] Cache invalidated.');
}

module.exports = { getActivePromo, invalidatePromoCache };
```

---

## signalTracker.js

```javascript
// src/ai/agents/followUpEngine/signalTracker.js
// Jalan REALTIME setiap pesan masuk dari customer

const admin = require('firebase-admin');
const { parseSenderIdentity } = require('../../lib/utils.js');

const STOP_KEYWORDS = [
  'stop', 'jangan', 'tidak usah', 'ga usah',
  'hapus', 'unsubscribe', 'berhenti', 'ganggu',
  'spam', 'blokir'
];

async function updateSignalsOnIncomingMessage(senderNumber, messageText) {
  const { docId } = parseSenderIdentity(senderNumber);
  if (!docId) return;

  const db = admin.firestore();
  const ref = db.collection('customerContext').doc(docId);

  try {
    const doc = await ref.get();
    if (!doc.exists) return;

    const context = doc.data();
    const updates = {};

    // 1. Customer balas setelah di-follow up
    if (context.last_followup_at && !context.replied_after_followup) {
      const lastFollowUp = context.last_followup_at?.toDate?.();
      const lastChat = context.last_customer_reply_at?.toDate?.();

      if (!lastChat || (lastFollowUp && lastFollowUp > lastChat)) {
        updates.replied_after_followup = true;
        updates.followup_reply_at = admin.firestore.FieldValue.serverTimestamp();
        console.log(`[SignalTracker] ${docId} replied after follow up`);
      }
    }

    // 2. Detect explicit stop
    const lowerMsg = messageText.toLowerCase();
    const isStopRequest = STOP_KEYWORDS.some(k => lowerMsg.includes(k));
    if (isStopRequest) {
      updates.explicitly_rejected = true;
      updates.follow_up_strategy = 'stop';
      updates.rejected_at = admin.firestore.FieldValue.serverTimestamp();
      console.log(`[SignalTracker] ${docId} explicitly rejected follow up`);
    }

    // 3. Track last customer reply timestamp
    updates.last_customer_reply_at = admin.firestore.FieldValue.serverTimestamp();

    if (Object.keys(updates).length > 0) {
      await ref.update(updates);
    }
  } catch (error) {
    console.warn('[SignalTracker] Error:', error.message);
  }
}

async function markAsConverted(senderNumber) {
  const { docId } = parseSenderIdentity(senderNumber);
  if (!docId) return;

  const db = admin.firestore();
  await db.collection('customerContext').doc(docId).update({
    followup_converted: true,
    converted_at: admin.firestore.FieldValue.serverTimestamp(),
    customer_label: 'existing',
    follow_up_strategy: 'retention',
    label_reason: 'converted after follow up',
    label_updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`[SignalTracker] ${docId} marked as converted`);
}

module.exports = { updateSignalsOnIncomingMessage, markAsConverted };
```

---

## stopCondition.js

```javascript
// src/ai/agents/followUpEngine/stopCondition.js

async function shouldStop(context) {
  // Hard stops — tidak pernah kirim
  if (context.explicitly_rejected) {
    return { stop: true, reason: 'explicitly_rejected' };
  }
  if (context.blocked) {
    return { stop: true, reason: 'blocked' };
  }
  if (context.customer_label === 'dormant_lead') {
    return { stop: true, reason: 'dormant_lead' };
  }
  if (context.follow_up_strategy === 'stop') {
    return { stop: true, reason: 'strategy_stop' };
  }

  // Soft stops — ghost 2x setelah follow up
  const followupCount = context.followup_count || 0;
  const repliedAfter = context.replied_after_followup || false;
  const strategy = STRATEGY_CONFIG[context.customer_label];

  if (
    strategy &&
    followupCount >= strategy.maxFollowUps &&
    !repliedAfter
  ) {
    return {
      stop: true,
      reason: `ghost_${followupCount}x`,
      action: 'downgrade_to_dormant'
    };
  }

  return { stop: false };
}

async function handleStopAction(docId, stopResult) {
  if (!stopResult.stop) return;

  if (stopResult.action === 'downgrade_to_dormant') {
    const db = admin.firestore();
    await db.collection('customerContext').doc(docId).update({
      customer_label: 'dormant_lead',
      follow_up_strategy: 'stop',
      label_reason: stopResult.reason,
      previous_label: context.customer_label,
      label_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[StopCondition] ${docId} downgraded to dormant_lead`);
  }
}

module.exports = { shouldStop, handleStopAction };
```

---

## scheduler.js

```javascript
// src/ai/agents/followUpEngine/scheduler.js

const cron = require('node-cron');

const STRATEGY_CONFIG = {
  hot_lead: {
    action: 'follow_up',
    waitDays: 1,
    intervalDays: 3,
    maxFollowUps: 2,
    angle: 'urgency',
  },
  warm_lead: {
    action: 'follow_up',
    waitDays: 2,
    intervalDays: 7,
    maxFollowUps: 2,
    angle: 'value',
  },
  window_shopper: {
    action: 'follow_up',
    waitDays: 7,
    intervalDays: 14,
    maxFollowUps: 1,
    angle: 'promo',       // Hanya kalau ada promo aktif
  },
  existing: {
    action: 'follow_up',
    waitDays: 45,
    intervalDays: 30,
    maxFollowUps: 3,
    angle: 'maintenance',
  },
  loyal: {
    action: 'follow_up',
    waitDays: 60,
    intervalDays: 30,
    maxFollowUps: 2,
    angle: 'exclusive',
  },
  churned: {
    action: 'follow_up',
    waitDays: 0,
    intervalDays: 30,
    maxFollowUps: 2,
    angle: 'winback',
  },
  dormant_lead: { action: 'stop' },
};

// Label downgrade rules
const DOWNGRADE_RULES = [
  {
    from: 'hot_lead',
    to: 'warm_lead',
    condition: (ctx, meta) =>
      getDaysSince(meta.lastMessageAt) > 7 && ctx.tx_count === 0,
    reason: 'hot_lead tidak reply > 7 hari',
  },
  {
    from: 'warm_lead',
    to: 'window_shopper',
    condition: (ctx, meta) =>
      (ctx.ghosted_times || 0) >= 1 &&
      getDaysSince(meta.lastMessageAt) > 14,
    reason: 'warm_lead ghosted > 14 hari',
  },
  {
    from: 'existing',
    to: 'churned',
    condition: (ctx) => getDaysSince(ctx.last_transaction_at) > 90,
    reason: 'existing tidak balik > 90 hari',
  },
  {
    from: 'loyal',
    to: 'churned',
    condition: (ctx) => getDaysSince(ctx.last_transaction_at) > 180,
    reason: 'loyal tidak balik > 180 hari',
  },
];

function isEligible(context, metadata) {
  const label = context.customer_label;
  const strategy = STRATEGY_CONFIG[label];

  if (!strategy || strategy.action === 'stop') return false;
  if (context.explicitly_rejected) return false;
  if (context.blocked) return false;
  if (context.followup_converted) return false;

  const followupCount = context.followup_count || 0;
  if (followupCount >= strategy.maxFollowUps) return false;

  const daysSinceLastChat = getDaysSince(metadata.lastMessageAt);
  const daysSinceLastFollowUp = getDaysSince(context.last_followup_at);

  if (daysSinceLastChat < strategy.waitDays) return false;
  if (daysSinceLastFollowUp !== null &&
      daysSinceLastFollowUp < strategy.intervalDays) return false;

  // Window shopper: hanya follow up kalau ada promo aktif
  // (dicek di messageGenerator, bukan di sini)

  return true;
}

function getHumanizedSendTime() {
  // Variasi ±30 menit, tidak pernah tepat jam
  const baseHour = 9;
  const minuteVariance = Math.floor(Math.random() * 60);
  const hourBonus = Math.random() > 0.7 ? 1 : 0;
  return { hour: baseHour + hourBonus, minute: minuteVariance };
}

function getDaysSince(timestamp) {
  if (!timestamp) return null;
  const date = timestamp?.toDate?.() || new Date(timestamp);
  return Math.floor((Date.now() - date.getTime()) / 86400000);
}

async function runDailyFollowUp() {
  const db = admin.firestore();
  console.log('[Scheduler] Starting daily follow up run...');

  // 1. Scan semua customerContext
  const snapshot = await db.collection('customerContext').get();
  const queue = [];

  for (const doc of snapshot.docs) {
    const context = doc.data();
    const docId = doc.id;

    // Ambil metadata dari directMessages
    const metaDoc = await db.collection('directMessages').doc(docId).get();
    if (!metaDoc.exists) continue;
    const metadata = metaDoc.data();

    // 2. Label downgrade check
    for (const rule of DOWNGRADE_RULES) {
      if (context.customer_label === rule.from &&
          rule.condition(context, metadata)) {
        await doc.ref.update({
          customer_label: rule.to,
          previous_label: rule.from,
          label_reason: rule.reason,
          label_updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        context.customer_label = rule.to; // Update local copy
        console.log(`[Scheduler] Downgrade ${docId}: ${rule.from} → ${rule.to}`);
        break;
      }
    }

    // 3. Eligibility check
    if (!isEligible(context, metadata)) continue;

    queue.push({
      docId,
      senderNumber: metadata.fullSenderId || docId,
      name: metadata.name || 'Mas',
      context,
      metadata,
      strategy: STRATEGY_CONFIG[context.customer_label],
    });
  }

  console.log(`[Scheduler] Queue: ${queue.length} customers eligible`);

  // 4. Generate & kirim pesan per customer
  // Stagger pengiriman agar tidak blast sekaligus
  for (let i = 0; i < queue.length; i++) {
    const customer = queue[i];
    const staggerDelay = i * 30000; // 30 detik antar customer

    setTimeout(async () => {
      await processFollowUp(customer);
    }, staggerDelay);
  }
}

async function processFollowUp(customer) {
  const { docId, senderNumber, context, strategy } = customer;

  try {
    // Check stop conditions
    const { shouldStop, handleStopAction } = require('./stopCondition.js');
    const stopResult = await shouldStop(context);

    if (stopResult.stop) {
      await handleStopAction(docId, stopResult);
      return;
    }

    // Generate pesan
    const { generateFollowUpMessage } = require('./messageGenerator.js');
    const message = await generateFollowUpMessage(customer, strategy);

    // Null = tidak ada promo, skip window_shopper
    if (!message) {
      console.log(`[Scheduler] Skip ${docId}: no message generated`);
      return;
    }

    // Kirim via WhatsApp
    if (!global.whatsappClient) {
      console.warn('[Scheduler] WhatsApp client not available');
      return;
    }

    await global.whatsappClient.sendText(senderNumber, message);
    console.log(`[Scheduler] ✅ Sent to ${docId}: "${message.substring(0, 50)}..."`);

    // Update signal setelah kirim
    const db = admin.firestore();
    await db.collection('customerContext').doc(docId).update({
      followup_count: admin.firestore.FieldValue.increment(1),
      last_followup_at: admin.firestore.FieldValue.serverTimestamp(),
      last_followup_strategy: strategy.angle,
      replied_after_followup: false, // Reset, tunggu reply baru
    });

    // Simpan ke directMessages
    const { saveMessageToFirestore } = require('../../../app.js');
    // Note: extract saveMessageToFirestore ke utils agar bisa diimport

  } catch (error) {
    console.error(`[Scheduler] Error processing ${docId}:`, error.message);
  }
}

function startFollowUpScheduler() {
  // Setiap hari jam 09:00 WIB (UTC+7 = 02:00 UTC)
  cron.schedule('0 2 * * *', async () => {
    // Skip Minggu
    const day = new Date().getDay();
    if (day === 0) {
      console.log('[Scheduler] Skip Sunday');
      return;
    }
    await runDailyFollowUp();
  });

  console.log('✅ [FollowUp Scheduler] Started (daily 09:00 WIB, skip Sunday)');
}

module.exports = { startFollowUpScheduler, STRATEGY_CONFIG, getDaysSince };
```

---

## messageGenerator.js

```javascript
// src/ai/agents/followUpEngine/messageGenerator.js

const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage } = require('@langchain/core/messages');
const { getActivePromo } = require('../../utils/promoConfig.js');
const { extractTextFromAIContent } = require('../../../app.js');
// Note: extract extractTextFromAIContent ke utils

const ANGLE_INSTRUCTIONS = {
  urgency: `Buat pesan singkat yang menyebut slot minggu ini
            mulai terbatas. Jangan terkesan memaksa.
            Tidak perlu sebut promo kecuali ada.`,

  value: `Berikan 1 tips perawatan motor yang relevan dengan
          kondisi atau tipe motornya. Tutup dengan 1 kalimat
          ajakan ringan. Jangan langsung jualan.`,

  promo: null, // Diisi dinamis dari Firestore

  maintenance: `Ingatkan bahwa sudah waktunya servis lagi
                berdasarkan layanan terakhir. Gunakan angle
                "sayang kalau dibiarkan" bukan "ayo beli".`,

  exclusive: `Buat pesan yang terasa personal dan eksklusif.
              Customer ini pelanggan setia — jangan jualan,
              buat mereka merasa diperhatikan.`,

  winback: `Sebut 1 hal baru di Bosmat (teknik, layanan, atau
            hasil kerja terbaru). Jangan minta mereka balik —
            biarkan mereka penasaran sendiri.`,
};

async function generateFollowUpMessage(customer, strategy) {
  const { name, context, metadata } = customer;
  const angle = strategy.angle;

  // Fetch promo
  const activePromo = await getActivePromo();

  // Window shopper + tidak ada promo → skip
  if (angle === 'promo' && !activePromo) {
    console.log(`[Generator] Skip promo angle — no active promo`);
    return null;
  }

  // Build angle instruction
  let angleInstruction = ANGLE_INSTRUCTIONS[angle];
  if (angle === 'promo' && activePromo) {
    angleInstruction = `Sampaikan promo ini secara natural dalam
      1-2 kalimat, jangan copy paste langsung.
      Promo aktif: "${activePromo}"`;
  }

  // Inject promo ke angle lain kalau relevan
  const promoNote = activePromo && angle !== 'promo'
    ? `\nInfo tambahan: Ada promo aktif "${activePromo}".
       Sebutkan hanya jika sangat relevan dengan konteks,
       jangan dipaksakan.`
    : '';

  const prompt = `
Kamu Zoya dari Bosmat Repainting & Detailing Studio.
Tulis 1 pesan WhatsApp follow up untuk customer ini.

Data customer:
- Nama: ${name}
- Motor: ${context.motor_model || 'tidak diketahui'}
- Kondisi motor: ${context.motor_condition || 'tidak diketahui'}
- Warna motor: ${context.motor_color || 'tidak diketahui'}
- Layanan diminati: ${context.target_service || 'tidak diketahui'}
- Label: ${context.customer_label}
- Terakhir chat: ${getDaysSince(metadata.lastMessageAt)} hari lalu
- Pernah follow up sebelumnya: ${context.followup_count || 0}x

Instruksi angle: ${angleInstruction}
${promoNote}

Aturan ketat:
- Maksimal 3 kalimat
- Jangan sebut kata "follow up" atau "mengingatkan"
- Jangan tanya "sudah ada keputusan belum"
- Panggil "Mas ${name}" (bukan nama lengkap kalau panjang)
- Gaya WhatsApp: santai tapi sopan
- Jangan terlalu formal
- Jika data motor tidak ada, jangan sebut motor
- Jangan ulangi angle yang sama dengan follow up sebelumnya
`;

  try {
    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash',
      temperature: 0.8,   // Lebih tinggi untuk variasi pesan
      apiKey: process.env.GOOGLE_API_KEY,
    });

    const response = await model.invoke([new HumanMessage(prompt)]);
    const text = extractTextFromAIContent(response.content);

    return text?.trim() || null;
  } catch (error) {
    console.error('[Generator] Error generating message:', error.message);
    return null;
  }
}

module.exports = { generateFollowUpMessage };
```

---

## index.js

```javascript
// src/ai/agents/followUpEngine/index.js

const { startFollowUpScheduler } = require('./scheduler.js');
const { updateSignalsOnIncomingMessage, markAsConverted } = require('./signalTracker.js');
const { shouldStop, handleStopAction } = require('./stopCondition.js');

module.exports = {
  startFollowUpScheduler,
  updateSignalsOnIncomingMessage,
  markAsConverted,
  shouldStop,
  handleStopAction,
};
```

---

## Integrasi ke app.js

```javascript
// Tambah imports:
const {
  startFollowUpScheduler,
  updateSignalsOnIncomingMessage,
} = require('./src/ai/agents/followUpEngine/index.js');
const { invalidatePromoCache } = require('./src/ai/utils/promoConfig.js');
const { getActivePromo } = require('./src/ai/utils/promoConfig.js');

// 1. Di server startup (sudah ada pola ini):
startFollowUpScheduler(); // ← Tambah setelah startBookingReminderScheduler()

// 2. Di processBufferedMessages, setelah save message:
// Fire & forget signal tracking
updateSignalsOnIncomingMessage(senderNumber, combinedMessage)
  .catch(err => console.warn('[SignalTracker] Failed:', err.message));

// 3. Di getAIResponse(), inject promo ke system prompt:
const activePromo = await getActivePromo();
let promoPart = '';
if (activePromo) {
  promoPart = `\n\n[PROMO AKTIF]\n${activePromo}\n` +
    `(Sebutkan saat relevan — terutama saat user tanya harga ` +
    `atau mau booking 2+ layanan. Jangan dipaksakan.)`;
}

const messages = [
  new SystemMessage(effectiveSystemPrompt + memoryPart + promoPart),
  ...
];

// 4. Di updatePromoOfTheMonthTool, setelah update berhasil:
invalidatePromoCache();
```

---

## Yang Perlu Di-extract ke Utils

Dua fungsi di `app.js` yang dibutuhkan oleh Follow Up Engine — perlu dipindah ke utils agar bisa diimport:

```
saveMessageToFirestore  → src/ai/utils/firestoreUtils.js
extractTextFromAIContent → src/ai/utils/aiUtils.js
```

Ini refactor kecil tapi perlu dilakukan di Hari 1.

---

## Testing Plan

```
Test 1: Hot lead tidak reply 24 jam
→ Scheduler detect eligible
→ Generator hasilkan pesan angle 'urgency'
→ Dikirim dengan timing 09:xx (tidak tepat 09:00)
→ followup_count increment ke 1

Test 2: Customer ketik "stop"
→ signalTracker detect stop keyword
→ explicitly_rejected = true
→ Tidak ada follow up berikutnya

Test 3: Warm lead ghost 2x setelah follow up
→ stopCondition detect maxFollowUps tercapai
→ Downgrade ke dormant_lead
→ Follow up berhenti permanent

Test 4: Window shopper — promo aktif
→ Generator fetch promo dari Firestore
→ Hasilkan pesan dengan angle promo
→ Pesan terasa natural, bukan copy paste

Test 5: Window shopper — tidak ada promo
→ Generator return null
→ Tidak ada pesan dikirim
→ followup_count tidak increment

Test 6: Loyal customer 61 hari tidak balik
→ Scheduler downgrade check: 61 < 180 hari
→ Masih loyal, tidak downgrade
→ Follow up dengan angle 'exclusive'

Test 7: Promo diupdate admin
→ invalidatePromoCache() dipanggil
→ Request berikutnya fetch fresh dari Firestore
→ Pesan follow up pakai promo baru
```

---

## Urutan Pengerjaan

```
Hari 1
  └── Extract saveMessageToFirestore → firestoreUtils.js
  └── Extract extractTextFromAIContent → aiUtils.js
  └── src/ai/utils/promoConfig.js
  └── src/ai/agents/followUpEngine/signalTracker.js
  └── Unit test signal tracking

Hari 2
  └── stopCondition.js
  └── scheduler.js (eligibility + downgrade + cron)
  └── Unit test stop conditions + downgrade rules

Hari 3
  └── messageGenerator.js
  └── Test generate pesan untuk semua 6 angle
  └── Tune prompt kalau output kurang natural

Hari 4
  └── index.js — wire semua komponen
  └── Integrasi ke app.js (4 titik)
  └── Inject promo ke getAIResponse()

Hari 5
  └── E2E test semua 7 skenario
  └── Deploy ke staging
  └── Monitor 24 jam pertama
  └── Spot check kualitas pesan yang dikirim
  └── Tune angle prompts kalau perlu
```

---

Sudah matang. Lanjut coding?