'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Message } from '@/lib/hooks/useConversationMessages';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLayout } from '@/context/LayoutContext';
import { useScrollDirection } from '@/lib/hooks/useScrollDirection';

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
}

function formatMessageText(text: string) {
  if (!text) return '';
  text = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
  text = text.replace(/~([^~]+)~/g, '<del>$1</del>');
  return text;
}

export default function MessageList({ messages, loading = false }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const { setIsHeaderVisible } = useLayout();
  const { isAtTop } = useScrollDirection(scrollEl);

  // Callback ref - dipanggil tepat saat DOM element ter-attach/detach
  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    if (node) {
      setScrollEl(node);
      setIsHeaderVisible(false); // default hide saat conversation dibuka
    } else {
      setScrollEl(null);
      setIsHeaderVisible(true); // reset saat keluar
    }
  }, [setIsHeaderVisible]);

  // Show header hanya saat di posisi paling atas, hide saat scroll down
  useEffect(() => {
    if (isAtTop) {
      setIsHeaderVisible(true);
    } else {
      setIsHeaderVisible(false);
    }
  }, [setIsHeaderVisible, isAtTop]);

  // Auto-scroll to latest message (tanpa trigger hide)
  useEffect(() => {
    if (!scrollEl) return;
    const timeout = setTimeout(() => {
      scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(timeout);
  }, [scrollEl]); // hanya saat pertama attach, bukan setiap messages update

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50/30">
        <div className="text-center">
          <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-500">Memuat riwayat pesan...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50/50">
        <div className="text-center p-8 max-w-xs">
          <div className="size-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-slate-200/50 mb-8 border border-slate-50">
            <span className="material-symbols-outlined text-6xl text-slate-100">forum</span>
          </div>
          <h4 className="text-slate-900 font-black text-lg mb-2">Pintu Terbuka!</h4>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">
            Belum ada pesan di sini. Jadilah yang pertama menyapa pelanggan Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setScrollRef}
      className="h-full w-full bg-[#fbfbfb]"
      style={{ overflowY: 'auto', overflowX: 'hidden' }}
    >
      {/* Subtle Background Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]" />

      <div
        className="py-4 md:py-8 flex flex-col gap-3 min-h-full"
        style={{ padding: '1rem 0.75rem', width: '100%', boxSizing: 'border-box' }}
      >
        {/* Spacer to push content down if not full */}
        <div className="flex-1" />

        {messages.map((message, idx) => {
          const isOutgoing = message.sender === 'admin' || message.sender === 'ai';
          const senderLabel =
            message.sender === 'customer'
              ? 'Customer'
              : message.sender === 'ai'
                ? 'AI Assistant'
                : 'Admin';

          const timeAgo = (() => {
            try {
              if (!message.timestamp) return 'Baru saja';
              const date = new Date(message.timestamp);
              if (isNaN(date.getTime())) return 'Baru saja';
              return formatDistanceToNow(date, { addSuffix: false, locale: idLocale });
            } catch {
              return 'Baru saja';
            }
          })();

          const showAvatar = !isOutgoing && (idx === 0 || messages[idx - 1].sender !== message.sender);

          return (
            <div
              key={message.id}
              className={cn(
                "flex group animate-in fade-in slide-in-from-bottom-4 duration-500",
                isOutgoing ? "justify-end" : "justify-start"
              )}
              style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}
            >
              {!isOutgoing && (
                <div className="w-10 mr-3 shrink-0 flex flex-col justify-end">
                  {showAvatar ? (
                    <div className="w-9 h-9 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shadow-md font-black text-slate-300 text-[10px]">
                      {senderLabel.charAt(0)}
                    </div>
                  ) : <div className="w-9" />}
                </div>
              )}

              <div
                className={cn(
                  "flex flex-col",
                  isOutgoing ? "items-end" : "items-start"
                )}
                style={{
                  minWidth: 0,
                  maxWidth: isOutgoing ? '75%' : 'calc(75% - 52px)',
                }}
              >
                <div
                  className={cn(
                    "px-4 py-3 rounded-2xl leading-relaxed text-[15px] relative transition-all duration-300",
                    isOutgoing
                      ? "bg-slate-800 text-slate-50 font-medium rounded-tr-sm shadow-sm"
                      : "bg-white text-slate-700 rounded-tl-sm border border-slate-200 shadow-sm"
                  )}
                  style={{ wordBreak: 'break-word', overflowWrap: 'break-word', minWidth: 0, maxWidth: '100%' }}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: formatMessageText(message.content) }}
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                  />
                </div>

                <div className={cn(
                  "mt-2.5 flex items-center gap-2.5 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  isOutgoing ? "flex-row-reverse" : ""
                )}>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {senderLabel}
                  </span>
                  <span className="size-1 bg-slate-200 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-300 uppercase">
                    {timeAgo}
                  </span>
                  {isOutgoing && message.sender === 'ai' && (
                    <Badge variant="outline" className="h-3.5 ml-1 px-1.5 py-0 text-[9px] border-primary/30 text-primary-foreground bg-primary/10 uppercase font-black tracking-tighter shadow-none">
                      AUTO-RESPONSE
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}