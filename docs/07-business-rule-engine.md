# ZOYA V2

Business Rule Engine

Version 2.0

---

# Philosophy

LLM tidak boleh mengimplementasikan SOP.

Semua SOP bisnis berada di Rule Engine.

Planner boleh mengetahui bahwa sebuah rule aktif.

Planner tidak pernah menjalankan rule.

Rule Engine bersifat deterministic.

Setiap rule dapat di-unit-test.

---

# Rule Execution

Conversation State
↓
Evaluate Rule
↓
Business Flags
↓
Planner
↓
Response Composer

Perhatikan.

Rule Engine berjalan **sebelum Response Composer**.

---

# Rule Format

Semua rule menggunakan format yang sama.

```yaml
id: repaint_coating_lock

condition:
  service == repaint

action:
  disable_service:
    - coating

message:
  Cat baru harus curing 1 bulan.

priority:
  high
```

Jangan pakai if else 1000 baris.

---

# Rule Priority

```text
CRITICAL
HIGH
NORMAL
LOW
```

CRITICAL
Contoh: Mobil ↓ Bosmat

HIGH
Harga kosong ↓ Bosmat

NORMAL
Cross sell.

LOW
Greeting.

---

# Rule Type

Menurut gue cukup 8 jenis.

## Restriction Rule
Misalnya
```yaml
IF repaint
THEN disable coating
```

## Escalation Rule
```yaml
IF mobil
↓
handover
```

## Pricing Rule
```yaml
IF chrome
↓
surcharge
```

## Upsell Rule
```yaml
IF body halus
↓
offer cuci komplit
```

## Validation Rule
Misalnya booking. Tanggal kosong ↓ booking belum boleh dibuat.

## Conflict Rule
Misalnya.
Customer memilih `Repaint + Coating`
↓
Conflict.
Rule Engine.
↓
Disable coating.

## Promotion Rule
Misalnya 2 layanan ↓ Diskon repaint.

## Notification Rule
Misalnya customer datang tanpa booking ↓ Sarankan booking.

---

# Rule Output

Rule Engine tidak menghasilkan text.
Hanya flag.
Misalnya.

```json
{
 "disabledServices":[
   "coating"
 ],
 "upsell":[
    "cuci_komplit"
 ],
 "promotion":[
   "bundle_discount"
 ],
 "escalation":false
}
```

Response Composer yang ngomong.

---

# Rule Independence

Rule tidak boleh saling memanggil.
Semua rule independen.
Lebih mudah di-test.

---

# Rule Registry

```
rules/
  pricing/
  booking/
  repaint/
  detailing/
  promotion/
  handover/
```

Jangan satu file.

---

# Golden Rule

Planner menentukan strategi.
Rule menentukan batasan.
Composer menentukan bahasa.
