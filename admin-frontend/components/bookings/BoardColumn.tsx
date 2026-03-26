'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Booking } from '@/lib/hooks/useBookings';
import { BookingCard } from './BookingCard';
import { cn } from '@/lib/utils';

interface BoardColumnProps {
  id: string;
  title: string;
  headerColor: string;
  items: Booking[];
}

export function BoardColumn({ id, title, headerColor, items }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'Column',
      columnId: id,
    },
  });

  return (
    <div className="flex flex-col flex-shrink-0 w-72 sm:w-80 h-full max-h-full rounded-2xl bg-slate-100 overflow-hidden shadow-sm border border-slate-200/50">
      <div className={cn("px-4 py-3 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm", headerColor && `border-t-4 ${headerColor}`)}>
        <h3 className="font-bold text-slate-700">{title}</h3>
        <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{items.length}</div>
      </div>
      
      <div 
        ref={setNodeRef} 
        className={cn("flex-1 p-3 overflow-y-auto space-y-3 transition-colors", isOver ? "bg-slate-200/50" : "")}
      >
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(booking => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </SortableContext>
        
        {items.length === 0 && (
          <div className="h-24 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 text-sm font-semibold">
            Kosong
          </div>
        )}
      </div>
    </div>
  );
}
