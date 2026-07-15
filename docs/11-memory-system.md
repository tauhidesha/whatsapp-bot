# ZOYA V2

Memory System Specification

Version 2.0

---

# Philosophy

Memory bukan transcript.
Memory adalah knowledge.
Planner membaca knowledge.
Bukan membaca history.

---

Memory dibagi menjadi 3.

## Identity Memory

Relatif permanen.
```yaml
customer_name:
phone:
motor:
preferred_color:
preferred_service:
```

---

## Relationship Memory

```yaml
last_visit:
last_booking:
favorite_package:
trust_level:
```

---

## Sales Memory

```yaml
budget_range:
common_objection:
interest_level:
last_recommendation:
last_goal:
```

---

## Conversation Summary

Setelah chat selesai, bukan simpan semua chat. Tapi ringkasan.
Misalnya:
"Customer ingin repaint body halus Beat.
Budget sekitar 1 juta.
Belum jadi booking karena belum gajian.
Tertarik Cuci Komplit."

Planner baca ini saat customer datang lagi.

---

# Memory Update Policy

Tidak semua chat disimpan.
Contoh:
Customer: "Halo." → Jangan simpan.
Customer: "Saya sukanya cat doff." → Simpan.
Customer: "Belum gajian." → Simpan sebagai objection.

---

# Memory Retrieval

Planner hanya mengambil memory yang relevan.
Kalau customer tanya detailing. Tidak perlu load histori repaint 3 bulan lalu.
