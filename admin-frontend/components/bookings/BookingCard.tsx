'use client';

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Booking } from '@/lib/hooks/useBookings';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import Modal from '@/components/shared/Modal';

interface BookingCardProps {
  booking: Booking;
  isOverlay?: boolean;
}

export function BookingCard({ booking, isOverlay }: BookingCardProps) {
  const [showPayment, setShowPayment] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Transfer BCA');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: booking.id,
    data: {
      type: 'Booking',
      booking,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPaying(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process payment');
      
      setShowPayment(false);
      // Let the realtime hook handle the status update to "paid"
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pembayaran');
    } finally {
      setIsPaying(false);
    }
  };

  if (isDragging) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className="opacity-40 border-2 border-primary border-dashed rounded-xl bg-primary/5 h-32 w-full" 
      />
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          "bg-white p-4 rounded-xl shadow-sm border border-slate-200/60 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group relative",
          isOverlay ? "rotate-2 scale-105 shadow-xl cursor-grabbing" : ""
        )}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="font-bold text-slate-800 leading-tight">{booking.customerName}</h4>
            <span className="text-[11px] font-semibold text-slate-500">{booking.customerPhone}</span>
          </div>
          <div className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded">
            {booking.bookingDate}
          </div>
        </div>
        
        <div className="mt-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 py-1.5 px-2 rounded-md border border-slate-100">
            <span className="material-symbols-outlined text-[14px] text-teal-600">two_wheeler</span>
            <span className="truncate">{booking.vehicleInfo || 'Motor tidak disebut'}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-2">
          {Array.isArray(booking.services) 
            ? booking.services.slice(0, 2).map((svc, i) => (
                <span key={i} className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
                  {svc}
                </span>
              ))
            : (
                <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
                  {booking.services}
                </span>
              )
          }
          {Array.isArray(booking.services) && booking.services.length > 2 && (
            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-1 rounded-full">
              +{booking.services.length - 2}
            </span>
          )}
        </div>

        {(booking.additionalService || booking.notes) && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 line-clamp-2">
            {booking.additionalService && <span className="font-bold text-amber-600 mr-2">[{booking.additionalService}]</span>}
            {booking.notes}
          </div>
        )}

        {/* Action section */}
        <div 
          className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" 
          onClick={(e) => e.stopPropagation()} 
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Link href={`/conversations?phone=${booking.customerPhone}`}>
            <div className="bg-white hover:bg-slate-50 shadow-sm border border-slate-200 p-1.5 rounded-lg text-blue-600 hover:text-blue-700">
              <span className="material-symbols-outlined text-[16px] block">chat</span>
            </div>
          </Link>
          {booking.status === 'done' && (
            <button 
              onClick={() => setShowPayment(true)}
              className="bg-teal-600 hover:bg-teal-700 shadow-sm p-1.5 px-2.5 rounded-lg text-white font-bold text-[10px] uppercase tracking-wide flex items-center gap-1"
            >
              Bayar
            </button>
          )}
        </div>
      </div>

      <Modal isOpen={showPayment} onClose={() => setShowPayment(false)} title="Pembayaran & Invoice" size="sm">
        <form onSubmit={handlePay} className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
            {(booking as any).downPayment > 0 && (
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>Subtotal</span>
                <span>Rp {((booking as any).subtotal || 0).toLocaleString()}</span>
              </div>
            )}
            {(booking as any).downPayment > 0 && (
              <div className="flex justify-between text-xs text-amber-600 mb-2">
                <span>DP (sudah dibayar)</span>
                <span>- Rp {((booking as any).downPayment || 0).toLocaleString()}</span>
              </div>
            )}
            <p className="text-xs font-bold text-slate-500 mb-1">{(booking as any).downPayment > 0 ? 'Sisa Tagihan:' : 'Total Tagihan:'}</p>
            <p className="text-xl font-black text-slate-800">
              Rp { (booking as any).subtotal ? Math.max(0, (booking as any).subtotal - ((booking as any).downPayment || 0)).toLocaleString() : '0' }
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-black tracking-wider text-slate-500">Metode Pembayaran</label>
            <select 
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="Transfer BCA">Transfer BCA</option>
              <option value="Tunai">Tunai</option>
              <option value="QRIS">QRIS</option>
            </select>
          </div>

          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mt-2">
            <div className="flex gap-2">
              <span className="material-symbols-outlined text-blue-500 text-[16px]">info</span>
              <p className="text-[11px] text-blue-700 font-medium">
                Sistem akan otomatis: <br/>
                1. Merekam transaksi pemasukan di <b>Finance</b><br/>
                2. Mengirim PDF Bukti Pembayaran ke WA <b>{booking.customerName}</b>
              </p>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setShowPayment(false)}
              className="flex-1 h-11 bg-slate-100 text-slate-600 font-bold text-xs uppercase rounded-xl hover:bg-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPaying}
              className="flex-[2] h-11 bg-teal-600 text-white font-bold text-xs uppercase tracking-wide rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-500/20 disabled:opacity-50"
            >
              {isPaying ? 'Memproses...' : 'Lunas & Kirim'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
