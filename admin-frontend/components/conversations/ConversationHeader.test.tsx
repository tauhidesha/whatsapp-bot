/**
 * ConversationHeader Component Tests
 * Tests AI state toggle and pause information display
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.7, 3.8
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConversationHeader from './ConversationHeader';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';

const mockConversation: Conversation = {
  id: '1',
  customerId: 'cust1',
  customerName: 'John Doe',
  customerPhone: '6281234567890',
  channel: 'whatsapp',
  lastMessage: 'Hello',
  lastMessageTime: Date.now(),
  unreadCount: 0,
  aiState: { enabled: true },
};

describe('ConversationHeader', () => {
  it('renders customer name and phone', () => {
    const mockOnAiStateChange = vi.fn();
    render(
      <ConversationHeader
        conversation={mockConversation}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('6281234567890')).toBeInTheDocument();
  });

  it('displays channel badge', () => {
    const mockOnAiStateChange = vi.fn();
    render(
      <ConversationHeader
        conversation={mockConversation}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    expect(screen.getByText('WA')).toBeInTheDocument();
  });

  it('displays AI active status when enabled', () => {
    const mockOnAiStateChange = vi.fn();
    render(
      <ConversationHeader
        conversation={mockConversation}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    expect(screen.getByText('AI Aktif')).toBeInTheDocument();
  });

  it('displays AI paused status when disabled', () => {
    const mockOnAiStateChange = vi.fn();
    const pausedConv: Conversation = {
      ...mockConversation,
      aiState: { enabled: false, pausedUntil: Date.now() + 3600000 },
    };

    render(
      <ConversationHeader
        conversation={pausedConv}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    expect(screen.getByText(/AI Dijeda/)).toBeInTheDocument();
  });

  it('shows pause information when AI status is clicked', async () => {
    const mockOnAiStateChange = vi.fn();
    const user = userEvent.setup();
    const pausedUntil = Date.now() + 3600000;
    const pausedConv: Conversation = {
      ...mockConversation,
      aiState: {
        enabled: false,
        pausedUntil,
        reason: 'Manual pause by admin',
      },
    };

    render(
      <ConversationHeader
        conversation={pausedConv}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    const statusButton = screen.getByText(/AI Dijeda/);
    await user.click(statusButton);

    await waitFor(() => {
      expect(screen.getByText('Informasi Jeda AI')).toBeInTheDocument();
      expect(screen.getByText(/Manual pause by admin/)).toBeInTheDocument();
    });
  });

  it('toggles AI state when button is clicked', async () => {
    const mockOnAiStateChange = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <ConversationHeader
        conversation={mockConversation}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    const toggleButton = screen.getByText('Jeda AI');
    await user.click(toggleButton);

    await waitFor(() => {
      expect(mockOnAiStateChange).toHaveBeenCalledWith(false, 'Manual pause by admin');
    });
  });

  it('resumes AI when paused', async () => {
    const mockOnAiStateChange = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const pausedConv: Conversation = {
      ...mockConversation,
      aiState: { enabled: false },
    };

    render(
      <ConversationHeader
        conversation={pausedConv}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    const toggleButton = screen.getByText('Lanjutkan AI');
    await user.click(toggleButton);

    await waitFor(() => {
      expect(mockOnAiStateChange).toHaveBeenCalledWith(true, undefined);
    });
  });

  it('disables toggle button while processing', async () => {
    const mockOnAiStateChange = vi.fn(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    const user = userEvent.setup();

    render(
      <ConversationHeader
        conversation={mockConversation}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    const toggleButton = screen.getByText('Jeda AI');
    await user.click(toggleButton);

    // Button should be disabled while processing
    expect(toggleButton).toBeDisabled();
  });

  it('displays different button text based on AI state', () => {
    const mockOnAiStateChange = vi.fn();
    const { rerender } = render(
      <ConversationHeader
        conversation={mockConversation}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    expect(screen.getByText('Jeda AI')).toBeInTheDocument();

    const pausedConv: Conversation = {
      ...mockConversation,
      aiState: { enabled: false },
    };

    rerender(
      <ConversationHeader
        conversation={pausedConv}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    expect(screen.getByText('Lanjutkan AI')).toBeInTheDocument();
  });

  it('displays AI status with different colors based on state', () => {
    const mockOnAiStateChange = vi.fn();
    const { rerender } = render(
      <ConversationHeader
        conversation={mockConversation}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    let statusButton = screen.getByText('AI Aktif').closest('button');
    expect(statusButton).toHaveClass('bg-green-100');

    const pausedConv: Conversation = {
      ...mockConversation,
      aiState: { enabled: false },
    };

    rerender(
      <ConversationHeader
        conversation={pausedConv}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    statusButton = screen.getByText(/AI Dijeda/).closest('button');
    expect(statusButton).toHaveClass('bg-amber-100');
  });

  it('handles AI state change errors gracefully', async () => {
    const mockOnAiStateChange = vi
      .fn()
      .mockRejectedValue(new Error('Failed to update'));
    const user = userEvent.setup();

    render(
      <ConversationHeader
        conversation={mockConversation}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    const toggleButton = screen.getByText('Jeda AI');
    await user.click(toggleButton);

    await waitFor(() => {
      expect(mockOnAiStateChange).toHaveBeenCalled();
    });
  });

  it('displays customer avatar initial', () => {
    const mockOnAiStateChange = vi.fn();
    render(
      <ConversationHeader
        conversation={mockConversation}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    const avatar = screen.getByText('J');
    expect(avatar).toBeInTheDocument();
  });

  it('displays correct channel badge for Instagram', () => {
    const mockOnAiStateChange = vi.fn();
    const instagramConv: Conversation = {
      ...mockConversation,
      channel: 'instagram',
    };

    render(
      <ConversationHeader
        conversation={instagramConv}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    expect(screen.getByText('IG')).toBeInTheDocument();
  });

  it('displays correct channel badge for Messenger', () => {
    const mockOnAiStateChange = vi.fn();
    const messengerConv: Conversation = {
      ...mockConversation,
      channel: 'messenger',
    };

    render(
      <ConversationHeader
        conversation={messengerConv}
        onAiStateChange={mockOnAiStateChange}
      />
    );

    expect(screen.getByText('FB')).toBeInTheDocument();
  });
});
