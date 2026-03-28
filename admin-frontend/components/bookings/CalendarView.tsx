'use client';

import React, { useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { id } from 'date-fns/locale';
import { Booking } from '@/lib/hooks/useBookings';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
  bookings: Booking[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
}

export function CalendarView({ 
  bookings, 
  currentMonth, 
  onMonthChange,
  onDateSelect,
  selectedDate
}: CalendarViewProps) {
  
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const dayLabels = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

  const getBookingsForDay = (date: Date) => {
    return bookings.filter(b => b.bookingDate === format(date, 'yyyy-MM-dd') && b.status !== 'cancelled');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#131313]">
      {/* Calendar Header Controls */}
      <div className="flex justify-between items-end mb-10">
        <div className="space-y-1">
          <p className="text-xs font-bold text-[#FFFF00] tracking-widest space-grotesk uppercase">OPERASIONAL HARIAN</p>
          <h3 className="text-4xl font-black league-spartan tracking-tighter uppercase text-white">
            KALENDER {format(currentMonth, 'MMMM yyyy', { locale: id }).toUpperCase()}
          </h3>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => onMonthChange(subMonths(currentMonth, 1))}
            className="bg-[#2A2A2A] p-3 text-white hover:bg-[#FFFF00] hover:text-[#131313] transition-colors rounded-sm"
          >
            <span className="material-symbols-outlined block">chevron_left</span>
          </button>
          <button 
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="bg-[#2A2A2A] p-3 text-white hover:bg-[#FFFF00] hover:text-[#131313] transition-colors rounded-sm"
          >
            <span className="material-symbols-outlined block">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="flex-1 overflow-auto no-scrollbar border-t border-l border-white/5">
        <div className="grid grid-cols-7 w-full h-full min-w-[800px]">
          {/* Day Labels */}
          {dayLabels.map(label => (
            <div key={label} className="p-4 border-r border-b border-white/5 text-center text-[10px] font-black tracking-widest text-white/30 space-grotesk bg-[#0E0E0E]/30">
              {label}
            </div>
          ))}

          {/* Calendar Cells */}
          {days.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);
            const dayBookings = getBookingsForDay(day);
            const bookingCount = dayBookings.length;

            return (
              <div 
                key={day.toString()}
                onClick={() => onDateSelect(day)}
                className={cn(
                  "min-h-[140px] p-4 border-r border-b border-white/5 transition-colors cursor-pointer relative group",
                  !isCurrentMonth ? "opacity-20 bg-[#0E0E0E]" : "hover:bg-white/5",
                  isSelected && "bg-[#FFFF00]/5 border-b-[#FFFF00]/30 border-r-[#FFFF00]/30",
                  isToday && !isSelected && "bg-white/[0.02]"
                )}
              >
                <span className={cn(
                  "text-sm font-bold space-grotesk",
                  isToday ? "text-[#FFFF00]" : "text-white/80",
                  !isCurrentMonth && "text-white/40"
                )}>
                  {format(day, 'd')}
                </span>

                {isToday && (
                  <div className="absolute top-2 right-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FFFF00] animate-pulse" />
                  </div>
                )}

                {/* Booking Indicators */}
                <div className="mt-4 space-y-1.5">
                  {bookingCount > 0 ? (
                    <>
                      <div className={cn(
                        "px-2 py-1 rounded-sm",
                        isSelected || isToday ? "bg-[#FFFF00]" : "bg-white/10"
                      )}>
                        <p className={cn(
                          "text-[9px] font-black truncate uppercase",
                          isSelected || isToday ? "text-[#131313]" : "text-white/60"
                        )}>
                          {bookingCount} BOOKING{bookingCount > 1 ? 'S' : ''}
                        </p>
                      </div>
                      <p className="text-[8px] text-white/40 pl-1 font-bold space-grotesk truncate uppercase">
                        {dayBookings[0].vehicleInfo}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
