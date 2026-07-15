# ZOYA V2

Conversation State Schema

Version 2.0

---

# Philosophy

Conversation State adalah satu-satunya sumber kebenaran.

Tidak ada node yang menyimpan state sendiri.

Tidak ada tool yang menyimpan state sendiri.

Tidak ada prompt yang menjadi memory.

Semua membaca dan menulis ke Conversation State.

---

ConversationState

conversation

customer

vehicle

consultation

pricing

booking

sales

planner

tool

memory

business

analytics

---

# 1 Conversation

```
conversation
```

Tujuan:

menyimpan kondisi percakapan.

```
conversation

id

startedAt

updatedAt

status

language

summary

lastMessages

```

status

```
active

waiting_customer

completed

handover

```

summary

Berisi ringkasan.

Bukan seluruh history.

---

# 2 Customer

```
customer
```

```
customer

id

name

phone

isReturning

tags

notes

```

Tambahan.

```
trustLevel

relationshipScore
```

Kenapa?

Karena sales ngomong ke customer lama beda.

---

# 3 Vehicle

```
vehicle

brand

model

year

paintType

currentCondition

```

Paint Type

```
Glossy

Doff

Unknown
```

currentCondition

```
Original

Repainted

Unknown
```

Bisa dipakai repaint velg.

---

# 4 Consultation

Nah.

Ini bagian yang menurut gue paling penting.

```
consultation
```

```
goal

stage

requestedServices

recommendedServices

knownFacts

missingFacts

```

Contoh.

goal

```
Customer ingin repaint body halus
```

requestedServices

```
repaint
```

recommendedServices

```
body halus

+

cuci komplit
```

knownFacts

```
Beat

Merah

Glossy
```

missingFacts

```
Bagian repaint
```

---

# Kenapa ada Goal?

Karena Goal tidak berubah setiap chat.

Misalnya.

```
Customer

Rumah saya jauh.
```

Goal tetap.

```
Repaint Body Halus
```

Planner tidak kehilangan arah.

---

# Stage

Bukan intent.

Stage.

```
DISCOVERING

↓

CLARIFYING

↓

CONSULTING

↓

RECOMMENDING

↓

PRICING

↓

OBJECTION

↓

BOOKING

↓

DONE
```

Stage bisa naik.

Bisa turun.

---

# 5 Pricing

```
pricing

estimatedPrice

discount

promotion

priceSource

isFinal

```

priceSource

```
database

manual

bosmat

```

---

# 6 Booking

```
booking

status

preferredDate

preferredTime

bookingId

```

status

```
none

asking

confirmed

completed

cancelled

```

---

# 7 Sales

Nah.

Ini yang belum ada di project sekarang.

Menurut gue ini penting.

```
sales

buyerStage

interestLevel

budget

urgency

objection

sentiment

closingProbability

```

interestLevel

```
high

medium

low
```

budget

```
1 juta

2 juta

belum diketahui
```

urgency

```
hari ini

minggu ini

bulan depan

belum tahu
```

objection

```
harga

jarak

waktu

izin istri

belum gajian

```

closingProbability

```
0.72
```

buyerStage

```
Exploring
Comparing
Ready to Buy
Hesitating
Cooling Down
```

Planner bisa pakai buyerStage untuk menentukan strategi respons (contoh: Exploring -> edukasi, Ready to Buy -> arahkan ke booking).

---

# Kenapa?

Customer bilang

```
Belum gajian.
```

Sales State berubah.

```
objection

budget
```

Bukan

Intent = objection.

Ini jauh lebih kaya.

---

# 8 Planner

Planner menyimpan hasil reasoning terakhir.

```
planner

goal

reason

nextAction

capability

confidence

```

nextAction

```
ASK

RECOMMEND

PRICE

BOOK

HANDOVER

WAIT

```

---

# 9 Tool

```
tool

lastCapability

lastTool

lastResult

executionHistory

```

Tool tidak menyimpan reasoning.

Hanya hasil.

---

# 10 Memory

```
memory

customerPreference

favoriteColor

favoriteService

previousMotor

lastRecommendation

summary

```

summary

Ringkasan.

Bukan history.

---

# 11 Business

```
business

activeRules

escalation

promotion

disabledServices

```

Misalnya.

```
disabledServices

coating
```

karena repaint baru.

---

# 12 Analytics

```
analytics

plannerRuns

toolCalls

responseCount

conversationLength

stageHistory

```

Nanti dashboard gampang.

---

# Golden Rules

Conversation State adalah satu-satunya source of truth.

Planner membaca state.

Planner tidak membaca database.

Tool mengubah state.

Response Composer membaca state.

Business Rule membaca state.

Semua node menggunakan object yang sama.

---

# Pergeseran Paradigma

Dari

```
User
↓
Intent
↓
Tool
↓
Response
```

Menjadi

```
State
↓
Planner
↓
State
↓
Tool
↓
State
↓
Response
```

State menjadi pusat (Single Source of Truth).
Bukan prompt.
Bukan graph.
