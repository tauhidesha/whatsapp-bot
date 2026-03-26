'use client';

import { useState, useRef, useEffect } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import Button from '@/components/shared/Button';
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MessageComposerProps {
  conversation: Conversation;
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
}

export default function MessageComposer({
  conversation,
  onSend,
  disabled = false,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [message]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    try {
      await onSend(message);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-2 md:p-6 bg-white/90 backdrop-blur-md border-t border-slate-100 z-20 w-full">
      <div className="max-w-4xl mx-auto w-full">
        {/* PERUBAHAN: Menggabungkan indikator dan input ke dalam satu container dengan border */}
        <div className="relative flex flex-col items-stretch bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all">
          
          {/* Bagian Header Kecil di dalam Input Box */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
            <div className="flex items-center gap-2">
               <div className="size-1.5 bg-teal-500 rounded-full animate-pulse shadow-sm shadow-teal-500/50" />
               <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Saluran Aktif</span>
            </div>
            <span className="text-[10px] font-medium text-slate-400 hidden md:block uppercase tracking-tight">Shift + Enter untuk baris baru</span>
          </div>

          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesan balasan di sini..."
              disabled={disabled || isLoading}
              // PERUBAHAN: Menghilangkan border dan ring bawaan karena sudah ditangani container parent
              className={cn(
                "min-h-[80px] p-4 pr-16 resize-none border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-b-2xl transition-all text-[15px] font-medium placeholder:text-slate-400",
                (disabled || isLoading) && "opacity-50"
              )}
              style={{ maxHeight: '160px' }}
            />
            
            <div className="absolute right-2 bottom-2">
              <Button
                onClick={handleSend}
                disabled={!message.trim() || disabled || isLoading}
                isLoading={isLoading}
                // PERUBAHAN: Pastikan Button ini memiliki background warna primary/brand Mas di file Button.tsx
                className="rounded-xl h-10 w-10 p-0 flex items-center justify-center bg-teal-500 text-white shadow-md shadow-teal-500/30 hover:bg-teal-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all border-none"
              >
                <span className="material-symbols-outlined text-[20px] ml-0.5">
                  send
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
