# ZOYA V2

Evaluation Framework

---

# Philosophy

Agent tidak diukur dari "terdengar pintar".
Agent diukur dari KPI bisnis.

---

# KPI

## Conversation Success
Customer mendapat jawaban.

## Recommendation Accuracy
Apakah layanan yang direkomendasikan benar.

## Booking Conversion
Berapa % chat ↓ booking.

## Escalation Accuracy
Apakah Bosmat dipanggil hanya saat perlu.

## Tool Efficiency
Average tool per conversation. Semakin sedikit semakin bagus.

## Repeated Question Rate
Kalau planner nanya hal yang sudah diketahui. Score turun.

## Memory Accuracy
Customer tidak mengulang.

## Human Feeling Score
Ini menurut gue penting. Sampling. Bosmat kasih nilai. 1-10. Apakah terasa seperti ngobrol sama manusia?

---

# Evaluation Dataset

Menurut gue wajib punya.
- 100 chat repaint
- 100 detailing
- 50 booking
- 50 objection
- 50 custom warna
- 20 mobil
- 20 error tool
Total sekitar 340 test case.
Setiap deployment dijalankan otomatis.

---

# Pass Criteria

Conversation Success: 95%
Booking Accuracy: 99%
Repeated Question: <2%
Planner Error: <3%
