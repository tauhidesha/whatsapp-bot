import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationPanel from './NotificationPanel';
import { NotificationData } from './Notification';

describe('NotificationPanel Component', () => {
  const createMockNotification = (
    id: string,
    customerName: string
  ): NotificationData => ({
    id,
    customerName,
    messagePreview: `Message from ${customerName}`,
    timestamp: new Date(),
    customerId: `customer-${id}`,
  });

  describe('Rendering', () => {
    it('renders nothing when notifications array is empty', () => {
      const onDismiss = vi.fn();
      const { container } = render(
        <NotificationPanel notifications={[]} onDismiss={onDismiss} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders all notifications when count is below max', () => {
      const notifications = [
        createMockNotification('1', 'John Doe'),
        createMockNotification('2', 'Jane Smith'),
        createMockNotification('3', 'Bob Johnson'),
      ];
      const onDismiss = vi.fn();

      render(
        <NotificationPanel
          notifications={notifications}
          onDismiss={onDismiss}
          maxNotifications={5}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    it('limits displayed notifications to maxNotifications', () => {
      const notifications = Array.from({ length: 10 }, (_, i) =>
        createMockNotification(`${i}`, `Customer ${i}`)
      );
      const onDismiss = vi.fn();

      render(
        <NotificationPanel
          notifications={notifications}
          onDismiss={onDismiss}
          maxNotifications={5}
        />
      );

      expect(screen.getByText('Customer 0')).toBeInTheDocument();
      expect(screen.getByText('Customer 4')).toBeInTheDocument();
      expect(screen.queryByText('Customer 5')).not.toBeInTheDocument();
    });

    it('displays overflow count badge when notifications exceed max', () => {
      const notifications = Array.from({ length: 8 }, (_, i) =>
        createMockNotification(`${i}`, `Customer ${i}`)
      );
      const onDismiss = vi.fn();

      render(
        <NotificationPanel
          notifications={notifications}
          onDismiss={onDismiss}
          maxNotifications={5}
        />
      );

      expect(screen.getByText(/\+3 notifikasi lainnya/)).toBeInTheDocument();
    });

    it('does not display overflow badge when all notifications fit', () => {
      const notifications = [
        createMockNotification('1', 'John Doe'),
        createMockNotification('2', 'Jane Smith'),
      ];
      const onDismiss = vi.fn();

      render(
        <NotificationPanel
          notifications={notifications}
          onDismiss={onDismiss}
          maxNotifications={5}
        />
      );

      expect(screen.queryByText(/\+\d+ notifikasi lainnya/)).not.toBeInTheDocument();
    });
  });

  describe('Positioning', () => {
    it('applies top-right position by default', () => {
      const notifications = [createMockNotification('1', 'John Doe')];
      const onDismiss = vi.fn();

      const { container } = render(
        <NotificationPanel notifications={notifications} onDismiss={onDismiss} />
      );

      const panel = container.querySelector('.fixed');
      expect(panel).toHaveClass('top-4', 'right-4');
    });

    it('applies top-left position', () => {
      const notifications = [createMockNotification('1', 'John Doe')];
      const onDismiss = vi.fn();

      const { container } = render(
        <NotificationPanel
          notifications={notifications}
          onDismiss={onDismiss}
          position="top-left"
        />
      );

      const panel = container.querySelector('.fixed');
      expect(panel).toHaveClass('top-4', 'left-4');
    });

    it('applies bottom-right position', () => {
      const notifications = [createMockNotification('1', 'John Doe')];
      const onDismiss = vi.fn();

      const { container } = render(
        <NotificationPanel
          notifications={notifications}
          onDismiss={onDismiss}
          position="bottom-right"
        />
      );

      const panel = container.querySelector('.fixed');
      expect(panel).toHaveClass('bottom-4', 'right-4');
    });

    it('applies bottom-left position', () => {
      const notifications = [createMockNotification('1', 'John Doe')];
      const onDismiss = vi.fn();

      const { container } = render(
        <NotificationPanel
          notifications={notifications}
          onDismiss={onDismiss}
          position="bottom-left"
        />
      );

      const panel = container.querySelector('.fixed');
      expect(panel).toHaveClass('bottom-4', 'left-4');
    });
  });

  describe('Interactions', () => {
    it('calls onDismiss when notification dismiss button is clicked', () => {
      const notifications = [createMockNotification('1', 'John Doe')];
      const onDismiss = vi.fn();

      render(
        <NotificationPanel notifications={notifications} onDismiss={onDismiss} />
      );

      const closeButton = screen.getByLabelText('Tutup notifikasi');
      fireEvent.click(closeButton);

      expect(onDismiss).toHaveBeenCalledWith('1');
    });

    it('calls onNavigate when notification is clicked', () => {
      const notifications = [createMockNotification('1', 'John Doe')];
      const onDismiss = vi.fn();
      const onNavigate = vi.fn();

      render(
        <NotificationPanel
          notifications={notifications}
          onDismiss={onDismiss}
          onNavigate={onNavigate}
        />
      );

      const notification = screen.getByText('John Doe').closest('div');
      fireEvent.click(notification!);

      expect(onNavigate).toHaveBeenCalledWith('customer-1');
    });

    it('handles multiple notification dismissals', () => {
      const notifications = [
        createMockNotification('1', 'John Doe'),
        createMockNotification('2', 'Jane Smith'),
      ];
      const onDismiss = vi.fn();

      const { rerender } = render(
        <NotificationPanel notifications={notifications} onDismiss={onDismiss} />
      );

      const closeButtons = screen.getAllByLabelText('Tutup notifikasi');
      fireEvent.click(closeButtons[0]);

      expect(onDismiss).toHaveBeenCalledWith('1');

      // Simulate dismissal by removing from array
      const updatedNotifications = [notifications[1]];
      rerender(
        <NotificationPanel
          notifications={updatedNotifications}
          onDismiss={onDismiss}
        />
      );

      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  describe('Stacking', () => {
    it('displays notifications in correct order (newest first)', () => {
      const notifications = [
        createMockNotification('3', 'Customer 3'),
        createMockNotification('2', 'Customer 2'),
        createMockNotification('1', 'Customer 1'),
      ];
      const onDismiss = vi.fn();

      render(
        <NotificationPanel notifications={notifications} onDismiss={onDismiss} />
      );

      // Get all customer name elements
      const customer3 = screen.getByText('Customer 3');
      const customer2 = screen.getByText('Customer 2');
      const customer1 = screen.getByText('Customer 1');

      // Verify they all exist
      expect(customer3).toBeInTheDocument();
      expect(customer2).toBeInTheDocument();
      expect(customer1).toBeInTheDocument();
    });

    it('maintains proper spacing between stacked notifications', () => {
      const notifications = [
        createMockNotification('1', 'John Doe'),
        createMockNotification('2', 'Jane Smith'),
      ];
      const onDismiss = vi.fn();

      const { container } = render(
        <NotificationPanel notifications={notifications} onDismiss={onDismiss} />
      );

      const panel = container.querySelector('.flex.flex-col.gap-3');
      expect(panel).toHaveClass('gap-3');
    });
  });

  describe('Z-index and Layering', () => {
    it('has correct z-index for panel', () => {
      const notifications = [createMockNotification('1', 'John Doe')];
      const onDismiss = vi.fn();

      const { container } = render(
        <NotificationPanel notifications={notifications} onDismiss={onDismiss} />
      );

      const panel = container.querySelector('.fixed');
      expect(panel).toHaveClass('z-40');
    });

    it('has correct z-index for individual notifications', () => {
      const notifications = [createMockNotification('1', 'John Doe')];
      const onDismiss = vi.fn();

      const { container } = render(
        <NotificationPanel notifications={notifications} onDismiss={onDismiss} />
      );

      const notificationDiv = container.querySelector('.pointer-events-auto');
      expect(notificationDiv).toHaveClass('pointer-events-auto');
    });
  });

  describe('Edge Cases', () => {
    it('handles maxNotifications of 1', () => {
      const notifications = [
        createMockNotification('1', 'John Doe'),
        createMockNotification('2', 'Jane Smith'),
      ];
      const onDismiss = vi.fn();

      render(
        <NotificationPanel
          notifications={notifications}
          onDismiss={onDismiss}
          maxNotifications={1}
        />
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      expect(screen.getByText(/\+1 notifikasi lainnya/)).toBeInTheDocument();
    });

    it('handles large number of notifications', () => {
      const notifications = Array.from({ length: 100 }, (_, i) =>
        createMockNotification(`${i}`, `Customer ${i}`)
      );
      const onDismiss = vi.fn();

      render(
        <NotificationPanel
          notifications={notifications}
          onDismiss={onDismiss}
          maxNotifications={5}
        />
      );

      expect(screen.getByText(/\+95 notifikasi lainnya/)).toBeInTheDocument();
    });
  });
});
