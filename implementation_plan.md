# Repaint Sales Flow V3 Implementation Plan

Implementasi fokus pada perbaikan **UX Conversation** di level Prompt dan Business Rules tanpa merombak arsitektur state/planner.

## Proposed Changes

### 1. `src/ai/prompts/promptBuilder.js`
- **Ubah Urutan Paket Harga**: Mengubah aturan pengurutan paket dari "Mahal ke Murah" menjadi "Murah ke Mahal" (Ekonomis -> Premium) sesuai request.
- **Pembaruan Format Harga**: Menghapus teks rincian berlebihan dan memaksa AI mengikuti format simpel (misal: `🔹 Standar ⭐ Paling Dipilih — Rp1,43 juta`).
- **Aturan Bertanya (Anti-Interview)**: Menambahkan instruksi ketat agar AI tidak menanyakan konsep/warna/kondisi velg secara acak. AI diinstruksikan untuk menggunakan kalimat transisi: `"Boleh sekalian saya catat konsep repaintnya ya kak."` sebelum menggali informasi warna/velg.

### 2. `src/ai/rules/businessRulesData.js`
- Menambahkan UX Flow Rules (V3) di objek `communication`:
  - **Tahap 1**: Saat pertama kasih harga -> Kasih harga + Promo + Tanya apakah ada rencana repaint bagian lain. DILARANG tanya warna.
  - **Tahap 2**: Saat kustomer merespons (tambah velg / bodi saja) -> Presentasikan harga bundling (jika ada) dan arahkan kustomer untuk memilih paket.
  - **Tahap 3**: Setelah paket dipilih -> Gunakan kalimat *"Boleh sekalian saya catat konsep repaintnya..."* lalu kumpulkan warna bodi, velg, dll.
  - **Tahap 4**: Jika bingung warna -> Eskalasi ke tim.

### 3. `src/ai/rules/repaintRules.js`
- Menyesuaikan `guidelines` untuk flow `PRICE_ESTIMATION` agar sejalan dengan aturan "UX Flow V3".

## User Review Required
Apakah ada tambahan skenario spesifik (misal: jika kustomer dari awal sudah menyebutkan warna, apakah AI langsung lompat ke konfirmasi konsep)?
