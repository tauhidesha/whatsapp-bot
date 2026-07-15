# ZOYA V2

Planner Specification

Version 2.0

---

# Philosophy

Planner adalah otak Zoya.

Planner tidak berbicara dengan customer.

Planner tidak menjalankan tool.

Planner tidak membuat booking.

Planner tidak menghitung harga.

Planner hanya berpikir.

Planner menghasilkan keputusan.

---

# Responsibilities

Planner bertanggung jawab untuk:

✔ memahami tujuan customer

✔ memahami progress konsultasi

✔ menentukan informasi yang masih kurang

✔ menentukan apakah perlu tool

✔ menentukan capability

✔ menentukan strategi percakapan berikutnya

Planner TIDAK bertanggung jawab untuk:

✖ membuat response

✖ menjalankan tool

✖ mengubah database

✖ menghitung harga

✖ menjalankan business rule

---

# Planner Lifecycle

Conversation State

↓

Planner

↓

Planner Decision

↓

Rule Engine

↓

Capability Router

↓

Tool

↓

State Update

↓

Planner

↓

Response Composer

Notice.

Planner dipanggil **dua kali**.

Ini disengaja.

---

# Input Planner

Planner menerima SATU object.

```
Conversation State
```

Bukan history.

Bukan tool.

Bukan prompt acak.

Planner membaca state.

---

# Output Planner

Planner selalu mengeluarkan JSON.

Tidak pernah bahasa alami.

Contoh

```json
{
  "goal":"Customer ingin repaint body halus",

  "stage":"CLARIFYING",

  "knownFacts":[
      "Beat",
      "warna merah"
  ],

  "missingFacts":[
      "bagian repaint"
  ],

  "nextAction":"ASK",

  "requiredCapability":null,

  "confidence":0.96,

  "reason":"Belum diketahui bagian repaint."
}
```

---

# Core Thinking Model

Planner WAJIB menjawab pertanyaan berikut.

## 1

Apa tujuan customer?

Bukan intent.

Goal.

---

## 2

Informasi apa yang sudah diketahui?

---

## 3

Informasi apa yang masih kurang?

---

## 4

Apakah informasi tersebut benar-benar perlu ditanyakan?

Kalau tidak perlu

JANGAN tanya.

---

## 5

Apakah sekarang perlu tool?

Kalau tidak

Jangan panggil tool.

---

## 6

Apakah ada rekomendasi yang sebaiknya diberikan?

---

## 7

Apakah ada business rule yang kemungkinan aktif?

Planner tidak menjalankan rule.

Planner hanya memberi sinyal.

---

## 8

Apa aksi terbaik berikutnya?

---

# nextAction Enum

Planner hanya boleh memilih salah satu.

```
ASK

RECOMMEND

GET_INFORMATION

SHOW_PRICE

CREATE_BOOKING

UPDATE_BOOKING

ESCALATE

WAIT

FINISH
```

Tidak boleh membuat action sendiri.

---

# Stage Enum

```
DISCOVERING

CLARIFYING

CONSULTING

RECOMMENDING

PRICING

OBJECTION

BOOKING

FOLLOW_UP

DONE
```

Stage bukan flow.

Stage adalah kondisi konsultasi.

Planner boleh maju.

Planner boleh mundur.

---

Contoh.

Customer

```
Mau booking.
```

↓

BOOKING

↓

Lalu customer

```
Eh bentar deh warna biru ada?
```

Planner kembali ke

```
CONSULTING
```

Tidak masalah.

---

# Goal

Goal bersifat stabil.

Contoh.

Customer

```
Mau repaint body halus.
```

Goal

```
Mendapat solusi repaint body halus.
```

Kalau customer berkata

```
Rumah saya jauh.
```

Goal tetap.

Yang berubah hanya strategy.

---

# Planner Decision Matrix

Planner harus menentukan SATU dari empat kondisi.

```
Need More Information

↓

Need Recommendation

↓

Need Tool

↓

Can Respond
```

Tidak boleh lebih dari satu prioritas utama.

---

# Need More Information

Planner hanya bertanya jika informasi tersebut:

wajib

atau

akan mengubah rekomendasi.

Contoh.

WAJIB

Jenis motor.

Karena harga berubah.

---

Tidak wajib

Nama customer.

Jangan ditanya.

---

# Recommendation

Planner boleh memberi rekomendasi jika:

Semua informasi minimum sudah cukup.

Belum perlu booking.

Belum perlu tool.

---

# Tool Decision

Planner tidak memilih tool.

Planner memilih capability.

Contoh.

```
pricing
```

Bukan

```
getServicePrice
```

---

Capability Enum

```
pricing

booking

customer

crm

studio

vision

notification

handover
```

Router yang menentukan tool.

---

# Confidence

Planner WAJIB memberikan confidence.

0-1

Misalnya.

```
0.97
```

Kalau confidence rendah.

Rule Engine boleh meminta klarifikasi.

---

# Reason

Reason hanya untuk engineer.

Tidak pernah dikirim ke customer.

Contoh.

```
Harga belum bisa dihitung karena area repaint belum diketahui.
```

---

# Sales Thinking

Planner bukan classifier.

Planner berpikir seperti sales.

Planner harus mempertimbangkan:

Apakah customer sedang bingung?

Apakah customer sedang membandingkan?

Apakah customer keberatan harga?

Apakah customer butuh edukasi?

Apakah sekarang waktu yang tepat menawarkan booking?

Apakah sekarang lebih baik membangun trust?

Planner tidak boleh memaksa closing.

---

# Golden Rules

Planner tidak pernah mengulang pertanyaan yang jawabannya sudah ada.

Planner hanya bertanya SATU pertanyaan dalam satu turn.

Planner selalu mencari cara tercepat mencapai Goal.

Planner mengutamakan pengalaman customer dibanding flow.

---

# Pemisahan Beban dengan Capability Router

Planner tidak pernah tahu nama tool seperti `getRepaintPrice` atau `getDetailingPrice`. Planner cukup memilih *capability* (misal: `pricing`), dan sistem akan memutuskan tool spesifik mana yang dipanggil berdasarkan parameter bisnis di *Capability Router*. Hal ini meringankan beban kognitif LLM dan memungkinkan skalabilitas hingga 100+ tools tanpa penurunan kinerja.
