'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRealtimeConversations } from '@/lib/hooks/useRealtimeConversations';
import { useConversationNotifications } from '@/lib/hooks/useConversationNotifications';
import { useAuth } from '@/lib/hooks/useAuth';
import { createApiClient } from '@/lib/api/client';
import ConversationList from '@/components/conversations/ConversationList';
import ConversationWindow from '@/components/conversations/ConversationWindow';
import NotificationPanel from '@/components/shared/NotificationPanel';
import { cn } from '@/lib/utils';
import { useLayout } from '@/context/LayoutContext';

// Error Boundary Component for graceful error handling
function ConversationErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h2 className="text-red-900 font-semibold mb-2">Something went wrong</h2>
        <p className="text-red-700 text-sm">
          There was an error loading the conversations. Please refresh the page to try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

function ConversationsContent() {
  const { user, getIdToken } = useAuth();
  const searchParams = useSearchParams();
  const { setHeaderTitle, setHeaderExtra } = useLayout();
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Update header on mount
  useEffect(() => {
    setHeaderTitle('INBOX CONTROL');
    
    // Inject search bar into header
    setHeaderExtra(
      <div className="relative w-full group">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-[20px] group-focus-within:text-[#FFFF00] transition-colors">
          search
        </span>
        <input 
          type="text"
          placeholder="Cari chat atau pesan..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 bg-[#1C1B1B] border border-white/5 rounded-sm pl-12 pr-4 text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:border-[#FFFF00]/30 transition-all font-sans"
        />
      </div>
    );

    return () => {
      setHeaderTitle('SYSTEM OVERVIEW');
      setHeaderExtra(null);
    };
  }, [setHeaderTitle, setHeaderExtra, searchQuery]);

  // Handle incoming 'id' from query parameters
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam) {
      setSelectedConversationId(idParam);
    }
  }, [searchParams]);

  // Load conversations with error handling
  const { conversations, loading, error } = useRealtimeConversations({
    enabled: !!user,
  });

  // Set up real-time notifications
  const {
    notifications,
    dismissNotification,
    dismissAllNotifications,
    notificationCount,
    browserNotificationPermission,
  } = useConversationNotifications({
    conversations,
    selectedConversationId,
    enabled: !!user,
  });

  // Create API client
  const apiClient = createApiClient(
    process.env.NEXT_PUBLIC_API_URL || '/api',
    getIdToken
  );

  // Find selected conversation
  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  // Handle conversation selection
  const handleConversationSelect = (conversation: any) => {
    setSelectedConversationId(conversation.id);
  };

  // Handle notification click - navigate to conversation
  const handleNotificationNavigate = (customerId?: string) => {
    if (customerId) {
      setSelectedConversationId(customerId);
    }
  };

  if (error) {
    return (
      <ConversationErrorBoundary>
        <div className="bg-red-900/20 border border-red-500/50 rounded-sm p-4">
          <h2 className="text-red-400 font-headline font-black mb-2 uppercase tracking-wider">Connection Error</h2>
          <p className="text-red-300/70 text-[11px] font-sans">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-red-600 text-white rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </ConversationErrorBoundary>
    );
  }

  return (
    <>
      <div className="flex bg-[#131313] overflow-hidden h-[calc(100vh-64px)] relative">
        {/* Conversation List */}
        <div className={cn(
          "h-full shrink-0 transition-all duration-300 min-w-0",
          selectedConversationId ? "hidden md:flex" : "flex w-full md:w-80 lg:w-96"
        )}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            onSelect={handleConversationSelect}
            loading={loading}
          />
        </div>

        {/* Conversation Window */}
        <div className={cn(
          "flex-1 h-full transition-all duration-300 min-w-0",
          !selectedConversationId ? "hidden md:flex" : "flex w-full"
        )}>
          {selectedConversation ? (
            <ConversationWindow
              conversation={selectedConversation}
              allConversations={conversations}
              apiClient={apiClient}
              onBack={() => setSelectedConversationId(undefined)}
            />
          ) : (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-[#131313] relative overflow-hidden">
              {/* Subtle background branding */}
              <div className="absolute -right-20 -bottom-20 opacity-[0.02] select-none pointer-events-none">
                <span className="font-headline text-[40rem] leading-none text-white italic">B</span>
              </div>
              
              <div className="text-center relative z-10">
                <div className="size-24 bg-[#1C1B1B] border border-white/5 rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-2xl">
                  <span className="material-symbols-outlined text-5xl text-slate-700">
                    forum
                  </span>
                </div>
                <h3 className="text-white font-headline font-black text-xl uppercase tracking-widest mb-2">Pilih Percakapan</h3>
                <p className="text-slate-500 font-sans text-xs uppercase tracking-widest font-bold">
                  {conversations.length} total percakapan tersedia
                </p>
                {notificationCount > 0 && (
                  <p className="text-[#FFFF00] text-[10px] mt-4 font-black uppercase tracking-widest animate-pulse">
                    {notificationCount} notifikasi baru
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification Panel */}
      <NotificationPanel
        notifications={notifications}
        onDismiss={dismissNotification}
        onNavigate={handleNotificationNavigate}
        position="top-right"
        maxNotifications={5}
      />

      {/* Browser notification permission prompt */}
      {browserNotificationPermission === 'default' && showPermissionPrompt && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] md:left-6 md:translate-x-0 md:w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-5 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start gap-4">
            <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-2xl">
                notifications_active
              </span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-sm text-slate-900 mb-1">
                Enable Notifications
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                Get notified when new messages arrive, even when the tab is not active.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    Notification.requestPermission().then(() => {
                      setShowPermissionPrompt(false);
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-zinc-900 text-white text-[11px] font-black uppercase tracking-wider rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-zinc-900/10"
                >
                  Enable
                </button>
                <button
                  onClick={() => setShowPermissionPrompt(false)}
                  className="px-4 py-2 text-slate-400 text-[11px] font-bold uppercase tracking-wider hover:text-slate-600 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
    </div>}>
      <ConversationsContent />
    </Suspense>
  );
}
