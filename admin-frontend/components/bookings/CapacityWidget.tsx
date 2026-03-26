'use client';

import React, { useMemo } from 'react';
import { Booking } from '@/lib/hooks/useBookings';
import { PaintBucket, Sparkles } from 'lucide-react';

interface CapacityWidgetProps {
  bookings: Booking[];
}

export function CapacityWidget({ bookings }: CapacityWidgetProps) {
  const { repaintCount, detailingCount } = useMemo(() => {
    let repaintActive = 0;
    let detailingToday = 0;

    const todayStr = new Date().toISOString().split('T')[0];

    bookings.forEach(booking => {
      // Exclude cancelled bookings from capacity calculating
      if (booking.status === 'cancelled') return;

      const servicesList = Array.isArray(booking.services) ? booking.services : [booking.services].filter(Boolean);
      const servicesStr = servicesList.join(' ').toLowerCase();
      
      const isRepaint = servicesStr.includes('repaint') || servicesStr.includes('repair');
      const isDetailing = servicesStr.includes('detailing') || servicesStr.includes('coating') || servicesStr.includes('cuci') || servicesStr.includes('wash');

      if (isRepaint) {
        // Repaint uses capacity if it's currently pending or in_progress
        if (booking.status === 'pending' || booking.status === 'in_progress') {
          repaintActive += 1;
        }
      } else if (isDetailing) {
        // Detailing uses capacity per day. So if it's scheduled for today and not cancelled.
        if (booking.bookingDate === todayStr) {
          detailingToday += 1;
        }
      }
    });

    return { repaintCount: repaintActive, detailingCount: detailingToday };
  }, [bookings]);

  const maxRepaint = 2;
  const maxDetailing = 2;

  const repaintPercentage = Math.min(100, Math.round((repaintCount / maxRepaint) * 100));
  const detailingPercentage = Math.min(100, Math.round((detailingCount / maxDetailing) * 100));

  return (
    <div className="flex gap-4 mb-6">
      <div className="bg-white border text-sm border-slate-200 shadow-sm rounded-xl p-4 flex-1 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <PaintBucket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Kapasitas Repaint</h3>
              <p className="text-xs text-slate-500 font-medium">Dalam Pengerjaan</p>
            </div>
          </div>
          <span className={`font-black text-xl ${repaintCount >= maxRepaint ? 'text-red-600' : 'text-slate-800'}`}>
            {repaintCount} <span className="text-slate-400 text-sm font-semibold">/ {maxRepaint}</span>
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
          <div 
            className={`h-full rounded-full ${repaintCount >= maxRepaint ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: `${repaintPercentage}%` }}
          />
        </div>
        {repaintCount >= maxRepaint && (
          <p className="text-xs text-red-600 mt-2 font-medium">Kapasitas penuh! Stop terima booking repaint.</p>
        )}
      </div>

      <div className="bg-white border text-sm border-slate-200 shadow-sm rounded-xl p-4 flex-1 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Kapasitas Detailing</h3>
              <p className="text-xs text-slate-500 font-medium">Jadwal Hari Ini</p>
            </div>
          </div>
          <span className={`font-black text-xl ${detailingCount >= maxDetailing ? 'text-red-600' : 'text-slate-800'}`}>
            {detailingCount} <span className="text-slate-400 text-sm font-semibold">/ {maxDetailing}</span>
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
          <div 
            className={`h-full rounded-full ${detailingCount >= maxDetailing ? 'bg-red-500' : 'bg-teal-500'}`}
            style={{ width: `${detailingPercentage}%` }}
          />
        </div>
        {detailingCount >= maxDetailing && (
           <p className="text-xs text-red-600 mt-2 font-medium">Slot detailing hari ini sudah penuh.</p>
        )}
      </div>
    </div>
  );
}
