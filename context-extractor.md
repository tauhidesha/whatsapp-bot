Planning: Context Extractor Agent
Scope & Tujuan
Setiap kali ada exchange percakapan, ekstrak fakta penting secara otomatis di background — tanpa mengandalkan main agent untuk ingat.

Yang Perlu Diekstrak
Berdasarkan kode dan bisnis Bosmat:
javascript{
  // Identitas Motor
  motor_model: "Nmax",           // Yamaha Nmax, Beat, Vario 150, dll
  motor_year: "2022",            // Tahun motor jika disebut
  motor_color: "putih",          // Warna saat ini
  motor_condition: "kusam",      // Kondisi yang dikeluhkan

  // Kebutuhan Layanan  
  target_service: "repaint",     // Layanan yang diminati
  service_detail: "full bodi",   // Detail spesifik
  budget_signal: "ketat",        // "oke", "ketat", "tidak disebut"

  // Sinyal Intent
  intent_level: "hot",           // hot / warm / cold
  said_expensive: false,         // Pernah bilang mahal
  asked_price: true,             // Sudah tanya harga
  asked_availability: false,     // Sudah tanya jadwal
  shared_photo: false,           // Kirim foto motor

  // Data Logistik
  preferred_day: "Sabtu",        // Preferensi hari jika disebut
  location_hint: "Bandung",      // Lokasi jika disebut
  
  // Meta
  extracted_at: timestamp,
  source_turn: "user+ai"         // Dari turn mana
}
```

---

## Arsitektur
```
processBufferedMessages()
        │
        ▼
   Main Agent                    
   (jawab user)                  
        │                        
        ├──→ Reply ke user ✅     
        │                        
        └──→ extractContext()    ← Non-blocking, fire & forget
                  │
                  ▼
          ┌───────────────────┐
          │  Flash Model      │
          │  temp: 0          │
          │  input: 1 exchange│
          │  output: JSON     │
          └───────────────────┘
                  │
                  ▼
          ┌───────────────────┐
          │  Merge Logic      │  ← Jangan overwrite data lama
          │  dengan data      │    kalau value baru null
          │  existing         │
          └───────────────────┘
                  │
                  ▼
            Firestore
         customerContext/
           {senderNumber}

Merge Logic (Penting)
Ini sering diabaikan tapi krusial. Ekstraksi per turn bisa partial — jangan sampai data turn sebelumnya tertimpa null:
javascriptasync function mergeAndSaveContext(senderNumber, newData) {
  const ref = db.collection('customerContext').doc(docId);
  const existing = await ref.get();
  const current = existing.exists ? existing.data() : {};

  const merged = {};
  
  for (const [key, value] of Object.entries(newData)) {
    if (value === null || value === undefined || value === '') {
      // Pertahankan data lama kalau ekstraksi baru tidak dapat info
      merged[key] = current[key] ?? null;
    } else {
      // Data baru lebih fresh, pakai yang baru
      merged[key] = value;
    }
  }

  // Field yang ada di existing tapi tidak di newData → pertahankan
  for (const [key, value] of Object.entries(current)) {
    if (!(key in merged)) {
      merged[key] = value;
    }
  }

  await ref.set({
    ...merged,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    senderNumber,
  }, { merge: true });
}

Prompt Extractor
javascriptconst EXTRACTOR_PROMPT = `
Kamu adalah data extractor untuk sistem CRM bengkel motor.
Tugasmu HANYA mengekstrak fakta dari percakapan.
Kembalikan JSON saja. Tidak ada teks lain. Tidak ada markdown.

Percakapan:
User: "{userMessage}"
AI: "{aiReply}"

Ekstrak ke format ini (isi null jika tidak disebutkan):
{
  "motor_model": null,
  "motor_year": null,
  "motor_color": null,
  "motor_condition": null,
  "target_service": null,
  "service_detail": null,
  "budget_signal": null,
  "intent_level": null,
  "said_expensive": null,
  "asked_price": null,
  "asked_availability": null,
  "shared_photo": null,
  "preferred_day": null,
  "location_hint": null
}

Aturan ketat:
- Hanya isi field yang BENAR-BENAR ada di percakapan ini
- Jangan inferensi atau mengarang
- intent_level: "hot" jika tanya jadwal/mau datang, 
                "warm" jika tanya harga/detail,
                "cold" jika hanya lihat-lihat
- budget_signal: "ketat" jika bilang mahal/kemahalan,
                 "oke" jika setuju harga,
                 null jika tidak disebut
`;
```

---

## File Structure
```
src/ai/agents/
  ├── contextExtractor.js      ← Logic utama
  └── __tests__/
      └── contextExtractor.test.js

src/ai/utils/
  └── mergeCustomerContext.js  ← Merge logic terpisah agar testable

Integrasi ke Kode Existing
Hanya tambah 3 baris di processBufferedMessages():
javascript// Setelah baris ini yang sudah ada:
const aiResponse = await getAIResponse(combinedMessage, ...);

// Tambahkan ini — fire and forget, tidak bloking:
extractAndSaveContext(combinedMessage, aiResponse, senderNumber)
  .catch(err => console.warn('[Context] Extraction failed:', err.message));

// Lanjut seperti biasa:
await client.sendText(targetNumber, aiResponse);

Retro-aktif: Proses Data Lama
Karena Firestore sudah banyak data, jalankan one-time script untuk proses histori lama:
javascript// scripts/backfillContext.js
// Jalankan sekali via: node scripts/backfillContext.js

async function backfillAllConversations() {
  const conversations = await db.collection('directMessages').get();
  
  for (const conv of conversations.docs) {
    const messages = await conv.ref
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();

    // Proses per pair (user + ai)
    const turns = pairMessages(messages.docs);
    
    for (const turn of turns) {
      await extractAndSaveContext(
        turn.userMessage,
        turn.aiReply,
        conv.id
      );
      await delay(500); // Hindari rate limit
    }
    
    console.log(`✅ Backfilled: ${conv.id}`);
  }
}
```

---

## Testing Plan

Sebelum deploy, test dengan 3 skenario dari data Firestore existing:
```
Skenario 1: Percakapan lengkap (nanya → harga → booking)
  → Ekspektasi: semua field terisi dengan benar

Skenario 2: Window shopper (nanya harga → ghosted)
  → Ekspektasi: asked_price=true, intent_level=cold/warm
                said_expensive=false (jangan di-assume)

Skenario 3: Multi-turn (motor disebut di turn 1, 
                         service disebut di turn 5)
  → Ekspektasi: merge tidak overwrite motor_model dengan null
```

---

## Urutan Pengerjaan
```
Hari 1
  └── Buat contextExtractor.js + mergeCustomerContext.js
  └── Unit test dengan data sample

Hari 2  
  └── Integrasi ke processBufferedMessages (3 baris)
  └── Test di staging dengan percakapan real

Hari 3
  └── Jalankan backfillContext.js untuk data lama
  └── Verifikasi hasil di Firestore console

Done → Lanjut ke Customer Classifier
       (yang sekarang punya data konteks lengkap sebagai input)
