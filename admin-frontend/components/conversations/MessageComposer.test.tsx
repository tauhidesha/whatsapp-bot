/**
 * MessageComposer Component Tests
 * Tests message sending, keyboard shortcuts, and auto-expand
 * 
 * Requirements: 2.1, 2.2, 2.4, 2.7, 2.9
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageComposer from './MessageComposer';
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

describe('MessageComposer', () => {
  it('renders textarea and send button', () => {
    const mockOnSend = vi.fn();
    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
      />
    );

    expect(screen.getByPlaceholderText(/Ketik pesan/)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('displays channel indicator', () => {
    const mockOnSend = vi.fn();
    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
      />
    );

    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  });

  it('displays correct channel label for Instagram', () => {
    const mockOnSend = vi.fn();
    const instagramConv: Conversation = {
      ...mockConversation,
      channel: 'instagram',
    };

    render(
      <MessageComposer
        conversation={instagramConv}
        onSend={mockOnSend}
      />
    );

    expect(screen.getByText('Instagram')).toBeInTheDocument();
  });

  it('displays correct channel label for Messenger', () => {
    const mockOnSend = vi.fn();
    const messengerConv: Conversation = {
      ...mockConversation,
      channel: 'messenger',
    };

    render(
      <MessageComposer
        conversation={messengerConv}
        onSend={mockOnSend}
      />
    );

    expect(screen.getByText('Messenger')).toBeInTheDocument();
  });

  it('sends message on Enter key', async () => {
    const mockOnSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ketik pesan/);
    await user.type(textarea, 'Hello world');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockOnSend).toHaveBeenCalledWith('Hello world');
    });
  });

  it('does not send message on Shift+Enter', async () => {
    const mockOnSend = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ketik pesan/);
    await user.type(textarea, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    // Should not call onSend
    expect(mockOnSend).not.toHaveBeenCalled();

    // Should have newline in textarea
    expect(textarea).toHaveValue('Line 1\n');
  });

  it('clears textarea after sending message', async () => {
    const mockOnSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ketik pesan/);
    await user.type(textarea, 'Hello world');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('disables send button when message is empty', () => {
    const mockOnSend = vi.fn();
    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
      />
    );

    const sendButton = screen.getByRole('button');
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when message has content', async () => {
    const mockOnSend = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ketik pesan/);
    const sendButton = screen.getByRole('button');

    await user.type(textarea, 'Hello');

    expect(sendButton).not.toBeDisabled();
  });

  it('disables send button while sending', async () => {
    const mockOnSend = vi.fn(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    const user = userEvent.setup();

    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ketik pesan/);
    const sendButton = screen.getByRole('button');

    await user.type(textarea, 'Hello');
    await user.keyboard('{Enter}');

    // Button should be disabled while sending
    expect(sendButton).toBeDisabled();
  });

  it('disables textarea when disabled prop is true', () => {
    const mockOnSend = vi.fn();
    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
        disabled={true}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ketik pesan/);
    expect(textarea).toBeDisabled();
  });

  it('handles send errors gracefully', async () => {
    const mockOnSend = vi.fn().mockRejectedValue(new Error('Send failed'));
    const user = userEvent.setup();

    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ketik pesan/);
    await user.type(textarea, 'Hello');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      // Message should still be in textarea on error
      expect(textarea).toHaveValue('Hello');
    });
  });

  it('does not send empty or whitespace-only messages', async () => {
    const mockOnSend = vi.fn();
    const user = userEvent.setup();

    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ketik pesan/);
    await user.type(textarea, '   ');
    await user.keyboard('{Enter}');

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('supports multi-line messages', async () => {
    const mockOnSend = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <MessageComposer
        conversation={mockConversation}
        onSend={mockOnSend}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ketik pesan/);
    await user.type(textarea, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, 'Line 2');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockOnSend).toHaveBeenCalledWith('Line 1\nLine 2');
    });
  });
});
