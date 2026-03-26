'use client';

import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { id } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Booking } from '@/lib/hooks/useBookings';

const locales = {
  'id-ID': id,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarViewProps {
  bookings: Booking[];
}

export function CalendarView({ bookings }: CalendarViewProps) {
  // Pre-calculate daily detailing capacity for block coloring
  const dailyDetailing = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach(b => {
      if (b.status === 'cancelled') return;
      const servicesList = Array.isArray(b.services) ? b.services : [b.services].filter(Boolean);
      const servicesStr = servicesList.join(' ').toLowerCase();
      if (servicesStr.includes('detailing') || servicesStr.includes('coating') || servicesStr.includes('cuci') || servicesStr.includes('wash')) {
        counts[b.bookingDate] = (counts[b.bookingDate] || 0) + 1;
      }
    });
    return counts;
  }, [bookings]);

  const events: Event[] = useMemo(() => {
    return bookings.map(booking => {
      let startDateStr = `${booking.bookingDate}T${booking.bookingTime || '09:00'}:00`;
      let startDate = new Date(startDateStr);
      
      if (isNaN(startDate.getTime())) {
          startDate = new Date();
      }
      
      // Estimate 2 hours for a typical service
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      const servicesList = Array.isArray(booking.services) ? booking.services : [booking.services].filter(Boolean);
      const servicesStr = servicesList.join(' ').toLowerCase();
      const isRepaint = servicesStr.includes('repaint') || servicesStr.includes('repair');
      const isDetailing = servicesStr.includes('detailing') || servicesStr.includes('coating') || servicesStr.includes('cuci') || servicesStr.includes('wash');

      // Determine color based on service type (matching Capacity Widget colors)
      let bgColor = '#94a3b8'; // slate (General)
      if (isRepaint) bgColor = '#3b82f6'; // blue (Repaint)
      else if (isDetailing) bgColor = '#14b8a6'; // teal (Detailing)
      
      if (booking.status === 'cancelled') bgColor = '#f87171'; // red

      return {
        id: booking.id,
        title: `${booking.vehicleInfo} - ${booking.customerName}`,
        start: startDate,
        end: endDate,
        allDay: false,
        resource: {
           status: booking.status,
           services: booking.services,
           phone: booking.customerPhone,
           color: bgColor,
           isCancelled: booking.status === 'cancelled'
        }
      };
    });
  }, [bookings]);

  const eventStyleGetter = (event: Event) => {
    const r = event.resource as any;
    return {
      style: {
        backgroundColor: r?.color || '#3b82f6',
        borderRadius: '6px',
        opacity: r?.isCancelled ? 0.6 : 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        textDecoration: r?.isCancelled ? 'line-through' : 'none'
      }
    };
  };

  const dayPropGetter = (date: Date) => {
    // Format local date
    const dateStr = format(date, 'yyyy-MM-dd');
    const isFull = (dailyDetailing[dateStr] || 0) >= 2;
    
    if (isFull) {
      return {
        style: {
          backgroundColor: '#fef2f2', // light red background for full day
        }
      };
    }
    return {};
  };

  return (
    <div className="h-[500px] sm:h-[600px] w-full bg-white p-2 sm:p-4 rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
      <div className="min-w-[600px] sm:min-w-0">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        eventPropGetter={eventStyleGetter}
        dayPropGetter={dayPropGetter}
        culture="id-ID"
        messages={{
            next: "Maju",
            previous: "Mundur",
            today: "Hari Ini",
            month: "Bulan",
            week: "Minggu",
            day: "Hari"
        }}
        views={['month', 'week', 'day']}
        defaultView="week"
        min={new Date(0, 0, 0, 8, 0, 0)} // Start at 8 AM
        max={new Date(0, 0, 0, 20, 0, 0)} // End at 8 PM
      />
      </div>
    </div>
  );
}
