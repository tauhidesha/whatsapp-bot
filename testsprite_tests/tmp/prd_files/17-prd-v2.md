# PRD & Business Logic Spec: Zoya V2 (Dynamic AI Sales Consultant)

## 1. Core Philosophy: Fact-Based Goal Seeking
- Zoya V2 TIDAK MENGGUNAKAN alur percakapan sekuensial (Langkah 1 -> Langkah 2 -> Langkah 3). Zoya menggunakan **State & Fact-Based Routing**.
- Bot bebas meladeni percakapan yang melompat-lompat selama ia fokus mengumpulkan Required Facts (Fakta Wajib) sebelum mengeksekusi `toolIntent` (seperti `GET_PRICE`, `CREATE_BOOKING`, `UPSELL`, `ESCALATE_HUMAN`).
- Jika fakta belum lengkap, tanyakan yang masih missing. Jika sudah lengkap, berikan estimasi harga dan eksekusi instruksi Upsell/Cross-sell.
- **One Question at a Time**: Zoya dilarang keras menembak rentetan pertanyaan sekaligus (menggabungkan pertanyaan motor apa, warna apa, dan velg apa di satu chat). Pengejaran *Missing Facts* wajib ditanyakan SATU PER SATU secara natural.

## 2. Global Conversation & Handling Rules (Must Comply)
Aturan ini berada di atas seluruh layanan spesifik:
- **Multi-Vehicle Handling**: Jika customer membawa >1 motor dengan kebutuhan berbeda, selesaikan estimasi untuk Motor Pertama dahulu. Gunakan Constraint: "Fokus bahas estimasi motor pertama sampai clear. Jangan berikan harga motor kedua sebelum motor pertama selesai."
- **Handling Objections (Penolakan)**: Jika customer mengatakan jauh, belum ada dana, atau "nanti dulu", ubah Goal ke `HANDLE_OBJECTION` dan Strategy ke `EMPATHIZE`. DILARANG KERAS menanyakan "kapan mau eksekusi/booking". Biarkan percakapan menggantung dengan hangat.
- **Alamat & Booking**: Jika ditanya alamat, berikan link maps utuh dan WAJIB menyarankan customer untuk konfirmasi/booking sebelum datang.
- **Escalation Triggers (Tanya Bosmat / Human Handoff)**: Bot WAJIB eskalasi ke Admin Manusia (set `toolIntent: ESCALATE_HUMAN`) jika:
  - Harga tidak ditemukan di sistem.
  - Customer ingin konsultasi konsep warna/cat custom yang rumit.
  - Customer menanyakan layanan untuk Mobil (Bosmat hanya untuk Motor).

## 3. Domain Flow: DETAILING (Fact Requirements & Triggers)
Jangan tanya secara berurutan, tapi pastikan fakta-fakta ini terkumpul secara natural.

**Opsi A: Bodi & Kaki-kaki Saja (Non-Rangka)**
- **Required Facts**: `motorModel`, `paintType` (Glossy/Doff).
- **Upsell/Action**:
  - Jika Doff -> Tawarkan "Paket Coating Doff" (jelaskan mencakup detailing total + proteksi).
  - Jika Glossy -> Tawarkan "Poles Bodi" ATAU "Coating Glossy" (hanya jelaskan bedanya jika ditanya).

**Opsi B: Sampai Rangka (Full Bongkar)**
- **Required Facts**: `motorModel`, `paintType` (Glossy/Doff).
- **Upsell/Action**:
  - Jika Doff -> Tawarkan "Cuci Komplit" ATAU "Complete Service Doff".
  - Jika Glossy -> Tawarkan "Full Detailing" ATAU "Complete Service Glossy".

**Opsi C: Detailing Mesin Saja**
- **Required Facts**: `motorModel`. (TIDAK PERLU `paintType`).
- **Cross-sell Trigger**: "Tawarkan apakah bodinya tidak mau sekalian di-detailing?". (Jika ya, aktifkan kembali pencarian fakta `paintType`).

## 4. Domain Flow: REPAINT (Fact Requirements & Triggers)
Pastikan fakta ini terkumpul: `motorModel`, `partToRepaint`. Fakta tambahan bergantung pada part yang dipilih.

**Opsi A: Repaint Bodi Halus**
- **Required Facts**: `motorModel`, `paintColor`, `paintFinishing` (Glossy/Doff/Matte).
- **Upsell Trigger**: Tawarkan "Cuci Komplit".
- **Constraint**: Beri info surcharge (biaya tambahan) jika memilih warna khusus/Candy.

**Opsi B: Repaint Velg**
- **Required Facts**: `motorModel`, `paintColor`, `velgCondition` (Cat Ori / Pernah Repaint).
- **Constraint**: Beri info surcharge *Paint Remover* jika `velgCondition` = Pernah Repaint. Beri info surcharge untuk warna Chrome/Two-Tone Polish.

**Opsi C: Repaint Full Bodi**
- **Required Facts**: `motorModel`, `paintColor`, `paintFinishing`. (Mencakup Bodi Halus + Kasar).

## 5. Cross-Domain Rules & Edge Cases (Constraint Engine)
Ini adalah aturan kombinasi jika customer meminta banyak hal:
- **Repaint + Detailing Conflict**: Jika customer meminta Repaint Bodi Halus + Detailing, Bot HANYA BOLEH menawarkan "Cuci Komplit".
  - **Constraint**: DILARANG menawarkan Poles/Coating. Alasan (jika ditanya): Repaint sudah otomatis dapat poles, dan coating belum bisa dilakukan karena cat baru butuh masa curing (kering) selama 1 bulan.
- **Promo Bundling**: Jika ada promo ambil 2 layanan, diskon HANYA memotong harga Repaint Bodi Halus, tidak memotong layanan lainnya.

## 6. TestSprite Evaluation Criteria (Strict QA Assertions)
Gunakan kriteria ini untuk mengevaluasi apakah AI Bot lulus tes End-to-End:
- **ASSERT_DYNAMIC_ROUTING**: Bot mampu menjawab harga part B meskipun sebelumnya sedang membahas part A, tanpa mereset ingatan tentang tipe motor.
- **ASSERT_NO_FORCED_BOOKING**: Bot langsung memberikan empati dan berhenti berjualan saat customer beralasan menunda ("nanti dulu", "jauh"). (Pastikan Goal beralih ke `HANDLE_OBJECTION`).
- **ASSERT_VELG_CONDITION_CHECK**: Bot WAJIB menanyakan kondisi velg (ori/repaint) sebelum memberikan harga repaint velg.
- **ASSERT_NO_COATING_ON_REPAINT**: Bot GAGAL (FAIL) jika menawarkan layanan Coating kepada customer yang juga mengambil paket Repaint Bodi Halus.
- **ASSERT_MULTI_MOTOR_FOCUS**: Bot sukses mengisolasi pemberian harga hanya untuk motor pertama hingga tuntas, sebelum membahas motor kedua.
