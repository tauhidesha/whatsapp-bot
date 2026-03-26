/**
 * ConversationList Component Tests
 * Tests filtering, search, and selection functionality
 * 
 * Requirements: 1.1, 1.3, 1.7, 1.8, 5.1, 5.2, 5.3
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConversationList from './ConversationList';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';

const mockConversations: Conversation[] = [
  {
    id: '1',
    customerId: 'cust1',
    customerName: 'John Doe',
    customerPhone: '6281234567890',
    channel: 'whatsapp',
    lastMessage: 'Hello, I need help with my order',
    lastMessageTime: Date.now() - 3600000,
    unreadCount: 2,
    label: 'hot_lead',
    aiState: { enabled: true },
  },
  {
    id: '2',
    customerId: 'cust2',
    customerName: 'Jane Smith',
    customerPhone: '6289876543210',
    channel: 'instagram',
    lastMessage: 'Thanks for the update',
    lastMessageTime: Date.now() - 7200000,
    unreadCount: 0,
    label: 'cold_lead',
    aiState: { enabled: false, pausedUntil: Date.now() + 3600000 },
  },
  {
    id: '3',
    customerId: 'cust3',
    customerName: 'Bob Johnson',
    customerPhone: '6287654321098',
    channel: 'messenger',
    lastMessage: 'When is the booking available?',
    lastMessageTime: Date.now() - 1800000,
    unreadCount: 1,
    label: 'booking_process',
    aiState: { enabled: true },
  },
];

describe('ConversationList', () => {
  it('renders conversation list with all items', () => {
    const mockOnSelect = vi.fn();
    render(
      <ConversationList
        conversations={mockConversations}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  it('displays channel badges correctly', () => {
    const mockOnSelect = vi.fn();
    render(
      <ConversationList
        conversations={mockConversations}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('WA')).toBeInTheDocument();
    expect(screen.getByText('IG')).toBeInTheDocument();
    expect(screen.getByText('FB')).toBeInTheDocument();
  });

  it('displays AI paused badge when AI is disabled', () => {
    const mockOnSelect = vi.fn();
    render(
      <ConversationList
        conversations={mockConversations}
        onSelect={mockOnSelect}
      />
    );

    // Jane Smith has AI paused
    const aiPausedBadges = screen.getAllByText('AI Dijeda');
    expect(aiPausedBadges.length).toBeGreaterThan(0);
  });

  it('displays unread count badges', () => {
    const mockOnSelect = vi.fn();
    render(
      <ConversationList
        conversations={mockConversations}
        onSelect={mockOnSelect}
      />
    );

    // John Doe has 2 unread
    expect(screen.getByText('2')).toBeInTheDocument();
    // Bob Johnson has 1 unread
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('filters conversations by label', async () => {
    const mockOnSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ConversationList
        conversations={mockConversations}
        onSelect={mockOnSelect}
      />
    );

    // Select "Hot Lead" filter
    const labelSelect = screen.getByDisplayValue('Semua label');
    await user.selectOptions(labelSelect, 'hot_lead');

    // Only John Doe should be visible
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
  });

  it('searches conversations by customer name', async () => {
    const mockOnSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ConversationList
        conversations={mockConversations}
        onSelect={mockOnSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      'Cari nama, nomor, atau pesan'
    );
    await user.type(searchInput, 'John');

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });
  });

  it('searches conversations by phone number', async () => {
    const mockOnSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ConversationList
        conversations={mockConversations}
        onSelect={mockOnSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      'Cari nama, nomor, atau pesan'
    );
    await user.type(searchInput, '6281234567890');

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });
  });

  it('searches conversations by message content', async () => {
    const mockOnSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ConversationList
        conversations={mockConversations}
        onSelect={mockOnSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      'Cari nama, nomor, atau pesan'
    );
    await user.type(searchInput, 'booking');

    await waitFor(() => {
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });
  });

  it('calls onSelect when conversation is clicked', async () => {
    const mockOnSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ConversationList
        conversations={mockConversations}
        onSelect={mockOnSelect}
      />
    );

    const johnDoeItem = screen.getByText('John Doe').closest('div');
    if (johnDoeItem) {
      await user.click(johnDoeItem);
    }

    expect(mockOnSelect).toHaveBeenCalledWith(mockConversations[0]);
  });

  it('highlights selected conversation', () => {
    const mockOnSelect = vi.fn();
    render(
      <ConversationList
        conversations={mockConversations}
        selectedId="1"
        onSelect={mockOnSelect}
      />
    );

    // The ConversationItem div has the styling applied
    const conversationItems = screen.getAllByText(/John Doe|Jane Smith|Bob Johnson/);
    const johnDoeItem = conversationItems[0].closest('div[class*="flex items-start"]');
    
    // Check if the item has the active styling
    expect(johnDoeItem?.className).toContain('bg-blue-50');
    expect(johnDoeItem?.className).toContain('border-blue-600');
  });

  it('displays empty state when no conversations match filter', async () => {
    const mockOnSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ConversationList
        conversations={mockConversations}
        onSelect={mockOnSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      'Cari nama, nomor, atau pesan'
    );
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('Tidak ada percakapan yang cocok')).toBeInTheDocument();
    });
  });

  it('displays loading state', () => {
    const mockOnSelect = vi.fn();
    render(
      <ConversationList
        conversations={[]}
        onSelect={mockOnSelect}
        loading={true}
      />
    );

    expect(screen.getByText('Memuat percakapan...')).toBeInTheDocument();
  });

  it('combines label filter and search filter', async () => {
    const mockOnSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <ConversationList
        conversations={mockConversations}
        onSelect={mockOnSelect}
      />
    );

    // Select "Hot Lead" filter
    const labelSelect = screen.getByDisplayValue('Semua label');
    await user.selectOptions(labelSelect, 'hot_lead');

    // Search for "John"
    const searchInput = screen.getByPlaceholderText(
      'Cari nama, nomor, atau pesan'
    );
    await user.type(searchInput, 'John');

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
    });
  });
});
