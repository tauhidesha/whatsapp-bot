'use client';

import { useState } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Image from 'next/image';
import CustomerFinanceSummary from './CustomerFinanceSummary';
import ManualBookingForm from '@/components/bookings/ManualBookingForm';
import { ApiClient } from '@/lib/api/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ConversationHeaderProps {
  conversation: Conversation;
  apiClient: ApiClient;
  onAiStateChange: (enabled: boolean, reason?: string) => Promise<void>;
  onLabelChange: (label: string, reason?: string) => Promise<void>;
  onBack?: () => void;
  loading?: boolean;
}

const channelBadges = {
  whatsapp: { label: 'WA', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  instagram: { label: 'IG', className: 'bg-pink-50 text-pink-600 border-pink-100' },
  messenger: { label: 'FB', className: 'bg-blue-50 text-blue-600 border-blue-100' },
};

const CONVERSATION_LABELS = [
  { value: 'hot_lead', label: 'Hot Lead', className: 'bg-red-50 text-red-600 border-red-100' },
  { value: 'cold_lead', label: 'Cold Lead', className: 'bg-blue-50 text-blue-600 border-blue-100' },
  { value: 'booking_process', label: 'Proses Booking', className: 'bg-orange-50 text-orange-600 border-orange-100' },
  { value: 'scheduling', label: 'Penjadwalan', className: 'bg-purple-50 text-purple-600 border-purple-100' },
  { value: 'completed', label: 'Selesai', className: 'bg-green-50 text-green-600 border-green-100' },
  { value: 'follow_up', label: 'Follow-up', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'general', label: 'Umum', className: 'bg-slate-50 text-slate-600 border-slate-100' },
  { value: 'archive', label: 'Arsip', className: 'bg-slate-50 text-slate-400 border-slate-100' },
];

export default function ConversationHeader({
  conversation,
  apiClient,
  onAiStateChange,
  onLabelChange,
  onBack,
  loading = false,
}: ConversationHeaderProps) {
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [showAiPauseInfo, setShowAiPauseInfo] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(conversation.label || '');
  const [labelReason, setLabelReason] = useState('');
  const [isUpdatingLabel, setIsUpdatingLabel] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [imageError, setImageError] = useState(false);

  const channelBadge = channelBadges[conversation.channel as keyof typeof channelBadges] || { 
    label: 'UN', 
    className: 'bg-slate-50 text-slate-600 border-slate-100' 
  };
  
  const aiEnabled = conversation.aiState?.enabled ?? true;
  const aiPausedUntil = conversation.aiState?.pausedUntil;
  const aiPauseReason = conversation.aiState?.reason;
  
  const currentLabel = CONVERSATION_LABELS.find(l => l.value === conversation.label);

  const handleAiToggle = async () => {
    setIsTogglingAi(true);
    try {
      const newState = !aiEnabled;
      const reason = newState ? undefined : 'Manual pause by admin';
      await onAiStateChange(newState, reason);
    } catch (error) {
      console.error('Failed to toggle AI state:', error);
    } finally {
      setIsTogglingAi(false);
    }
  };

  const handleLabelUpdate = async () => {
    if (!selectedLabel) return;
    
    setIsUpdatingLabel(true);
    try {
      await onLabelChange(selectedLabel, labelReason || undefined);
      setShowLabelModal(false);
      setLabelReason('');
    } catch (error) {
      console.error('Failed to update label:', error);
    } finally {
      setIsUpdatingLabel(false);
    }
  };

  const openLabelModal = () => {
    setSelectedLabel(conversation.label || '');
    setLabelReason('');
    setShowLabelModal(true);
  };

  const getAiStatusText = () => {
    if (aiEnabled) return 'AI Aktif';
    if (aiPausedUntil) {
      const timeRemaining = formatDistanceToNow(new Date(aiPausedUntil), { addSuffix: true, locale: idLocale });
      return `Paused ${timeRemaining}`;
    }
    return 'AI Paused';
  };

  return (
    <>
      <div className="h-20 border-b flex items-center justify-between px-4 md:px-8 shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        {/* Left side - Customer info */}
        <div className="flex items-center gap-1.5 md:gap-4 min-w-0">
          {onBack && (
            <button 
              onClick={onBack}
              className="md:hidden size-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 active:scale-95 transition-all mr-1"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          )}
          <div className="relative group">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 shadow-sm transition-transform group-hover:rotate-3 overflow-hidden">
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
            <div className="absolute -bottom-1 -right-1 size-5 bg-white rounded-lg shadow-md border border-slate-50 flex items-center justify-center">
               <Badge variant="outline" className={cn("p-0 size-4 flex items-center justify-center text-[7px] font-black border-none", channelBadge.className)}>
                  {channelBadge.label}
               </Badge>
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="font-black text-[15px] md:text-[18px] text-zinc-900 leading-none tracking-tight truncate max-w-[65px] sm:max-w-[120px] md:max-w-none">
                {conversation.customerName || 'Unknown User'}
              </h3>
              {currentLabel && (
                <button
                  onClick={openLabelModal}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all hover:brightness-95 active:scale-95 shadow-sm",
                    currentLabel.className
                  )}
                >
                  {currentLabel.label}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 md:mt-2">
              <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em] truncate max-w-[90px] md:max-w-none font-mono">
                {conversation.customerPhone || 'NO PHONE ATTACHED'}
              </p>
              <CustomerFinanceSummary customerId={conversation.id} />
            </div>
          </div>
        </div>

        {/* Right side - Controls */}
        <div className="flex items-center gap-1.5 md:gap-4 shrink-0">
          {/* Label selector button */}
          <button
            onClick={openLabelModal}
            className="flex items-center gap-1.5 px-2.5 md:px-4 py-2.5 rounded-xl text-[12px] font-black bg-slate-50 text-slate-600 hover:bg-slate-100/80 hover:text-zinc-900 transition-all active:scale-95 border border-slate-100 shadow-sm shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">settings_ethernet</span>
            <span className="hidden md:inline">LABEL DATA</span>
          </button>

          {/* Booking Button */}
          <button
            onClick={() => setShowBookingModal(true)}
            className="flex items-center gap-1.5 px-2.5 md:px-4 py-2.5 rounded-xl text-[12px] font-black bg-primary text-zinc-900 hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-primary/20 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
            <span className="hidden md:inline">BUAT BOOKING</span>
          </button>

          {/* AI Control Center */}
          <div className="flex items-center bg-slate-50/80 p-1.5 rounded-2xl gap-2 shadow-sm border border-slate-100">
            <button
              onClick={() => setShowAiPauseInfo(!showAiPauseInfo)}
              className={cn(
                "flex items-center gap-1 md:gap-2 px-2.5 md:px-4 py-2 rounded-xl text-[12px] font-bold transition-all shrink-0",
                aiEnabled
                  ? "bg-teal-500 text-white shadow-md shadow-teal-500/20"
                  : "bg-amber-500 text-white shadow-md shadow-amber-500/20"
              )}
            >
              <span className="material-symbols-outlined text-[18px]">
                {aiEnabled ? 'smart_toy' : 'pause_presentation'}
              </span>
              <span className="hidden md:inline">{getAiStatusText().toUpperCase()}</span>
            </button>

            <button
              onClick={handleAiToggle}
              disabled={isTogglingAi || loading}
              className={cn(
                "h-9 w-9 bg-white rounded-xl flex items-center justify-center transition-all shadow-sm border border-slate-100 hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0",
                aiEnabled ? "text-slate-400 hover:text-red-500" : "text-teal-500"
              )}
            >
              {isTogglingAi ? (
                <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[20px]">
                  {aiEnabled ? 'emergency_home' : 'bolt'}
                </span>
              )}
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-10 w-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-zinc-900 hover:bg-slate-50 transition-all outline-none">
                <span className="material-symbols-outlined text-[24px]">more_horiz</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-2xl border-slate-100 animate-in zoom-in-95 duration-200">
              <DropdownMenuItem className="p-3 rounded-xl cursor-not-allowed opacity-50 text-[12px] font-bold">
                <span className="material-symbols-outlined text-[18px] mr-3">archive</span>
                ARKIP CHAT
              </DropdownMenuItem>
              <DropdownMenuItem className="p-3 rounded-xl text-red-500 hover:bg-red-50 focus:bg-red-50 text-[12px] font-bold cursor-pointer">
                <span className="material-symbols-outlined text-[18px] mr-3">delete_sweep</span>
                HAPUS PERMANEN
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Label Update Modal */}
      <Modal
        isOpen={showLabelModal}
        onClose={() => setShowLabelModal(false)}
        title="Klasifikasi Percakapan"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedLabel('')}
              className={cn(
                "p-4 rounded-2xl border-2 text-[13px] font-black transition-all flex items-center gap-3",
                selectedLabel === '' ? "bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-900/20" : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
              )}
            >
              <span className="material-symbols-outlined text-[20px]">block</span>
              No Label
            </button>
            {CONVERSATION_LABELS.map((label) => (
              <button
                key={label.value}
                onClick={() => setSelectedLabel(label.value)}
                className={cn(
                  "p-4 rounded-2xl border-2 text-[13px] font-black transition-all flex items-center gap-3",
                  selectedLabel === label.value ? "bg-primary border-primary text-zinc-900 shadow-xl shadow-primary/20" : "bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100"
                )}
              >
                <div className={cn("size-2 rounded-full", label.className.split(' ')[0].replace('bg-', 'bg-'))} />
                {label.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">
              Catatan Internal
            </label>
            <textarea
              value={labelReason}
              onChange={(e) => setLabelReason(e.target.value)}
              placeholder="Berikan alasan perubahan status..."
              className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-[13px] font-medium focus:ring-4 focus:ring-primary/10 outline-none resize-none transition-all placeholder:text-slate-300"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => setShowLabelModal(false)}
              variant="secondary"
              disabled={isUpdatingLabel}
              className="flex-1 font-black h-14 rounded-2xl bg-slate-50 border-none text-slate-400 hover:text-slate-600"
            >
              BATAL
            </Button>
            <Button
              onClick={handleLabelUpdate}
              variant="primary"
              isLoading={isUpdatingLabel}
              disabled={selectedLabel === conversation.label && !labelReason}
              className="flex-[2] font-black h-14 rounded-2xl shadow-2xl shadow-primary/30"
            >
              SIMPAN STATUS
            </Button>
          </div>
        </div>
      </Modal>

      {/* Manual Booking Modal */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        title="Buat Booking Manual"
        size="lg"
      >
        <ManualBookingForm
          initialData={{
            customerName: conversation.customerName,
            customerPhone: conversation.customerPhone,
          }}
          apiClient={apiClient}
          onSuccess={() => {
            setShowBookingModal(false);
            alert('Booking berhasil dibuat!');
          }}
          onCancel={() => setShowBookingModal(false)}
        />
      </Modal>

      {/* AI Pause Info Overlay */}
      {showAiPauseInfo && !aiEnabled && (
        <div 
          className="fixed inset-0 z-[100] bg-zinc-900/5 backdrop-blur-[2px]" 
          onClick={() => setShowAiPauseInfo(false)}
        >
          <div className="absolute right-12 top-24 bg-white border border-slate-100 rounded-[24px] shadow-2xl p-6 w-80 z-[101] animate-in zoom-in-95 duration-300 border-none">
            <div className="flex items-center gap-3 mb-5">
              <div className="size-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <span className="material-symbols-outlined text-[22px] text-white">timer_pause</span>
              </div>
              <div>
                <p className="text-xs font-black text-zinc-950 uppercase tracking-wider">AI Insight</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Kondisi Jeda Saat Ini</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {aiPausedUntil && (
                <div className="bg-slate-50/50 p-4 rounded-[18px] border border-slate-100/50">
                  <p className="text-[9px] text-slate-400 font-black uppercase mb-1.5 tracking-tighter">ESTIMASI KEMBALI AKTIF</p>
                  <p className="text-sm text-zinc-900 font-black">{new Date(aiPausedUntil).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</p>
                </div>
              )}
              {aiPauseReason && (
                <div className="bg-slate-50/50 p-4 rounded-[18px] border border-slate-100/50">
                  <p className="text-[9px] text-slate-400 font-black uppercase mb-1.5 tracking-tighter">ALASAN PENANGGUHAN</p>
                  <p className="text-xs text-slate-600 font-bold leading-relaxed">&quot;{aiPauseReason}&quot;</p>
                </div>
              )}
              {!aiPausedUntil && !aiPauseReason && (
                <p className="text-xs text-slate-500 italic text-center py-4 font-medium">Monitoring AI berjalan secara manual.</p>
              )}
            </div>
            
            <button className="w-full mt-6 py-3 rounded-xl bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all">
               TUTUP INFO
            </button>
          </div>
        </div>
      )}
    </>
  );
}
