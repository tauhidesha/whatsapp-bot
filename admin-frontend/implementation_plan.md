# Plan: Full shadcn/ui Implementation 🚀

Dokumen ini merinci langkah-langkah untuk memigrasikan seluruh komponen UI di `admin-frontend` ke **shadcn/ui**, menggantikan sisa-sisa implementasi manual atau library lain.

## Proposed Changes

### 1. Komponen Shared (Utama)
Akan menggantikan komponen di `components/shared/` dengan versi shadcn yang lebih robust.

- [ ] **Input**: Ganti [components/shared/Input.tsx](file:///Users/Babayasa/Documents/Project/LangGraph/whatsapp-ai-chatbot/admin-frontend/components/shared/Input.tsx) dengan shadcn `Input`.
  - Tambahkan komponen via: `npx shadcn@latest add input`
- [ ] **Modal**: Ganti [components/shared/Modal.tsx](file:///Users/Babayasa/Documents/Project/LangGraph/whatsapp-ai-chatbot/admin-frontend/components/shared/Modal.tsx) dengan shadcn `Dialog`.
  - Tambahkan komponen via: `npx shadcn@latest add dialog`
- [ ] **Notification**: Ganti [components/shared/Notification.tsx](file:///Users/Babayasa/Documents/Project/LangGraph/whatsapp-ai-chatbot/admin-frontend/components/shared/Notification.tsx) dengan shadcn `Toast` atau `Sonner`.
  - Tambahkan komponen via: `npx shadcn@latest add toast` atau `npx shadcn@latest add sonner`
- [ ] **Loading**: Implementasikan `Skeleton` untuk loading states yang lebih halus.
  - Tambahkan komponen via: `npx shadcn@latest add skeleton`

### 2. Layout & Navigasi
Refactoring lebih lanjut pada layout agar menggunakan standar shadcn.

- [ ] **MobileNav**: Refactor [MobileNav.tsx](file:///Users/Babayasa/Documents/Project/LangGraph/whatsapp-ai-chatbot/admin-frontend/components/layout/MobileNav.tsx) menggunakan shadcn `Sheet`.
  - Tambahkan komponen via: `npx shadcn@latest add sheet`
- [ ] **Header**: Gunakan shadcn `DropdownMenu` untuk menu profil admin di [Header.tsx](file:///Users/Babayasa/Documents/Project/LangGraph/whatsapp-ai-chatbot/admin-frontend/components/layout/Header.tsx).
  - Tambahkan komponen via: `npx shadcn@latest add dropdown-menu`
- [ ] **Global Scroll**: Gunakan shadcn `ScrollArea` untuk Sidebar dan Daftar Percakapan.
  - Tambahkan komponen via: `npx shadcn@latest add scroll-area`

### 3. Fitur Percakapan (Conversations)
Pembaruan UI pada modul utama aplikasi.

- [ ] **ConversationList**: Gunakan shadcn `Badge` untuk indikator jumlah pesan belum terbaca.
  - Tambahkan komponen via: `npx shadcn@latest add badge`
- [ ] **MessageComposer**: Gunakan shadcn `Textarea` yang auto-resize.
  - Tambahkan komponen via: `npx shadcn@latest add textarea`
- [ ] **ConversationItem**: Refactor styling hover dan active menggunakan utility shadcn.

## Verification Plan

### Automated Tests
- Menjalankan `npm run test` untuk memastikan refactoring tidak merusak fungsionalitas logika.

### Manual Verification
- Cek responsivitas MobileNav (Sheet) di ukuran layar mobile.
- Pastikan warna Yellow aksen tetap konsisten di semua komponen baru (Input borders, Buttons, Badges).
- Verifikasi animasi Modal (Dialog) dan Notifikasi (Toast).
