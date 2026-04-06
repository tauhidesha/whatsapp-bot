# Fix: Hide SUCCESS bookings from calendar and queue

## Problem
Booking Rully dengan status `SUCCESS` masih muncul di calendar view dan queue sidebar. Filter saat ini hanya hide `done` dan `paid`, tapi status yang dipakai sistem adalah `SUCCESS`.

## Root Cause
`isBookingActiveOnDate` di `admin-frontend/lib/utils/booking-visibility.ts` baris 19 hanya cek:
```
if (booking.status === 'done' || booking.status === 'paid') return false;
```

Tapi booking Rully punya status `SUCCESS` (dari database), jadi lolos filter dan tetap tampil.

## Fix
Ganti `done` dengan `success` di filter:
```
if (booking.status === 'success' || booking.status === 'paid') return false;
```

Status `done` tetap tampil (sesuai request user: "kalau done jangan hiding").
Status `success` dan `paid` akan hidden (booking sudah selesai/lunas).

## Files to change
- `admin-frontend/lib/utils/booking-visibility.ts` line 19
