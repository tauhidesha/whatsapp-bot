'use client';

import React, { useMemo, useCallback } from 'react';
import { Booking } from '@/lib/hooks/useBookings';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth, 
  addMonths, 
  subMonths,
  parseISO 
} from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface MobileBookingsViewProps {
  bookings: Booking[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onNewBooking: () => void;
  onEditBooking?: (booking: Booking) => void;
  onDeleteBooking?: (bookingId: string) => void;
}

export default function MobileBookingsView({
  bookings,
  selectedDate,
  onDateSelect,
  currentMonth,
  onMonthChange,
  onNewBooking,
  onEditBooking,
  onDeleteBooking,
}: MobileBookingsViewProps) {
  
  // Calendar logic
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const queueBookings = useMemo(() => {
    return bookings
      .filter(b => isSameDay(parseISO(b.bookingDate), selectedDate) && b.status !== 'cancelled')
      .sort((a, b) => (a.bookingTime || '00:00') > (b.bookingTime || '00:00') ? 1 : -1);
  }, [bookings, selectedDate]);

  const hasBookingOnDay = useCallback((date: Date) => {
    return bookings.some(b => isSameDay(parseISO(b.bookingDate), date) && b.status !== 'cancelled');
  }, [bookings]);

  return (
    <div className="flex flex-col bg-[#131313] min-h-screen pb-32">
      {/* 1. Mini Calendar */}
      <section className="p-4 bg-[#1C1B1B] border-b border-white/5">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="font-spartan font-bold text-white uppercase tracking-wider text-sm">
            {format(currentMonth, 'MMMM yyyy', { locale: id })}
          </h2>
          <div className="flex gap-4">
            <button 
              onClick={() => onMonthChange(subMonths(currentMonth, 1))}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => onMonthChange(addMonths(currentMonth, 1))}
              className="text-zinc-500 hover:text-white transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
            <div key={i} className="text-[10px] text-zinc-500 font-bold mb-2">{day}</div>
          ))}
          
          {days.map((day, i) => {
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const hasBooking = hasBookingOnDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={i}
                onClick={() => onDateSelect(day)}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center text-xs relative rounded-sm transition-all",
                  !isCurrentMonth && "opacity-20",
                  isSelected ? "bg-[#FFFF00] text-black font-bold" : "text-white",
                  !isSelected && isToday && "border border-[#FFFF00]/30"
                )}
              >
                <span>{format(day, 'd')}</span>
                {hasBooking && (
                  <div className={cn(
                    "w-1 h-1 rounded-full absolute bottom-1",
                    isSelected ? "bg-black" : "bg-[#FFFF00]"
                  )} />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Section Header */}
      <section className="px-4 py-6">
        <div className="flex items-center justify-between border-l-4 border-[#FFFF00] pl-4 py-1">
          <h2 className="font-spartan font-black text-white text-lg tracking-tight uppercase">
            ANTREAN HARI INI
          </h2>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest bg-zinc-800/50 px-3 py-1.5 rounded-sm border border-white/5">
            {format(selectedDate, 'EEEE, d MMM', { locale: id }).toUpperCase()}
          </span>
        </div>
      </section>

      {/* 3. Queue Cards */}
      <section className="px-4 space-y-4">
        {queueBookings.length > 0 ? (
          queueBookings.map((booking) => {
            const isActive = booking.status === 'in_progress';
            
            return (
              <div 
                key={booking.id}
                className={cn(
                  "bg-[#1C1B1B] p-4 rounded-lg flex items-center gap-4 relative overflow-hidden transition-all border border-white/5",
                  isActive ? "border-l-4 border-l-[#FFFF00]" : "border-l-4 border-l-zinc-800"
                )}
              >
                {/* Time & Status Column */}
                <div className="flex flex-col items-center justify-center min-w-[70px] border-r border-white/5 pr-4">
                  <span className={cn(
                    "text-xs font-bold",
                    isActive ? "text-[#FFFF00]" : "text-zinc-500"
                  )}>
                    {booking.bookingTime || '09:00'}
                  </span>
                  {isActive && (
                    <span className="text-[8px] text-[#FFFF00] font-black mt-1 uppercase tracking-tighter animate-pulse">
                      Active
                    </span>
                  )}
                </div>

                {/* Info Column */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-spartan font-bold text-white text-[15px] truncate uppercase tracking-tight">
                    {booking.customerName}
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">
                    {booking.vehicleInfo || 'Motor'}
                  </p>
                </div>

                {/* Actions Column */}
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2 text-zinc-500">
                    <button 
                      onClick={() => onEditBooking?.(booking)}
                      className="w-8 h-8 flex items-center justify-center rounded bg-zinc-800/50 border border-white/5 active:bg-zinc-700 transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => onDeleteBooking?.(booking.id)}
                      className="w-8 h-8 flex items-center justify-center rounded bg-zinc-800/50 border border-white/5 text-red-400/50 active:bg-zinc-700 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <span className={cn(
                    "text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest border",
                    isActive 
                      ? "bg-[#FFFF00]/10 text-[#FFFF00] border-[#FFFF00]/30" 
                      : "bg-zinc-800 text-zinc-500 border-transparent"
                  )}>
                    {isActive ? 'ON GOING' : 'WAITING'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 flex flex-col items-center justify-center opacity-20 bg-[#1C1B1B] rounded-lg border border-dashed border-white/10">
            <span className="material-symbols-outlined text-4xl mb-2">event_busy</span>
            <p className="font-spartan font-bold text-xs uppercase tracking-widest text-center">
              Tidak ada antrean<br/>untuk hari ini
            </p>
          </div>
        )}
      </section>

      {/* 4. Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#131313]/90 backdrop-blur-xl border-t border-white/5 z-50">
        <button 
          onClick={onNewBooking}
          className="w-full bg-[#FFFF00] text-black py-4 font-spartan font-black text-lg uppercase tracking-widest shadow-[0_8px_24px_rgba(255,255,0,0.2)] active:scale-[0.98] transition-all"
        >
          NEW BOOKING
        </button>
      </div>
    </div>
  );
}
