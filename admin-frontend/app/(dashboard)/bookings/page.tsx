'use client';

import React, { useState } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useBookings, BookingStatus } from '@/lib/hooks/useBookings';
import { BoardColumn } from '@/components/bookings/BoardColumn';
import { BookingCard } from '@/components/bookings/BookingCard';
import { CalendarView } from '@/components/bookings/CalendarView';
import { CapacityWidget } from '@/components/bookings/CapacityWidget';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Calendar as CalendarIcon, Plus } from 'lucide-react';
import Modal from '@/components/shared/Modal';
import ManualBookingForm from '@/components/bookings/ManualBookingForm';
import { createApiClient } from '@/lib/api/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRealtimeConversations } from '@/lib/hooks/useRealtimeConversations';

const COLUMNS: { id: BookingStatus; title: string, color: string }[] = [
  { id: 'pending', title: 'New Booking', color: 'border-blue-500' },
  { id: 'in_progress', title: 'Sedang Dikerjakan', color: 'border-amber-500' },
  { id: 'done', title: 'Selesai', color: 'border-teal-500' },
  { id: 'cancelled', title: 'Dibatalkan', color: 'border-red-500' },
];

export default function BookingsPage() {
  const { bookings, loading, updateBookingStatus } = useBookings();
  const { conversations } = useRealtimeConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'calendar'>('kanban');
  const [showBookingModal, setShowBookingModal] = useState(false);
  
  const { getIdToken } = useAuth();
  const apiClient = createApiClient(
    process.env.NEXT_PUBLIC_API_URL || '/api',
    getIdToken
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-slate-50">
        <div className="animate-spin size-8 border-4 border-slate-200 border-t-teal-500 rounded-full"></div>
      </div>
    );
  }

  const columns = COLUMNS.map(col => ({
    ...col,
    items: bookings.filter(b => b.status === col.id)
  }));

  const activeBooking = activeId ? bookings.find(b => b.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedId = active.id;
    const overData = over.data.current;
    let newStatus: BookingStatus | undefined;

    if (overData?.type === 'Column') {
      newStatus = overData.columnId as BookingStatus;
    } else if (overData?.type === 'Booking') {
      newStatus = overData.booking.status as BookingStatus;
    }

    const currentBooking = bookings.find(b => b.id === draggedId);
    if (newStatus && currentBooking && currentBooking.status !== newStatus) {
      await updateBookingStatus(draggedId as string, newStatus);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50">
      <div className="p-6 pb-2 border-b border-slate-200 bg-white shadow-sm z-10 flex-shrink-0 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Manajemen Kanban Booking</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Kelola jadwal servis dan antrean bengkel.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-lg mb-2">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('kanban')}
            className={`text-xs h-8 px-3 ${viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Board
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className={`text-xs h-8 px-3 ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            Kalender
          </Button>

          <Button
            onClick={() => setShowBookingModal(true)}
            className="ml-4 bg-teal-600 text-white hover:bg-teal-700 hover:scale-[1.02] transition-all font-black text-xs px-4 h-8 rounded-lg shadow-lg shadow-teal-500/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Booking Baru
          </Button>
        </div>
      </div>

      {/* Manual Booking Modal */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        title="Buat Booking Manual"
        size="lg"
      >
        <ManualBookingForm
          apiClient={apiClient}
          allConversations={conversations}
          onSuccess={() => {
            setShowBookingModal(false);
          }}
          onCancel={() => setShowBookingModal(false)}
        />
      </Modal>
      
      <div className="flex-1 overflow-x-auto overflow-y-auto p-3 sm:p-6">
        <CapacityWidget bookings={bookings} />

        {viewMode === 'kanban' ? (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full gap-3 sm:gap-6 items-start pb-4">
              {columns.map(col => (
                <BoardColumn key={col.id} id={col.id} title={col.title} items={col.items} headerColor={col.color} />
              ))}
            </div>

            <DragOverlay>
              {activeBooking ? <BookingCard booking={activeBooking} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <CalendarView bookings={bookings} />
        )}
      </div>
    </div>
  );
}
