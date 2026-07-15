# ZOYA V2

Capability Router Specification

Version 2.0

---

# Philosophy

Planner memahami bisnis.

Planner TIDAK memahami implementasi.

Capability Router menerjemahkan keputusan bisnis menjadi tool yang tepat.

Dengan demikian Planner tidak pernah mengetahui nama tool.

Planner hanya mengenal Capability.

---

# Kenapa Capability Router?

Misalnya sekarang ada

```
getServicePrice()

getBundlingPrice()

getServiceDetail()

getBooking()

createBooking()

updateBooking()

cancelBooking()

notifyBosmat()

checkPromo()

...
```

Kalau planner harus hafal semuanya...

Gemini bakal mulai ngawur.

Makanya kita kasih abstraction.

---

Planner cukup bilang

```json
{
   "requiredCapability":"pricing"
}
```

Router yang kerja.

---

# Capability List

Menurut gue cukup sekitar 10.

```text
pricing

consultation

booking

customer

crm

studio

promotion

notification

vision

handover
```

Planner gak boleh bikin capability baru.

---

# Capability Mapping

## pricing

Semua hal mengenai harga.

Router memilih.

```
getServicePrice()

getBundlingPrice()

getPromo()

getAdditionalCost()

...
```

Planner gak tau.

---

## consultation

Semua knowledge bisnis.

Misalnya.

```
getServiceDetail()

getWorkflow()

getPaintType()

getRecommendation()

```

Planner cuma bilang

```
consultation
```

---

## booking

```
checkBooking()

createBooking()

updateBooking()

cancelBooking()
```

---

## customer

```
getCustomer()

updateCustomer()

createCustomer()
```

---

## studio

```
getStudioInfo()

getOperatingHours()

getLocation()

```

---

## notification

```
notifyBosmat()

sendReminder()

```

---

## vision

```
analyzeMotorPhoto()

detectDamage()

detectPaintCondition()

```

---

## handover

```
createEscalation()

assignBosmat()

```

---

# Capability Router Flow

Planner

↓

Capability

↓

Router

↓

Specific Tool

↓

Execute

↓

Normalize Output

↓

Conversation State

↓

Planner

---

# Router Decision

Router menggunakan:

Conversation State

*

Business Rule

*

Capability

untuk menentukan tool.

Planner tidak ikut campur.

---

Contoh

Planner

```
pricing
```

Conversation State

```
Service = Repaint

Area = Body Halus

Motor = Beat
```

Router

↓

```
getServicePrice()
```

---

Contoh lain.

Planner

```
booking
```

State

```
bookingId kosong
```

↓

Router

```
createBooking()
```

---

Planner

```
booking
```

State

```
bookingId sudah ada
```

↓

Router

```
updateBooking()
```

Planner gak perlu tau.

---

# Tool Contract

Setiap Tool WAJIB:

Input:

Conversation State

Output:

Normalized JSON

Tidak boleh output text.

---

Contoh

```
{
    success:true,

    data:{...},

    metadata:{...},

    error:null
}
```

Semua tool sama.

---

# Error Handling

Planner tidak menangani error tool.

Router yang menangani.

Misalnya

Tool timeout.

↓

Router retry.

↓

Masih gagal.

↓

Planner dipanggil lagi.

↓

Capability berubah menjadi

handover

atau

clarification.

---

# Retry Policy

Read Tool

3x retry

Write Tool

1x retry

Notification

2x retry
