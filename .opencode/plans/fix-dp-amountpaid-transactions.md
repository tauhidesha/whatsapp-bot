# Fix: Record DP and amountPaid as transactions

## Problem
Saat admin input DP (`nominalDP`) atau pembayaran (`amountPaid`) di ManualBookingForm, uang masuk tidak tercatat di tabel Transaction (kecuali `dpAmount > 0` di POST endpoint).

## Current State
- **POST /api/bookings**: Create transaction hanya untuk `dpAmount > 0` (baris 200-222) ✅
- **POST /api/bookings**: `amountPaid` tidak bikin transaksi ❌
- **PUT /api/bookings**: `amountPaid` update field tapi tidak bikin transaksi ❌

## Fix

### 1. POST /api/bookings
Setelah DP transaction, tambahkan logic untuk `amountPaid` yang berbeda dari `dpAmount`:
```typescript
// If amountPaid > dpAmount, create additional transaction for the difference
if (amountPaid > downPayment && amountPaid > 0) {
  const additionalPayment = amountPaid - downPayment;
  await prisma.transaction.create({
    data: {
      customerId: customer.id,
      bookingId: booking.id,
      amount: additionalPayment,
      type: 'income',
      status: 'SUCCESS',
      description: `Pembayaran Service: ${serviceName}`,
      paymentMethod: paymentMethod || 'transfer',
    }
  });
}
```

### 2. PUT /api/bookings
Saat `amountPaid` berubah, create transaction untuk selisih positif:
```typescript
if (data.amountPaid !== undefined) {
  const prevPaid = existingBooking.amountPaid || 0;
  const diff = data.amountPaid - prevPaid;
  if (diff > 0) {
    await prisma.transaction.create({
      data: {
        customerId: booking.customerId,
        bookingId: id,
        amount: diff,
        type: 'income',
        status: 'SUCCESS',
        description: `Pembayaran Service: ${existingBooking.serviceType}`,
        paymentMethod: data.paymentMethod || existingBooking.paymentMethod || 'transfer',
      }
    });
  }
}
```

## Files to change
- `admin-frontend/app/api/bookings/route.ts` (POST and PUT handlers)
