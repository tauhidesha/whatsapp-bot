/**
 * Application Constants
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export const CONVERSATION_LABELS = [
  'hot_lead',
  'cold_lead',
  'booking_process',
  'scheduling',
  'completed',
  'follow_up',
  'general',
  'archive',
] as const;

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export const CHANNELS = {
  WHATSAPP: 'whatsapp',
  INSTAGRAM: 'instagram',
  MESSENGER: 'messenger',
} as const;

export const REFRESH_INTERVAL = 15000; // 15 seconds (Requirement 1.4)
