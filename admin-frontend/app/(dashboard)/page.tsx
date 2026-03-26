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
    <div className="flex flex-col flex-1 h-full w-full bg-slate-50 overflow-y-auto">
      <div className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        
        {/* Header Section */}
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Overview</h1>
          <p className="text-slate-500 mt-2 font-medium">Ringkasan aktivitas bengkel dan performa AI Zoya hari ini.</p>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Stat 1: Total Chat Hari Ini */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 text-slate-500 mb-3">
              <span className="material-symbols-outlined bg-blue-50 text-blue-600 p-2 rounded-lg">forum</span>
              <span className="font-semibold text-sm">Aktif 24 Jam</span>
            </div>
            <div className="text-4xl font-black text-slate-800 tracking-tight">{metrics.activeToday}</div>
            <div className="text-xs font-semibold text-slate-400 mt-2">Dari total {metrics.total} percakapan</div>
          </div>

          {/* Stat 2: Butuh Human Handover */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 text-slate-500 mb-3">
              <span className="material-symbols-outlined bg-red-50 text-red-600 p-2 rounded-lg">support_agent</span>
              <span className="font-semibold text-sm">Human Handover</span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-black text-slate-800 tracking-tight">{metrics.aiHandover}</div>
              <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Urgent</span>
            </div>
            <div className="text-xs font-semibold text-slate-400 mt-2">Menunggu balasan CS/Kuli</div>
          </div>

          {/* Stat 3: AI Status Zoya */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-full -z-0"></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-3 text-slate-500 mb-3">
                <span className="material-symbols-outlined bg-teal-50 text-teal-600 p-2 rounded-lg">smart_toy</span>
                <span className="font-semibold text-sm">Zoya AI Status</span>
              </div>
              <div className="mt-auto">
                <div className="flex items-center gap-2">
                  <div className="size-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.6)]"></div>
                  <span className="text-xl font-black text-slate-800 tracking-tight uppercase">Online & Active</span>
                </div>
                <div className="text-xs font-semibold text-slate-400 mt-2">Semua sistem chat normal</div>
              </div>
            </div>
          </div>

          {/* Stat 4: Unread Messages */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 text-slate-500 mb-3">
              <span className="material-symbols-outlined bg-amber-50 text-amber-600 p-2 rounded-lg">mark_chat_unread</span>
              <span className="font-semibold text-sm">Belum Dibaca</span>
            </div>
            <div className="text-4xl font-black text-slate-800 tracking-tight">{metrics.unread}</div>
            <div className="text-xs font-semibold text-slate-400 mt-2">Pesan butuh perhatian</div>
          </div>
        </div>

        {/* Content Section: Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recent Handover List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 col-span-2 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500 text-xl">priority_high</span>
                Butuh Handover Terkini
              </h2>
              <Link href="/conversations" className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider">Lihat Semua</Link>
            </div>
            <div className="p-0 overflow-y-auto max-h-[400px]">
              {conversations.filter(c => !c.aiState?.enabled).slice(0, 5).map(c => (
                <div key={c.id} className="p-4 border-b border-slate-50 hover:bg-slate-50/80 transition-colors flex items-center gap-4 group">
                  <div className="size-10 bg-slate-200 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {c.profilePicUrl ? (
                      <img src={c.profilePicUrl} alt={c.customerName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-400">person</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="font-bold text-slate-800 text-sm truncate">{c.customerName}</h3>
                      <span className="text-[10px] font-bold text-slate-400">{formatRelativeTime(c.lastMessageTime)}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{c.lastMessage}</p>
                  </div>
                  <Link href={`/conversations?id=${c.id}`}>
                    <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity bg-white">Balas</Button>
                  </Link>
                </div>
              ))}
              {metrics.aiHandover === 0 && (
                <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                  <span className="material-symbols-outlined text-4xl mb-3 opacity-50">done_all</span>
                  <p className="font-medium text-sm">Semua aman! Tidak ada antrian handover.</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Recent Bookings placeholder */}
          <div className="flex flex-col gap-6">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-md p-6 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <span className="material-symbols-outlined text-8xl">bolt</span>
               </div>
               <h3 className="font-bold text-lg mb-4 relative z-10">Pintasan Cepat</h3>
               <div className="space-y-3 relative z-10">
                 <Link href="/conversations">
                   <button className="w-full bg-white/10 hover:bg-white/20 text-white border-none py-3 px-4 rounded-xl font-semibold text-sm flex items-center transition-colors">
                     <span className="material-symbols-outlined mr-3 text-lg">chat</span> Buka Kotak Masuk
                   </button>
                 </Link>
                 <Link href="/bookings">
                   <button className="w-full bg-white/10 hover:bg-white/20 text-white border-none py-3 px-4 rounded-xl font-semibold text-sm flex items-center transition-colors">
                     <span className="material-symbols-outlined mr-3 text-lg">edit_calendar</span> Atur Jadwal Bengkel
                   </button>
                 </Link>
                 <Link href="/follow-ups">
                   <button className="w-full bg-white/10 hover:bg-white/20 text-white border-none py-3 px-4 rounded-xl font-semibold text-sm flex items-center transition-colors">
                     <span className="material-symbols-outlined mr-3 text-lg">campaign</span> Blast Follow-up
                   </button>
                 </Link>
               </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
