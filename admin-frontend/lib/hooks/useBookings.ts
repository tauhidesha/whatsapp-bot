/**
 * useBookings Hook (Migrated to SQL/Prisma)
 * Manages booking data from PostgreSQL via Prisma API
 * 
 * Requirement 2.1: Fetch and display bookings from SQL
 */

'use client';

import { useState, useEffect, useRef } from 'react';

export type BookingStatus = 'pending' | 'in_progress' | 'done' | 'paid' | 'cancelled';

export interface Booking {
  id: string;
  customerName: string;
  customerPhone: string;
  vehicleInfo: string;
  bookingDate: string;
  bookingTime: string;
  status: BookingStatus;
  services: string | string[];
  notes?: string;
  additionalService?: string;
  totalAmount?: number;
  amountPaid?: number;
  paymentStatus?: string;
  subtotal?: number;
  downPayment?: number;
  paymentMethod?: string;
}

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/bookings?limit=100');
      const json = await res.json();
      
      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch bookings');
      }

      setBookings(json.data as Booking[]);
      setError(null);
    } catch (err: any) {
      console.error('[Hook useBookings] Error:', err);
      setError(err instanceof Error ? err : new Error(err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchBookings();

    // Constant polling (15s)
    intervalRef.current = setInterval(fetchBookings, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, []);

  const updateBookingStatus = async (id: string, newStatus: BookingStatus) => {
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Local update for responsiveness
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
      return true;
    } catch (err) {
      console.error('Error updating booking status:', err);
      throw err;
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      const res = await fetch(`/api/bookings?id=${id}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Local update
      setBookings(prev => prev.filter(b => b.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting booking:', err);
      throw err;
    }
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    try {
      const res = await fetch('/api/bookings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, ...updates }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      // Local update
      setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      return true;
    } catch (err) {
      console.error('Error updating booking:', err);
      throw err;
    }
  };

  return { bookings, loading, error, updateBookingStatus, deleteBooking, updateBooking };
}
