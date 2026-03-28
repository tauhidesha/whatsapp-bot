'use client';

import { useState } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import { formatDistanceToNow, format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from 'next/image';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

const channelBadges = {
  whatsapp: { label: 'WA', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  instagram: { label: 'IG', className: 'bg-pink-50 text-pink-600 border-pink-100' },
  messenger: { label: 'FB', className: 'bg-blue-50 text-blue-600 border-blue-100' },
};

export default function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps) {
  const [imageError, setImageError] = useState(false);
  const channelBadge = channelBadges[conversation.channel as keyof typeof channelBadges] || { 
    label: 'UN', 
    className: 'bg-[#262626] text-slate-400 border-white/5' 
  };
  
  const getTimeAgo = () => {
    try {
      if (!conversation.lastMessageTime) return 'Baru';
      const date = new Date(conversation.lastMessageTime);
      if (isNaN(date.getTime())) return 'Baru';
      return formatDistanceToNow(date, { addSuffix: false, locale: idLocale });
    } catch (error) {
      return 'Baru';
    }
  };

  const timeAgo = getTimeAgo();
  const aiActive = conversation.aiState && conversation.aiState.enabled;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 border-b border-white/5 transition-all relative group overflow-hidden",
        isActive 
          ? "bg-[#1C1B1B]" 
          : "bg-[#131313] hover:bg-[#1C1B1B]/50"
      )}
    >
      <div className="flex justify-between items-start gap-2 mb-1 w-full overflow-hidden">
        <h3 className={cn(
          "font-headline font-black text-[14px] truncate transition-colors leading-none tracking-widest uppercase",
          isActive ? "text-[#FFFF00]" : "text-white"
        )}>
          {conversation.customerName || 'Pelanggan'}
        </h3>
        <span className="text-[10px] font-medium shrink-0 text-slate-500 font-sans">
          {timeAgo === 'Baru' ? 'Baru' : format(new Date(conversation.lastMessageTime || Date.now()), 'HH:mm', { locale: idLocale })}
        </span>
      </div>

      {/* Last message preview */}
      <p className={cn(
        "text-[12px] truncate mb-3 leading-tight font-sans tracking-wide",
        isActive ? "text-white/90" : "text-slate-500"
      )}>
        {conversation.lastMessage || 'Menunggu pesan pertama...'}
      </p>

      {/* Badges Container */}
      <div className="flex items-center gap-2 overflow-hidden w-full">
        {aiActive ? (
          <div className="px-1.5 py-0.5 text-[8px] font-black uppercase bg-[#FFFF00] text-[#131313] tracking-widest leading-none">
            AI AKTIF
          </div>
        ) : (
          <div className="px-1.5 py-0.5 text-[8px] font-black uppercase bg-[#262626] text-slate-500 border border-white/5 tracking-widest leading-none">
            AI OFF
          </div>
        )}

        {conversation.label && (
          <div className="px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-300 bg-[#262626] border border-white/5 tracking-widest leading-none">
            {conversation.label.replace('_', ' ')}
          </div>
        )}

        {conversation.unreadCount > 0 && !isActive && (
          <div className="px-1.5 py-0.5 text-[8px] font-black uppercase bg-[#FFFF00] text-[#131313] tracking-widest leading-none">
            NEW
          </div>
        )}
      </div>
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FFFF00]" />
      )}
    </button>
  );
}
