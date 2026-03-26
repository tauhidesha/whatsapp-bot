'use client';

import { useState } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import { formatDistanceToNow } from 'date-fns';
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
    className: 'bg-slate-50 text-slate-600 border-slate-100' 
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
  const aiPaused = conversation.aiState && !conversation.aiState.enabled;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group grid grid-cols-[48px_1fr] gap-4 p-4 cursor-pointer transition-all duration-200 rounded-2xl relative mb-1 mx-1 border overflow-hidden",
        isActive
          ? "bg-white border-zinc-900 shadow-lg ring-1 ring-zinc-900 z-10"
          : "bg-transparent border-transparent hover:bg-slate-50"
      )}
    >
      {/* Avatar Section */}
      <div className="flex-shrink-0">
        <div className={cn(
          "w-12 h-12 rounded-[16px] flex items-center justify-center font-bold text-sm bg-slate-100 text-slate-400 group-hover:bg-slate-200 transition-all overflow-hidden"
        )}>
          {conversation.profilePicUrl && !imageError ? (
            <Image 
              src={conversation.profilePicUrl} 
              alt={conversation.customerName} 
              width={48}
              height={48}
              className="w-full h-full object-cover"
              unoptimized
              onError={() => setImageError(true)}
            />
          ) : (
            (conversation.customerName || 'U').charAt(0).toUpperCase()
          )}
        </div>
      </div>

      {/* Info Section - Use min-w-0 to ensure grid content respects parent width */}
      <div className="min-w-0 py-0.5">
        <div className="flex justify-between items-center gap-2 mb-1.5 w-full overflow-hidden">
          <h3 className={cn(
            "font-black text-[15.5px] truncate transition-colors leading-none tracking-tight",
            isActive ? "text-zinc-950" : "text-zinc-800"
          )}>
            {conversation.customerName || 'Pelanggan'}
          </h3>
          <span className="text-[10px] uppercase font-bold shrink-0 tracking-wider text-slate-400">
            {timeAgo}
          </span>
        </div>

        {/* Last message preview - Grid handles this much better with truncate */}
        <p className={cn(
          "text-[13.5px] truncate mb-2.5 leading-tight text-slate-500",
          isActive ? "text-zinc-500 font-medium" : "font-normal"
        )}>
          {conversation.lastMessage || 'Menunggu pesan pertama...'}
        </p>

        {/* Badges Container */}
        <div className="flex items-center gap-2 overflow-hidden w-full">
          <Badge variant="outline" className={cn(
            "px-2 py-0 h-4 text-[8px] font-black uppercase border-none flex-shrink-0", 
            channelBadge.className
          )}>
            {channelBadge.label}
          </Badge>

          {aiPaused && (
            <Badge variant="outline" className="px-2 py-0 h-4 text-[8px] font-black uppercase bg-amber-50 text-amber-600 border-none flex-shrink-0">
              AI OFF
            </Badge>
          )}

          {conversation.label && (
            <div className="px-2 py-0 h-4 text-[8px] font-black uppercase text-slate-400 bg-slate-50 rounded flex items-center truncate min-w-0 flex-1">
              {conversation.label.replace('_', ' ')}
            </div>
          )}
        </div>
      </div>

      {/* Unread indicator */}
      {conversation.unreadCount > 0 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 size-2.5 bg-zinc-900 rounded-full shadow-lg" />
      )}
    </div>
  );
}
