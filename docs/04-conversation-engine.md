# Conversation Engine

Perubahan paradigma dari flow lama ke flow *Agentic*.

## Old Flow

```text
Chat
↓
Intent
↓
Tool
↓
Response
```

## New Agentic Flow

```text
User
↓
UNDERSTAND
↓
PLAN
↓
RULE CHECK
↓
ACT
↓
RE-EVALUATE
↓
COMMUNICATE
```

Langkah **RE-EVALUATE** adalah kunci. Setelah Tool dipanggil (contoh: harga keluar), sistem akan melakukan planning ulang (kembali ke Planner) untuk memastikan apakah masih ada informasi yang kurang sebelum akhirnya Planner memberikan komando ke Response Composer.

---

## Dari Intent ke Goal

Concept **Intent** dihapus, diganti menjadi **Goal**.
Goal jauh lebih stabil daripada intent. 

Contoh:

Customer:
> "Mas repaint beat berapa"

Goal:
> `Mendapat estimasi repaint`

Customer membalas:
> "Rumah saya jauh"

Goal tetap:
> `Mendapat estimasi repaint`

(Bukan berubah menjadi "Intent = objection"). Goal jauh lebih stabil dan memudahkan sistem menjaga state percakapan jangka panjang.
