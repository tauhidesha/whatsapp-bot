'use client';

import { useState, useCallback, useMemo } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import ConversationItem from './ConversationItem';
import Input from '@/components/shared/Input';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  loading?: boolean;
}

const LABELS = [
  { value: '', label: 'Semua Status' },
  { value: 'hot_lead', label: 'Hot Lead' },
  { value: 'cold_lead', label: 'Cold Lead' },
  { value: 'booking_process', label: 'Proses Booking' },
  { value: 'scheduling', label: 'Penjadwalan' },
  { value: 'completed', label: 'Selesai' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'general', label: 'Umum' },
  { value: 'archive', label: 'Arsip' },
];

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  loading = false,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    const timeoutId = setTimeout(() => setDebouncedSearch(value.toLowerCase()), 300);
    return () => clearTimeout(timeoutId);
  }, []);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      if (selectedLabel && conv.label !== selectedLabel) return false;
      if (debouncedSearch) {
        const searchLower = debouncedSearch;
        return (
          (conv.customerName || '').toLowerCase().includes(searchLower) ||
          (conv.customerPhone || '').toLowerCase().includes(searchLower) ||
          (conv.lastMessage || '').toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [conversations, selectedLabel, debouncedSearch]);

  return (
    <div className="w-full md:w-[350px] lg:w-[400px] border-r border-slate-100 flex flex-col h-full bg-white relative z-10 shrink-0 overflow-hidden">
      {/* Header Section */}
      <div className="p-6 space-y-4 shrink-0 overflow-hidden">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-zinc-950 tracking-tight">Inbox</h2>
            <div className="size-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-zinc-600 transition-colors cursor-pointer">
               <span className="material-symbols-outlined text-[22px]">tune</span>
            </div>
        </div>

        <div className="space-y-3 w-full overflow-hidden">
            <Input
              placeholder="Cari chat atau pesan..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              leftIcon={<span className="material-symbols-outlined text-[20px] text-slate-300">search</span>}
              className="bg-slate-50 border-none h-12 rounded-2xl focus-visible:ring-primary/20 placeholder:text-slate-400 font-medium w-full"
            />

            <div className="relative group w-full">
              <select
                value={selectedLabel}
                onChange={(e) => setSelectedLabel(e.target.value)}
                className="w-full pl-5 pr-10 h-11 text-[11px] font-black uppercase tracking-widest bg-slate-50 border-none rounded-xl focus:ring-0 appearance-none cursor-pointer text-slate-500 outline-none hover:bg-slate-100 transition-all"
              >
                {LABELS.map((label) => (
                  <option key={label.value} value={label.value}>
                    {label.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-[20px] group-hover:translate-y-0.5 transition-transform">expand_more</span>
              </div>
            </div>
        </div>
      </div>

      {/* Conversation List Section */}
      <div className="flex-1 min-h-0 w-full overflow-hidden relative">
        <ScrollArea className="h-full w-full">
            <div className="flex flex-col px-3 pb-8 gap-1 items-stretch w-full max-w-full overflow-hidden">
            {loading ? (
                <div className="space-y-4 p-2">
                {[1,2,3,4,5].map(i => (
                    <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse" />
                ))}
                </div>
            ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                    <div className="size-20 bg-slate-50 rounded-[28px] flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-4xl text-slate-200">forum</span>
                    </div>
                    <p className="text-zinc-400 font-black text-sm uppercase tracking-widest">Inbox Kosong</p>
                    <button 
                    onClick={() => {setSearchQuery(''); setSelectedLabel(''); setDebouncedSearch('');}}
                    className="text-[10px] text-primary font-black mt-4 hover:underline tracking-widest uppercase"
                    >
                    Daftar Ulang Filter
                    </button>
                </div>
            ) : (
                filteredConversations.map((conversation) => (
                    <ConversationItem
                        key={conversation.id}
                        conversation={conversation}
                        isActive={selectedId === conversation.id}
                        onClick={() => onSelect(conversation)}
                    />
                ))
            )}
            </div>
        </ScrollArea>
      </div>
    </div>
  );
}
