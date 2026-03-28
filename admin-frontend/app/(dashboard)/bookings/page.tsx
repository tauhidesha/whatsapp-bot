'use client';

import React, { useState, useMemo } from 'react';
import { useBookings, Booking } from '@/lib/hooks/useBookings';
import { CalendarView } from '@/components/bookings/CalendarView';
import MobileBookingsView from '@/components/bookings/MobileBookingsView';
import { Button } from '@/components/ui/button';
import { Plus, Search, Bell, UserCircle } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import ManualBookingForm from '@/components/bookings/ManualBookingForm';
import { createApiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRealtimeConversations } from '@/lib/hooks/useRealtimeConversations';
import { useLayout } from '@/context/LayoutContext';
import { format, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { id } from 'date-fns/locale';

export default function BookingsPage() {
  const { bookings, loading, updateBookingStatus, deleteBooking, updateBooking } = useBookings();
  const { conversations } = useRealtimeConversations();
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const { setHeaderTitle, setHeaderExtra } = useLayout();
  const { getIdToken } = useAuth();

  const apiClient = useMemo(() => createApiClient(
    process.env.NEXT_PUBLIC_API_URL || '/api',
    getIdToken
  ), [getIdToken]);

  React.useEffect(() => {
    setHeaderTitle('MANAJEMEN BOOKING');
    setHeaderExtra(
      <div className="relative group w-full max-w-md hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40 group-focus-within:text-[#FFFF00] transition-colors" />
        <input 
          className="bg-[#1C1B1B] border-none focus:ring-0 text-xs w-full pl-10 py-2.5 rounded-sm placeholder:text-white/20 text-white font-headline" 
          placeholder="Cari jadwal atau nama customer..." 
          type="text"
        />
      </div>
    );
    return () => {
      setHeaderTitle('SYSTEM OVERVIEW');
      setHeaderExtra(null);
    };
  }, [setHeaderTitle, setHeaderExtra]);

  // Handle estimated revenue and stats calculations...
  const queueBookings = useMemo(() => {
    return bookings
      .filter(b => isSameDay(parseISO(b.bookingDate), selectedDate) && b.status !== 'cancelled')
      .sort((a, b) => (a.bookingTime || '00:00') > (b.bookingTime || '00:00') ? 1 : -1);
  }, [bookings, selectedDate]);

  const todayStats = useMemo(() => {
    return {
      filled: queueBookings.length,
      available: Math.max(0, 10 - queueBookings.length)
    };
  }, [queueBookings]);

  const estimatedRevenue = useMemo(() => {
    return queueBookings.reduce((sum, b) => sum + (Number(b.subtotal) || 500000), 0);
  }, [queueBookings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#131313]">
        <div className="animate-spin size-10 border-4 border-[#FFFF00]/10 border-t-[#FFFF00] rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#131313] overflow-hidden">
      {/* Search bar inside the Global Header via layout context if needed, but for now we rely on Global Header Title */}

      {/* ── MAIN CONTENT (CALENDAR + SIDEBAR) ── */}
      <div className="hidden md:flex flex-1 min-h-0 overflow-hidden mt-2">
        
        {/* Left Section: Calendar Canvas */}
        <section className="flex-1 p-8 overflow-y-auto no-scrollbar flex flex-col">
          <CalendarView 
            bookings={bookings} 
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            onDateSelect={setSelectedDate}
            selectedDate={selectedDate}
          />
          
          {/* New Booking Button triggers Modal */}
          <div className="mt-8 flex justify-end">
            <button 
              onClick={() => {
                setEditingBooking(null);
                setShowBookingModal(true);
              }}
              className="bg-[#FFFF00] text-[#131313] font-black text-xs px-8 h-12 tracking-widest rounded-sm transition-transform active:scale-95 font-headline uppercase"
            >
              NEW BOOKING
            </button>
          </div>
        </section>

        {/* Right Section: Today's Queue Sidebar */}
        <aside className="w-[420px] bg-[#1C1B1B] border-l border-white/5 flex flex-col shrink-0">
          <div className="p-8 border-b border-white/5 bg-[#2A2A2A]/30">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-black font-display tracking-tighter text-[#FFFF00] uppercase italic">
                ANTREAN {format(selectedDate, 'dd MMMM', { locale: id }).toUpperCase()}
              </h3>
              <span className="bg-[#FFFF00] text-[#131313] text-[9px] font-black px-2 py-0.5 rounded-sm font-headline tracking-widest italic">
                {format(selectedDate, 'MMM dd', { locale: id }).toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-white/40">schedule</span>
              <p className="text-[10px] text-white/40 font-bold font-headline uppercase tracking-[0.2em]">
                {todayStats.filled} Slots Terisi / {todayStats.available} Tersedia
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
            {queueBookings.length > 0 ? (
              queueBookings.map((booking) => (
                <div 
                  key={booking.id}
                  onClick={() => {
                    setEditingBooking(booking);
                    setShowBookingModal(true);
                  }}
                  className={cn(
                    "p-5 border-l-2 group hover:bg-[#353534] transition-all cursor-pointer relative",
                    booking.status === 'in_progress' 
                      ? "bg-[#2A2A2A] border-[#FFFF00]" 
                      : "bg-[#0E0E0E] border-white/10"
                  )}
                >
                  {/* Edit Indicator on hover */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 p-1 rounded-sm">
                    <span className="material-symbols-outlined text-[10px] text-white/40">edit</span>
                  </div>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className={cn(
                        "text-[10px] font-bold tracking-widest font-headline",
                        booking.status === 'in_progress' ? "text-[#FFFF00]" : "text-white/40"
                      )}>
                        {booking.bookingTime || '09:00'} WIB
                      </p>
                      <h4 className="text-lg font-black font-display uppercase tracking-tight text-white leading-tight">
                        {booking.customerName}
                      </h4>
                    </div>
                    <span className={cn(
                      "text-[9px] font-black px-2 py-1 rounded-sm font-headline uppercase tracking-widest",
                      booking.status === 'in_progress' 
                        ? "bg-[#FFFF00] text-[#131313]" 
                        : "bg-white/5 text-white/40"
                    )}>
                      {booking.status === 'in_progress' ? 'ON GOING' : 'WAITING'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-white/40">two_wheeler</span>
                      <p className="text-xs font-bold text-white/80 font-headline uppercase tracking-tight">
                        {booking.vehicleInfo || 'Unknown Vehicle'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-white/40">build</span>
                      <p className="text-[11px] text-white/60 font-body">
                        {Array.isArray(booking.services) ? booking.services.join(' / ') : booking.services}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                 <span className="material-symbols-outlined text-6xl">calendar_month</span>
                 <p className="font-headline font-black text-xs uppercase mt-4">Tidak ada jadwal</p>
              </div>
            )}
          </div>

          {/* Revenue Summary Footer */}
          <div className="p-6 bg-[#2A2A2A] border-t border-white/5">
            <div className="flex justify-between items-center text-[10px] font-black font-headline tracking-widest uppercase mb-2">
              <span className="text-white/40">Estimasi Pendapatan ({format(selectedDate, 'dd/MM')})</span>
              <span className="text-[#FFFF00]">Rp {estimatedRevenue.toLocaleString()}</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#FFFF00]" 
                style={{ width: `${Math.min(100, (estimatedRevenue / 5000000) * 100)}%` }} 
              />
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile View */}
      <div className="md:hidden flex-1 overflow-y-auto no-scrollbar">
        <MobileBookingsView
          bookings={bookings}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          onNewBooking={() => {
            setEditingBooking(null);
            setShowBookingModal(true);
          }}
          onEditBooking={(booking) => {
            setEditingBooking(booking);
            setShowBookingModal(true);
          }}
          onDeleteBooking={deleteBooking}
        />
      </div>

      {/* Manual Booking Modal */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        size="full"
        showHeader={false}
      >
        <ManualBookingForm
          apiClient={apiClient}
          allConversations={conversations}
          initialData={editingBooking}
          onDelete={deleteBooking}
          onUpdate={updateBooking}
          onSuccess={() => {
            setShowBookingModal(false);
            setEditingBooking(null);
          }}
          onCancel={() => {
            setShowBookingModal(false);
            setEditingBooking(null);
          }}
        />
      </Modal>
    </div>
  );
}
