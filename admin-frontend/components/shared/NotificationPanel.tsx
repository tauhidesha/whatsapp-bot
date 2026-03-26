/**
 * Notification Panel Component
 * Stacks and displays multiple notifications
 */

'use client';

import Notification, { NotificationData } from './Notification';

interface NotificationPanelProps {
  notifications: NotificationData[];
  onDismiss: (id: string) => void;
  onNavigate?: (customerId?: string) => void;
  maxNotifications?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export default function NotificationPanel({
  notifications,
  onDismiss,
  onNavigate,
  maxNotifications = 5,
  position = 'top-right',
}: NotificationPanelProps) {
  const displayedNotifications = notifications.slice(0, maxNotifications);

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  if (displayedNotifications.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed ${positionClasses[position]} z-40 flex flex-col gap-3 pointer-events-none max-w-sm`}
    >
      {displayedNotifications.map((notification) => (
        <div key={notification.id} className="pointer-events-auto">
          <Notification
            notification={notification}
            onDismiss={onDismiss}
            onNavigate={onNavigate}
          />
        </div>
      ))}

      {/* Notification count badge if there are more */}
      {notifications.length > maxNotifications && (
        <div className="pointer-events-auto text-center">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            +{notifications.length - maxNotifications} notifikasi lainnya
          </span>
        </div>
      )}
    </div>
  );
}
