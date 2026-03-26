/**
 * Notification Card Component
 * Displays individual notification with customer info and dismiss functionality
 */

'use client';

import { useEffect } from 'react';

export interface NotificationData {
  id: string;
  customerName: string;
  messagePreview: string;
  timestamp: Date;
  customerId?: string;
}

interface NotificationProps {
  notification: NotificationData;
  onDismiss: (id: string) => void;
  onNavigate?: (customerId?: string) => void;
  autoDismissMs?: number;
}

export default function Notification({
  notification,
  onDismiss,
  onNavigate,
  autoDismissMs = 5000,
}: NotificationProps) {
  useEffect(() => {
    if (autoDismissMs > 0) {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, autoDismissMs);

      return () => clearTimeout(timer);
    }
  }, [notification.id, autoDismissMs, onDismiss]);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleClick = () => {
    if (onNavigate) {
      onNavigate(notification.customerId);
    }
  };

  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg p-4 flex items-start gap-4 hover:shadow-xl transition-shadow cursor-pointer group"
      onClick={handleClick}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-lg">
          notifications
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
            {notification.customerName}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
            {formatTime(notification.timestamp)}
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
          {notification.messagePreview}
        </p>
      </div>

      {/* Dismiss Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Tutup notifikasi"
      >
        <span className="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  );
}
