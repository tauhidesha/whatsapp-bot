'use client';

import { useState, useMemo } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Image from 'next/image';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  loading?: boolean;
  searchQuery?: string;
}

type FilterStatus = 'all' | 'unread' | 'pending';

// --- KOMPONEN CONVERSATION ITEM (Desktop View) ---
function DesktopConversationItem({ conversation, isActive, onClick }: { conversation: Conversation; isActive: boolean; onClick: () => void; }) {
  const getTimeAgo = () => {
    try {
      if (!conversation.lastMessageTime) return 'Baru';
      const date = new Date(conversation.lastMessageTime);
      if (isNaN(date.getTime())) return 'Baru';
      return format(date, 'HH:mm', { locale: idLocale });
    } catch (error) { return 'Baru'; }
  };

  const isUnread = conversation.unreadCount > 0 && !isActive;

  return (
    <div onClick={onClick} className={cn(
      "p-4 transition-colors group cursor-pointer text-left w-full relative block overflow-hidden min-w-0 hidden md:block",
      isActive ? "bg-surface-container-high border-l-4 border-[#FFFF00]" : "border-b border-white/5 hover:bg-surface-container"
    )}>
      <div className="flex justify-between items-center mb-1 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={cn("font-headline text-sm truncate block", isActive ? "text-white" : "text-zinc-300 group-hover:text-white")}>
            {conversation.customerName || 'Pelanggan'}
          </span>
          {isUnread && <div className="w-2 h-2 rounded-full bg-[#FFFF00] shrink-0"></div>}
        </div>
        <span className="text-[10px] font-technical text-zinc-500 shrink-0 whitespace-nowrap">{getTimeAgo()}</span>
      </div>
      <p className={cn("text-xs font-technical line-clamp-1 break-all mt-0.5", isUnread ? "text-zinc-400 font-bold" : "text-zinc-500")}>
        {conversation.lastMessage || 'Menunggu pesan pertama...'}
      </p>
      <div className="mt-2 flex gap-2 overflow-hidden flex-wrap">
        {conversation.aiState?.enabled ? (
          <span className="px-2 py-0.5 bg-[#FFFF00]/10 text-[#FFFF00] text-[9px] font-technical rounded-sm shrink-0">AI AKTIF</span>
        ) : (
          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[9px] font-technical rounded-sm shrink-0">AI OFF</span>
        )}
        {conversation.label && (
          <span className="px-2 py-0.5 bg-zinc-800 text-zinc-500 text-[9px] font-technical rounded-sm uppercase shrink-0">
            {conversation.label.replace('_', ' ')}
          </span>
        )}
      </div>
    </div>
  );
}

// --- KOMPONEN CONVERSATION ITEM (Mobile View) ---
function MobileConversationItem({ conversation, isActive, onClick }: { conversation: Conversation; isActive: boolean; onClick: () => void; }) {
  const [imageError, setImageError] = useState(false);

  const getTimeAgo = () => {
    try {
      if (!conversation.lastMessageTime) return 'NEW';
      const date = new Date(conversation.lastMessageTime);
      if (isNaN(date.getTime())) return 'NEW';
      return format(date, 'HH:mm', { locale: idLocale });
    } catch (error) { return 'NEW'; }
  };

  return (
    <div onClick={onClick} className={cn(
      "p-4 flex gap-4 cursor-pointer transition-colors mb-3 md:hidden rounded-sm w-full min-w-0 max-w-full overflow-hidden",
      isActive ? "bg-[#1c1b1b] border-l-4 border-[#FFFF00]" : "bg-[#1c1b1b] hover:bg-[#2a2a2a]"
    )}>
      {/* Avatar Section */}
      <div className="relative flex-shrink-0">
        <div className="w-12 h-12 bg-[#2a2a2a] rounded-sm overflow-hidden flex items-center justify-center font-headline font-black text-xl text-zinc-500 shadow-inner">
          {conversation.profilePicUrl && !imageError ? (
            <Image src={conversation.profilePicUrl} alt={conversation.customerName || 'User'} width={48} height={48} className="w-full h-full object-cover grayscale opacity-80" unoptimized onError={() => setImageError(true)} />
          ) : (
            (conversation.customerName || 'U').charAt(0).toUpperCase()
          )}
        </div>
        {isActive && <div className="absolute -bottom-1 -right-1 bg-[#FFFF00] w-3 h-3 rounded-full border-2 border-[#1c1b1b]"></div>}
      </div>

      {/* Content Section - MENGGUNAKAN GRID HACK UNTUK MENCEGAH OVERFLOW */}
      <div className="flex-1 min-w-0 grid grid-cols-1 gap-1">
        <div className="flex justify-between items-start gap-2 min-w-0">
          <h3 className="font-headline font-black text-base text-white truncate uppercase tracking-tight min-w-0">
            {conversation.customerName || 'Pelanggan'}
          </h3>
          <span className="text-[10px] font-medium font-sans text-zinc-500 uppercase whitespace-nowrap pt-0.5 flex-shrink-0">
            {getTimeAgo()}
          </span>
        </div>

        {/* Teks pesan sekarang dijamin terpotong dengan truncate */}
        <p className="text-sm text-zinc-400 font-sans truncate w-full">
          {conversation.lastMessage || 'Belum ada pesan...'}
        </p>

        <div className="flex gap-2 mt-0.5">
          {conversation.aiState?.enabled ? (
            <span className="bg-[#FFFF00]/10 text-[#FFFF00] text-[9px] font-black px-2 py-0.5 border border-[#FFFF00]/20 tracking-widest uppercase">AI AKTIF</span>
          ) : conversation.label === 'booking_process' ? (
            <span className="bg-[#cccc63] text-[#1d1d00] text-[9px] font-black px-2 py-0.5 tracking-widest uppercase">MENUNGGU</span>
          ) : (
            <span className="bg-[#353534] text-zinc-400 text-[9px] font-black px-2 py-0.5 tracking-widest uppercase">
              {conversation.label ? conversation.label.replace('_', ' ') : 'NEW'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function ConversationList({ conversations, selectedId, onSelect, loading = false, searchQuery = '' }: ConversationListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      if (activeFilter === 'unread' && conv.unreadCount === 0) return false;
      if (activeFilter === 'pending' && conv.label !== 'booking_process') return false; 
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        return (
          (conv.customerName || '').toLowerCase().includes(searchLower) ||
          (conv.customerPhone || '').toLowerCase().includes(searchLower) ||
          (conv.lastMessage || '').toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [conversations, searchQuery, activeFilter]);

  return (
    <div className={cn(
      "w-full md:w-[350px] lg:w-96 flex flex-col border-r border-white/5 bg-[#131313] relative z-30 shrink-0 h-full",
      selectedId ? "hidden md:flex" : "flex absolute inset-0 md:relative max-w-full overflow-hidden" 
    )}>
      
      {/* HEADER MOBILE KHUSUS (Nempel di Atas) */}
      <div className="md:hidden px-4 pt-2 mb-4 w-full shrink-0">
        <h2 className="text-4xl font-headline font-black tracking-tighter text-white uppercase mb-4">INBOX</h2>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
           {[ { id: 'all', label: 'ALL CHATS' }, { id: 'unread', label: 'UNREAD' }, { id: 'pending', label: 'AI ACTIVE' } ].map((filter) => (
             <button key={filter.id} onClick={() => setActiveFilter(filter.id as FilterStatus)} className={cn(
               "px-4 py-1.5 text-xs font-bold rounded-sm whitespace-nowrap uppercase tracking-wider font-sans shrink-0",
               activeFilter === filter.id ? "bg-[#FFFF00] text-black" : "bg-[#2a2a2a] text-zinc-400 hover:text-white"
             )}>
               {filter.label}
             </button>
           ))}
        </div>
      </div>

      {/* HEADER DESKTOP KHUSUS */}
      <div className="hidden md:flex p-4 gap-2 overflow-x-auto no-scrollbar shrink-0 bg-surface-container-low border-b border-white/5">
        {[ { id: 'all', label: 'Semua' }, { id: 'unread', label: 'Belum Dibaca' }, { id: 'pending', label: 'Menunggu' } ].map((filter) => (
          <button key={filter.id} onClick={() => setActiveFilter(filter.id as FilterStatus)} className={cn(
            "px-4 py-1.5 text-[10px] font-headline uppercase rounded-full whitespace-nowrap transition-colors",
            activeFilter === filter.id ? "bg-[#FFFF00] text-black" : "bg-surface-container-highest text-zinc-400 hover:text-white"
          )}>
            {filter.label}
          </button>
        ))}
      </div>

      {/* LIST ITEM AREA (Area ini yang bisa di-scroll berkat flex-1 min-h-0) */}
      <div className="flex-1 min-h-0 w-full relative md:bg-surface-container-low max-w-[100vw] md:max-w-none overflow-hidden flex flex-col">
        <ScrollArea className="flex-1 w-full max-w-[100vw] md:max-w-none">
          {/* pb-4 cukup, tidak perlu pb-32 lagi karena footer sudah di luar */}
          <div className="grid grid-cols-1 w-full max-w-[100vw] md:max-w-none px-4 md:px-0 gap-0 overflow-hidden pb-4">
            {loading ? (
               <div className="space-y-4 p-4">
                 {[1,2,3,4].map(i => <div key={i} className="h-24 md:h-20 bg-surface-container border border-white/5 rounded-sm animate-pulse" />)}
               </div>
            ) : filteredConversations.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                 <span className="material-symbols-outlined text-4xl text-zinc-600 mb-4">forum</span>
                 <p className="text-zinc-500 font-headline font-bold text-sm uppercase tracking-widest">Inbox Kosong</p>
               </div>
            ) : (
               <>
                 {filteredConversations.map((conversation) => (
                   // WAJIB ADA w-full max-w-full overflow-hidden
                   <div key={conversation.id} className="w-full max-w-full overflow-hidden block">
                     {/* Render Desktop Version */}
                     <DesktopConversationItem conversation={conversation} isActive={selectedId === conversation.id} onClick={() => onSelect(conversation)} />
                     {/* Render Mobile Version */}
                     <MobileConversationItem conversation={conversation} isActive={selectedId === conversation.id} onClick={() => onSelect(conversation)} />
                   </div>
                 ))}
               </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* FOOTER MOBILE KHUSUS (Fixed/Nempel di Bawah) */}
      {/* Kita keluarkan dari ScrollArea dan kasih shrink-0 agar tidak tertekan */}
      <div className="md:hidden shrink-0 py-6 border-t border-white/5 flex justify-center w-full bg-[#131313] z-10 relative">
        <span className="text-[9px] font-medium font-sans text-zinc-600 tracking-[0.2em] uppercase">POWERED BY ZOYA</span>
      </div>

    </div>
  );
}
