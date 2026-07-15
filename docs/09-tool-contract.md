# ZOYA V2

Tool Contract

Version 2.0

---

# Philosophy

Planner tidak mengenal tool.
Tool tidak mengenal Planner.
Tool hanya menerima Request.
Tool hanya mengembalikan Data.
Semua Tool memiliki contract yang sama.

---

# Universal Tool Interface

Semua tool WAJIB implement interface ini.

```typescript
interface Tool {
  name:string
  description:string
  capability:string
  execute(input): ToolResponse
}
```

---

# Universal Request

Semua tool menerima object yang sama.

```ts
ToolRequest {
  conversationId
  customerId
  conversationState
  parameters
  metadata
}
```

Tidak ada tool yang baca history chat.
Tidak ada tool yang parsing prompt.
Semua dari State.

---

# Universal Response

```ts
ToolResponse {
  success:boolean
  data:any
  metadata:any
  error:any
  executionTime
}
```

Semua tool sama.
Gak ada exception.

---

# Error Standard

Misalnya.

```json
{
 success:false,
 error:{
   code:"NOT_FOUND",
   message:"Price not found"
 }
}
```

Planner gak pernah baca stacktrace.

---

# Metadata

Misalnya.

```json
{
 source:"database",
 version:"2.1",
 cache:true
}
```

Planner bisa percaya.

---

# Tool Categories

Read Tool
Write Tool
Notify Tool
Vision Tool
Integration Tool

---

# Read Tool
Tidak mengubah database.
Contoh: Get Price, Get Service, Get Promo
Retry 3x.

---

# Write Tool
Mengubah database.
Contoh: Booking, Update Booking, CRM
Retry 1x.

---

# Notify
Contoh: Notify Bosmat, Send Reminder
Retry 2x.

---

# Vision
Contoh: Analyze Photo
Planner gak tahu.

---

# Integration
Contoh: Google Calendar, Whatsapp, CRM

---

# Golden Rules

Tool tidak pernah menghasilkan bahasa alami.
Tool tidak pernah mengambil keputusan.
Tool tidak pernah memanggil tool lain.
Tool selalu deterministic.

---

# Versioning
Setiap tool memiliki version.
Misalnya `pricing:v2` supaya rollout gampang.

---

# Idempotency
Semua write tool wajib idempotent.
Misalnya Customer spam booking. Tidak boleh double booking.

---

# Observability
Setiap tool wajib log:
Start, End, Latency, Error, Input Hash, Output Hash
