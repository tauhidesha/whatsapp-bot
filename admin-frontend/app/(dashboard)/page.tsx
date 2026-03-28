'use client';

import React, { useMemo } from 'react';
import { useRealtimeConversations } from '@/lib/hooks/useRealtimeConversations';
import { formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import Button from '@/components/shared/Button';

export default function DashboardPage() {
  const { conversations, loading } = useRealtimeConversations();

  // Metrics calculation
  const metrics = useMemo(() => {
    if (!conversations.length) return { total: 0, unread: 0, aiHandover: 0, activeToday: 0 };
    
    const now = Date.now();
    let unread = 0;
    let aiHandover = 0;
    let activeToday = 0;

    conversations.forEach(c => {
      unread += c.unreadCount || 0;
      if (!c.aiState?.enabled) {
        aiHandover++;
      }
      
      // Active in last 24h
      if (now - c.lastMessageTime < 24 * 60 * 60 * 1000) {
        activeToday++;
      }
    });

    return { total: conversations.length, unread, aiHandover, activeToday };
  }, [conversations]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full w-full bg-background animate-in fade-in duration-700">
      
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {/* Stat 1: Aktif 24 Jam */}
        <div className="glass-panel p-6 rounded-sm border border-[#1C1B1B] flex flex-col relative group overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-500">
            <span className="material-symbols-outlined text-8xl">forum</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500 mb-4">
            <span className="material-symbols-outlined text-[#FFFF00] text-sm font-light">forum</span>
            <span className="font-label text-[10px] font-bold uppercase tracking-widest leading-none">AKTIF 24 JAM</span>
          </div>
          <div className="text-5xl font-headline font-black text-white tracking-tighter leading-none">{metrics.activeToday}</div>
          <div className="text-[9px] font-label font-bold text-slate-500 uppercase tracking-widest mt-4">Total percakapan: {metrics.total}</div>
        </div>

        {/* Stat 2: Human Handover */}
        <div className="glass-panel p-6 rounded-sm border border-[#1C1B1B] flex flex-col relative group overflow-hidden ring-1 ring-error/20">
          <div className="absolute -right-4 -top-4 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-500">
            <span className="material-symbols-outlined text-8xl">support_agent</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500 mb-4">
            <span className="material-symbols-outlined text-error text-sm font-light">support_agent</span>
            <span className="font-label text-[10px] font-bold uppercase tracking-widest leading-none">HUMAN HANDOVER</span>
          </div>
          <div className="flex items-baseline gap-4">
            <div className="text-5xl font-headline font-black text-white tracking-tighter leading-none">{metrics.aiHandover}</div>
          </div>
          <div className="mt-4 flex">
            <span className="bg-error/10 text-error text-[8px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider border border-error/20">URGENT ACTION REQUIRED</span>
          </div>
        </div>

        {/* Stat 3: Zoya AI Status */}
        <div className="glass-panel p-6 rounded-sm border border-[#1C1B1B] flex flex-col relative group overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-500">
            <span className="material-symbols-outlined text-8xl">smart_toy</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500 mb-4">
            <span className="material-symbols-outlined text-[#FFFF00] text-sm font-light">smart_toy</span>
            <span className="font-label text-[10px] font-bold uppercase tracking-widest leading-none">ZOYA AI SYSTEM</span>
          </div>
          <div className="mt-auto">
            <div className="flex items-center gap-2">
              <div className="size-2 bg-[#FFFF00] rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,0,0.6)]"></div>
              <span className="text-xl font-headline font-black text-white tracking-widest uppercase">STABLE</span>
            </div>
            <div className="text-[9px] font-label font-bold text-slate-500 uppercase tracking-widest mt-3">SISTEM CHAT NORMAL</div>
          </div>
        </div>

        {/* Stat 4: Unread Messages */}
        <div className="glass-panel p-6 rounded-sm border border-[#1C1B1B] flex flex-col relative group overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-500">
            <span className="material-symbols-outlined text-8xl">mark_chat_unread</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500 mb-4">
            <span className="material-symbols-outlined text-[#FFFF00] text-sm font-light">mark_chat_unread</span>
            <span className="font-label text-[10px] font-bold uppercase tracking-widest leading-none">UNREAD MESSAGES</span>
          </div>
          <div className="text-5xl font-headline font-black text-white tracking-tighter leading-none">{metrics.unread}</div>
          <div className="text-[9px] font-label font-bold text-slate-500 uppercase tracking-widest mt-4">BUTUH PERHATIAN SEGERA</div>
        </div>
      </div>

      {/* Content Section: Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Recent Handover List */}
        <div className="glass-panel rounded-sm border border-[#1C1B1B] lg:col-span-2 overflow-hidden flex flex-col min-h-[500px]">
          <div className="p-6 border-b border-[#1C1B1B] flex items-center justify-between bg-surface-container/50">
            <h2 className="font-headline text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-error text-lg">priority_high</span>
              Butuh Handover Terkini
            </h2>
            <Link href="/conversations" className="text-[9px] font-bold text-[#FFFF00] hover:text-white uppercase tracking-widest transition-colors border border-[#FFFF00]/20 px-3 py-1 rounded-sm">Lihat Semua</Link>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {conversations.filter(c => !c.aiState?.enabled).slice(0, 5).map(c => (
              <div key={c.id} className="p-6 border-b border-[#1C1B1B]/50 hover:bg-[#1C1B1B]/30 transition-all flex items-center gap-5 group">
                <div className="size-12 rounded-sm border border-[#1C1B1B] flex-shrink-0 flex items-center justify-center overflow-hidden bg-black shadow-inner">
                  {c.profilePicUrl ? (
                    <img src={c.profilePicUrl} alt={c.customerName} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                  ) : (
                    <span className="material-symbols-outlined text-slate-700">person</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-headline font-bold text-white text-sm uppercase tracking-wider truncate group-hover:text-[#FFFF00] transition-colors">{c.customerName}</h3>
                    <span className="text-[9px] font-label font-bold text-slate-500 uppercase tracking-widest">{formatRelativeTime(c.lastMessageTime)}</span>
                  </div>
                  <p className="text-xs font-body text-slate-400 truncate tracking-tight">{c.lastMessage}</p>
                </div>
                <Link href={`/conversations?id=${c.id}`}>
                  <button className="bg-transparent border border-[#1C1B1B] hover:border-[#FFFF00] hover:text-[#FFFF00] text-slate-500 px-4 py-2 rounded-sm text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 group-hover:shadow-[0_0_15px_rgba(255,255,0,0.1)]">
                    BALAS
                  </button>
                </Link>
              </div>
            ))}
            {metrics.aiHandover === 0 && (
              <div className="flex flex-col items-center justify-center p-20 text-slate-700">
                <span className="material-symbols-outlined text-6xl mb-6 opacity-20">verified</span>
                <p className="font-headline font-bold text-xs uppercase tracking-[0.3em]">SEMUA AMAN TERKENDALI</p>
                <p className="font-label text-[10px] mt-2 opacity-50 uppercase tracking-widest">Tidak ada antrian human handover</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col gap-8">
          <div className="glass-panel rounded-sm border border-[#1C1B1B] p-8 relative overflow-hidden flex flex-col h-full bg-gradient-to-b from-surface-container to-black">
             <div className="absolute -right-10 -top-10 opacity-[0.05]">
               <span className="material-symbols-outlined text-[15rem]">bolt</span>
             </div>
             
             <div className="flex items-center gap-3 mb-8">
               <span className="material-symbols-outlined text-[#FFFF00] text-xl">bolt</span>
               <h3 className="font-headline font-black text-white text-sm uppercase tracking-widest relative z-10">Pintasan Cepat</h3>
             </div>

             <div className="space-y-4 relative z-10 flex-1">
               <Link href="/conversations" className="block">
                 <button className="w-full bg-transparent hover:bg-[#FFFF00] text-[#FFFF00] hover:text-[#1D1D00] border border-[#1C1B1B] hover:border-[#FFFF00] p-5 rounded-sm font-headline font-bold text-xs uppercase tracking-[0.2em] flex items-center transition-all group active:scale-[0.98]">
                   <span className="material-symbols-outlined mr-4 text-lg">chat</span> Buka Kotak Masuk
                   <span className="material-symbols-outlined ml-auto text-sm opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward_ios</span>
                 </button>
               </Link>
               <Link href="/bookings" className="block">
                 <button className="w-full bg-transparent hover:bg-[#FFFF00] text-[#FFFF00] hover:text-[#1D1D00] border border-[#1C1B1B] hover:border-[#FFFF00] p-5 rounded-sm font-headline font-bold text-xs uppercase tracking-[0.2em] flex items-center transition-all group active:scale-[0.98]">
                   <span className="material-symbols-outlined mr-4 text-lg">edit_calendar</span> Atur Jadwal Bengkel
                   <span className="material-symbols-outlined ml-auto text-sm opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward_ios</span>
                 </button>
               </Link>
               <Link href="/follow-ups" className="block">
                 <button className="w-full bg-transparent hover:bg-[#FFFF00] text-[#FFFF00] hover:text-[#1D1D00] border border-[#1C1B1B] hover:border-[#FFFF00] p-5 rounded-sm font-headline font-bold text-xs uppercase tracking-[0.2em] flex items-center transition-all group active:scale-[0.98]">
                   <span className="material-symbols-outlined mr-4 text-lg">campaign</span> Blast Follow-up
                   <span className="material-symbols-outlined ml-auto text-sm opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward_ios</span>
                 </button>
               </Link>
             </div>

             <div className="mt-8 pt-6 border-t border-[#1C1B1B]">
                <p className="font-label text-[9px] text-slate-500 uppercase tracking-widest leading-relaxed">
                  Gunakan pintasan untuk akses cepat ke fitur utama dashboard. Performa sistem saat ini optimal.
                </p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
