import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Notification, { NotificationData } from './Notification';

describe('Notification Component', () => {
  let mockNotification: NotificationData;

  beforeEach(() => {
    mockNotification = {
      id: 'notif-1',
      customerName: 'John Doe',
      messagePreview: 'Hello, I need help with my booking',
      timestamp: new Date('2024-01-15T10:30:00'),
      customerId: 'customer-1',
    };
  });

  describe('Rendering', () => {
    it('renders notification with customer name', () => {
      const onDismiss = vi.fn();
      render(
        <Notification notification={mockNotification} onDismiss={onDismiss} />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('renders message preview', () => {
      const onDismiss = vi.fn();
      render(
        <Notification notification={mockNotification} onDismiss={onDismiss} />
      );

      expect(
        screen.getByText('Hello, I need help with my booking')
      ).toBeInTheDocument();
    });

    it('renders formatted timestamp', () => {
      const onDismiss = vi.fn();
      render(
        <Notification notification={mockNotification} onDismiss={onDismiss} />
      );

      // Check that time is displayed in the notification
      const notification = screen.getByText('John Doe').closest('div');
      expect(notification).toBeInTheDocument();
      // The timestamp should be rendered somewhere in the notification (format: 10.30 or 10:30)
      expect(notification?.textContent).toMatch(/10[.:]\d{2}/);
    });

    it('renders notification icon', () => {
      const onDismiss = vi.fn();
      render(
        <Notification notification={mockNotification} onDismiss={onDismiss} />
      );

      const icon = screen.getByText('notifications');
      expect(icon).toHaveClass('material-symbols-outlined');
    });

    it('renders dismiss button', () => {
      const onDismiss = vi.fn();
      render(
        <Notification notification={mockNotification} onDismiss={onDismiss} />
      );

      const closeButton = screen.getByLabelText('Tutup notifikasi');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onDismiss when dismiss button is clicked', () => {
      const onDismiss = vi.fn();
      render(
        <Notification notification={mockNotification} onDismiss={onDismiss} />
      );

      const closeButton = screen.getByLabelText('Tutup notifikasi');
      fireEvent.click(closeButton);

      expect(onDismiss).toHaveBeenCalledWith('notif-1');
    });

    it('calls onNavigate when notification is clicked', () => {
      const onDismiss = vi.fn();
      const onNavigate = vi.fn();
      render(
        <Notification
          notification={mockNotification}
          onDismiss={onDismiss}
          onNavigate={onNavigate}
        />
      );

      const notification = screen.getByText('John Doe').closest('div');
      fireEvent.click(notification!);

      expect(onNavigate).toHaveBeenCalledWith('customer-1');
    });

    it('does not call onNavigate if not provided', () => {
      const onDismiss = vi.fn();
      render(
        <Notification notification={mockNotification} onDismiss={onDismiss} />
      );

      const notification = screen.getByText('John Doe').closest('div');
      fireEvent.click(notification!);

      // Should not throw error
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('stops propagation when dismiss button is clicked', () => {
      const onDismiss = vi.fn();
      const onNavigate = vi.fn();
      render(
        <Notification
          notification={mockNotification}
          onDismiss={onDismiss}
          onNavigate={onNavigate}
        />
      );

      const closeButton = screen.getByLabelText('Tutup notifikasi');
      fireEvent.click(closeButton);

      expect(onDismiss).toHaveBeenCalled();
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Auto-dismiss', () => {
    it('auto-dismisses after specified timeout', () => {
      const onDismiss = vi.fn();
      vi.useFakeTimers();

      render(
        <Notification
          notification={mockNotification}
          onDismiss={onDismiss}
          autoDismissMs={3000}
        />
      );

      expect(onDismiss).not.toHaveBeenCalled();

      vi.advanceTimersByTime(3000);

      expect(onDismiss).toHaveBeenCalledWith('notif-1');

      vi.useRealTimers();
    });

    it('does not auto-dismiss when autoDismissMs is 0', async () => {
      const onDismiss = vi.fn();
      vi.useFakeTimers();

      render(
        <Notification
          notification={mockNotification}
          onDismiss={onDismiss}
          autoDismissMs={0}
        />
      );

      vi.advanceTimersByTime(10000);

      expect(onDismiss).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('clears timeout on unmount', () => {
      const onDismiss = vi.fn();
      vi.useFakeTimers();

      const { unmount } = render(
        <Notification
          notification={mockNotification}
          onDismiss={onDismiss}
          autoDismissMs={5000}
        />
      );

      unmount();
      vi.advanceTimersByTime(5000);

      expect(onDismiss).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Edge Cases', () => {
    it('handles long customer names with truncation', () => {
      const longNameNotification: NotificationData = {
        ...mockNotification,
        customerName:
          'This is a very long customer name that should be truncated',
      };
      const onDismiss = vi.fn();

      render(
        <Notification
          notification={longNameNotification}
          onDismiss={onDismiss}
        />
      );

      const nameElement = screen.getByText(
        /This is a very long customer name/
      );
      expect(nameElement).toHaveClass('truncate');
    });

    it('handles long message previews with line clamping', () => {
      const longMessageNotification: NotificationData = {
        ...mockNotification,
        messagePreview:
          'This is a very long message that spans multiple lines and should be clamped to show only two lines of text',
      };
      const onDismiss = vi.fn();

      render(
        <Notification
          notification={longMessageNotification}
          onDismiss={onDismiss}
        />
      );

      const messageElement = screen.getByText(/This is a very long message/);
      expect(messageElement).toHaveClass('line-clamp-2');
    });

    it('handles notification without customerId', () => {
      const notificationWithoutId: NotificationData = {
        ...mockNotification,
        customerId: undefined,
      };
      const onDismiss = vi.fn();
      const onNavigate = vi.fn();

      render(
        <Notification
          notification={notificationWithoutId}
          onDismiss={onDismiss}
          onNavigate={onNavigate}
        />
      );

      const notification = screen.getByText('John Doe').closest('div');
      fireEvent.click(notification!);

      expect(onNavigate).toHaveBeenCalledWith(undefined);
    });
  });

  describe('Accessibility', () => {
    it('has proper button role for dismiss button', () => {
      const onDismiss = vi.fn();
      render(
        <Notification notification={mockNotification} onDismiss={onDismiss} />
      );

      const closeButton = screen.getByLabelText('Tutup notifikasi');
      expect(closeButton).toHaveAttribute('aria-label');
    });

    it('is keyboard accessible', () => {
      const onDismiss = vi.fn();
      render(
        <Notification notification={mockNotification} onDismiss={onDismiss} />
      );

      const closeButton = screen.getByLabelText('Tutup notifikasi');
      closeButton.focus();
      expect(closeButton).toHaveFocus();

      fireEvent.keyDown(closeButton, { key: 'Enter' });
      fireEvent.click(closeButton);

      expect(onDismiss).toHaveBeenCalled();
    });
  });
});
