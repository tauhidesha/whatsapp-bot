'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Message } from '@/lib/hooks/useConversationMessages';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { useLayout } from '@/context/LayoutContext';

interface MessageListProps {
  messages: Message[];
  loading?: boolean;
  customerName?: string;
  profilePic?: string | null;
}

export default function MessageList({
  messages,
  loading = false,
  customerName,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const { setIsHeaderVisible } = useLayout();

  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    setScrollEl(node || null);
  }, []);

  useEffect(() => {
    setIsHeaderVisible(true);
  }, [setIsHeaderVisible]);

  useEffect(() => {
    if (!scrollEl) return;
    const timeout = setTimeout(() => {
      scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(timeout);
  }, [scrollEl, messages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 w-full bg-[#131313]">
        <div className="size-10 border-4 border-[#FFFF00]/20 border-t-[#FFFF00] rounded-full animate-spin" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 w-full bg-[#131313]">
        <div className="text-center p-8 max-w-xs relative z-10">
          <div className="size-24 bg-[#1C1B1B] border border-white/5 rounded-[40px] flex items-center justify-center mx-auto shadow-2xl mb-8">
            <span className="material-symbols-outlined text-6xl text-slate-700">forum</span>
          </div>
          <h4 className="text-white font-headline font-black text-lg mb-2 uppercase tracking-widest">
            Sistem Ready
          </h4>
          <p className="text-[10px] text-slate-500 leading-relaxed font-black uppercase tracking-widest font-sans">
            Menunggu transmisi data pertama dari pelanggan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setScrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 flex flex-col gap-6 no-scrollbar bg-[#131313] relative custom-scrollbar"
    >
      {/* Date Divider */}
      <div className="flex justify-center">
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold font-sans">
          TODAY • {format(new Date(), 'hh:mm a', { locale: idLocale }).toUpperCase()}
        </span>
      </div>

      {messages.map((message) => {
        const isSelf = message.sender === 'admin';
        const isAI = message.sender === 'ai';
        const isOutgoing = isSelf || isAI;
        const formattedTime = format(
          new Date(message.timestamp),
          'hh:mm a',
          { locale: idLocale }
        ).toUpperCase();

        const isImage =
          message.content.includes('http') &&
          (message.content.includes('.jpg') || message.content.includes('.png'));

        return (
          <div
            key={message.id}
            className={cn(
              'flex flex-col max-w-[85%] group',
              isOutgoing ? 'items-end self-end' : 'items-start self-start'
            )}
          >
            {/* Sender label + timestamp */}
            <div
              className={cn(
                'flex items-center gap-2 mb-1',
                isOutgoing ? 'mr-1 flex-row' : 'ml-1 flex-row'
              )}
            >
              {isOutgoing ? (
                <>
                  <span className="text-[10px] text-zinc-500 font-sans">{formattedTime}</span>
                  <span
                    className={cn(
                      'w-1 h-1 rounded-full',
                      isAI ? 'bg-[#FFFF00]' : 'bg-zinc-500'
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider font-sans',
                      isAI ? 'text-[#FFFF00]' : 'text-zinc-400'
                    )}
                  >
                    {isAI ? 'ZOYA AI' : 'ADMIN OPS'}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider font-sans">
                    {customerName || 'Customer'}
                  </span>
                  <span className="w-1 h-1 bg-zinc-600 rounded-full" />
                  <span className="text-[10px] text-zinc-500 font-sans">{formattedTime}</span>
                </>
              )}
            </div>

            {/* Bubble */}
            {isImage ? (
              <div className="bg-[#1c1b1b] p-1 rounded-xl border border-white/5 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.content}
                  alt="Attachment"
                  className="w-full aspect-square object-cover rounded-lg grayscale hover:grayscale-0 transition-all duration-500"
                />
              </div>
            ) : (
              <div
                className={cn(
                  'p-4 text-sm font-sans leading-relaxed whitespace-pre-wrap',
                  isOutgoing
                    ? isAI
                      ? 'bg-[#FFFF00] text-[#1d1d00] rounded-tl-xl rounded-bl-xl rounded-br-xl font-semibold shadow-[0_8px_24px_rgba(234,234,0,0.15)]'
                      : 'bg-[#2a2a2a] text-[#e5e2e1] rounded-tl-xl rounded-bl-xl rounded-br-xl border border-white/5'
                    : 'bg-[#2a2a2a] text-[#e5e2e1] rounded-tr-xl rounded-br-xl rounded-bl-xl border-l-2 border-zinc-600/30'
                )}
              >
                {message.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}