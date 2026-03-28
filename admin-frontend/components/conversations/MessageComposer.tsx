'use client';

import { useState, useRef, useEffect } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import { cn } from "@/lib/utils";

interface MessageComposerProps {
  conversation: Conversation;
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
}

export default function MessageComposer({ onSend, disabled = false }: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="shrink-0 bg-[#131313]/90 backdrop-blur-md border-t border-[#FFFF00]/20 px-4 py-4">
      {/* Input Row */}
      <div className="flex items-center gap-3 bg-[#0e0e0e] rounded-xl p-2 border border-white/5 focus-within:border-[#FFFF00]/20 transition-colors">
        {/* Attach */}
        <button
          className="p-2 text-zinc-500 hover:text-[#FFFF00] transition-colors shrink-0"
          aria-label="Attach file"
        >
          <span className="material-symbols-outlined text-[22px]">attach_file</span>
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          className="flex-1 bg-transparent border-none text-sm py-2 resize-none focus:ring-0 focus-visible:outline-none font-body placeholder:text-zinc-600 text-on-surface leading-relaxed"
          placeholder="Ketik pesan..."
          rows={1}
        />

        {/* Emoji */}
        <button
          className="p-2 text-zinc-500 hover:text-[#FFFF00] transition-colors shrink-0"
          aria-label="Emoji"
        >
          <span className="material-symbols-outlined text-[22px]">sentiment_satisfied</span>
        </button>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled || isLoading}
          aria-label="Send message"
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-lg transition-all shrink-0",
            !message.trim() || disabled || isLoading
              ? "bg-zinc-800 text-zinc-600"
              : "bg-[#FFFF00] text-black active:scale-90 shadow-[0_4px_12px_rgba(255,255,0,0.25)]"
          )}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              send
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
