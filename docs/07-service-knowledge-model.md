# ZOYA V2

Service Knowledge Model

Version 2.0

---

# Philosophy

Business Knowledge tidak ditulis sebagai Flow.
Business Knowledge ditulis sebagai Decision Model.
Planner tidak mengikuti langkah.
Planner mencari informasi minimum untuk mengambil keputusan.

---

Setiap Service WAJIB memiliki struktur berikut.

Service
Required Slot
Optional Slot
Business Rule
Recommendation
Upsell
Restriction
Pricing Capability
Booking Capability

---

# Contoh 1: REPAINT BODY HALUS

## SERVICE
Repaint Body Halus

## Required Slot
Planner wajib mengetahui:
- Motor (Karena harga berbeda)
- Area (Misal: Body Halus)

## Optional Slot
- Warna
Kenapa? Karena hanya mempengaruhi surcharge. Kalau belum tahu warna, Planner masih bisa kasih estimasi dasar. Planner gak perlu nanya warna di awal kalau customer cuma nanya "kisaran harga". Ini yang bikin natural.

## Business Rule
- IF warna premium → tambahkan surcharge
- IF customer repaint + detailing → disable coating → upsell cuci komplit

## Recommendation
- Default: Body Halus
- Jika customer ingin lebih awet → sarankan Cuci Komplit

## Restriction
- Coating → Tidak boleh selama curing 1 bulan
Planner gak perlu hafal. Rule Engine nanti kasih flag.

## Pricing Capability
- pricing

## Booking Capability
- booking

---

# Contoh 2: REPAINT VELG

## Required
- Motor
- Warna
- Kondisi Velg (Karena paint remover)

## Business Rule
- IF pernah repaint → paint remover surcharge
- IF chrome → chrome surcharge
- IF two tone → two tone surcharge
Planner tinggal baca.

---

# Contoh 3: DETAILING

## Required
- Motor
- Scope Detailing (Body, Full, Mesin)

## Scope Detail
Kalau Body:
- Planner lanjut ke Paint Type (Glossy, Doff, Unknown)

Glossy → Pilihan: Poles atau Coating Glossy
Doff → Pilihan: Coating Doff

Planner gak perlu flow. Planner cukup lihat: Missing Slot = Paint Type.

---

# Cross Sell
Ini dipisah dari prompt.
- Body Halus → boleh Cuci Komplit
- Body Halus → tidak boleh Coating
Rule Engine kasih tahu.

---

# Escalation
- IF harga kosong → Bosmat
- IF mobil → Bosmat
- IF warna custom → Bosmat
Planner gak perlu tau.

---

# Slot Priority
Contoh Body Halus:
1. Motor (Priority 1)
2. Area (Priority 2)
3. Warna (Priority 3)
Planner selalu bertanya dari priority tertinggi. Natural.

---

# Slot Dependency
Misalnya: Paint Type baru relevan kalau Detailing.
Kalau customer repaint, Planner gak usah nanya. Ini yang bikin gak rese.

---

# Recommendation Matrix
- Service: Body Halus → Rekomendasi: Cuci Komplit
- Service: Detailing Glossy → Rekomendasi: Coating
- Service: Detailing Doff → Rekomendasi: Coating Doff
Planner tinggal lihat matrix.

---

# Knowledge Driven
Planner tidak pernah berpikir: "Langkah berikutnya apa?"
Planner berpikir:
```text
Service ini membutuhkan slot apa?
↓
Mana yang kosong?
↓
Mana yang paling penting?
↓
Tanya itu.
```
