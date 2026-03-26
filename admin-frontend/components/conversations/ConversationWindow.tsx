'use client';

import { useState } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import { useConversationMessages } from '@/lib/hooks/useConversationMessages';
import { ApiClient } from '@/lib/api/client';
import ConversationHeader from './ConversationHeader';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';

interface ConversationWindowProps {
  conversation: Conversation;
  apiClient: ApiClient;
  onBack?: () => void;
}

export default function ConversationWindow({
  conversation,
  apiClient,
  onBack,
}: ConversationWindowProps) {
  const [sendingMessage, setSendingMessage] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [updatingLabel, setUpdatingLabel] = useState(false);

  // Load messages for this conversation - use customerPhone or platformId
  const conversationPhone = conversation.customerPhone || conversation.platformId;
  const { messages, loading: messagesLoading } = useConversationMessages({
    conversationId: conversationPhone,
    enabled: !!conversationPhone,
  });

  const handleSendMessage = async (messageText: string) => {
    setSendingMessage(true);
    try {
      const targetId = conversation.customerPhone || conversation.platformId || conversation.id;
      await apiClient.sendMessage({
        number: targetId,
        message: messageText,
        channel: conversation.channel,
        platformId: targetId,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAiStateChange = async (enabled: boolean, reason?: string) => {
    setTogglingAi(true);
    try {
      const targetId = conversation.customerPhone || conversation.platformId || conversation.id;
      await apiClient.updateAiState(targetId, {
        enabled,
        reason,
      });
    } catch (error) {
      console.error('Failed to update AI state:', error);
      throw error;
    } finally {
      setTogglingAi(false);
    }
  };

  const handleLabelChange = async (label: string, reason?: string) => {
    setUpdatingLabel(true);
    try {
      await apiClient.updateLabel(conversation.id, {
        label,
        reason,
      });
    } catch (error) {
      console.error('Failed to update conversation label:', error);
      throw error;
    } finally {
      setUpdatingLabel(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-50">
        <ConversationHeader
          conversation={conversation}
          apiClient={apiClient}
          onAiStateChange={handleAiStateChange}
          onLabelChange={handleLabelChange}
          onBack={onBack}
          loading={togglingAi || updatingLabel}
        />
      </div>

      {/* Messages Area */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <MessageList messages={messages} loading={messagesLoading} />
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0">
        <MessageComposer
          conversation={conversation}
          onSend={handleSendMessage}
          disabled={sendingMessage}
        />
      </div>
    </div>
  );
}