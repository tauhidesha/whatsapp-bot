'use client';

import { useState } from 'react';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import { cn } from "@/lib/utils";
import Image from 'next/image';
import ManualBookingForm from '@/components/bookings/ManualBookingForm';
import { ApiClient } from '@/lib/api/client';

interface ConversationHeaderProps {
  conversation: Conversation;
  apiClient: ApiClient;
  allConversations: Conversation[];
  onAiStateChange: (enabled: boolean, reason?: string) => Promise<void>;
  onLabelChange: (label: string, reason?: string) => Promise<void>;
  onBack?: () => void;
  loading?: boolean;
}

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
  allConversations,
  onAiStateChange,
  onLabelChange,
  onBack,
  loading = false,
}: ConversationHeaderProps) {
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(conversation.label || '');
  const [labelReason, setLabelReason] = useState('');
  const [isUpdatingLabel, setIsUpdatingLabel] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [imageError, setImageError] = useState(false);

  const aiEnabled = conversation.aiState?.enabled ?? true;

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

  return (
    <>
      <div className="shrink-0 w-full z-20 bg-[#131313] border-b border-[#FFFF00]/10">

        {/* ── MOBILE HEADER (< md) ── */}
        <div className="flex md:hidden items-center justify-between px-4 h-16">
          {/* Back + Name */}
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="text-[#FFFF00] hover:opacity-80 transition-opacity active:scale-95"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
            )}
            <div className="flex flex-col">
              <span className="font-headline font-bold text-sm uppercase tracking-wider text-white leading-tight">
                {conversation.customerName || 'Unknown User'}
              </span>
              <span className="font-body text-[10px] text-zinc-500 tracking-tight">
                {conversation.customerPhone || ''}
              </span>
            </div>
          </div>

          {/* Zoya AI badge (Button) */}
          <button
            onClick={handleAiToggle}
            disabled={isTogglingAi || loading}
            className={cn(
              'flex items-center gap-2 px-3 py-1 rounded-full border transition-all active:scale-95',
              aiEnabled
                ? 'bg-[#FFFF00]/10 border-[#FFFF00]/20'
                : 'bg-zinc-800 border-zinc-700'
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                aiEnabled ? 'bg-[#FFFF00] animate-pulse' : 'bg-zinc-500'
              )}
            />
            <span
              className={cn(
                'font-headline font-bold text-xs tracking-widest uppercase',
                aiEnabled ? 'text-[#FFFF00]' : 'text-zinc-500'
              )}
            >
              ZOYA AI {isTogglingAi ? '...' : ''}
            </span>
          </button>
        </div>

        {/* ── DESKTOP HEADER (≥ md) ── */}
        <div className="hidden md:flex items-center justify-between px-8 h-20">

          {/* Left: Avatar + Info */}
          <div className="flex items-center gap-4">
            {/* Back button (optional on desktop) */}
            {onBack && (
              <button
                onClick={onBack}
                className="mr-1 text-zinc-500 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
            )}

            {/* Avatar */}
            <div className="relative">
              <div className="w-12 h-12 rounded-sm bg-[#2a2a2a] border border-white/5 flex items-center justify-center font-headline text-zinc-500 overflow-hidden">
                {conversation.profilePicUrl && !imageError ? (
                  <Image
                    src={conversation.profilePicUrl}
                    alt={conversation.customerName || 'Profile'}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    unoptimized
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <span className="font-headline font-bold text-lg text-zinc-400">
                    {(conversation.customerName || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {/* Online dot */}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#FFFF00] rounded-full border-2 border-[#131313]" />
            </div>

            {/* Name + ID */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-bold text-lg text-white uppercase tracking-wide truncate max-w-[200px]">
                  {conversation.customerName || 'Unknown User'}
                </h3>
                {aiEnabled && (
                  <span
                    onClick={() => setShowLabelModal(true)}
                    className="px-2 py-0.5 bg-[#FFFF00] text-black text-[9px] font-headline font-black rounded-sm uppercase tracking-widest cursor-pointer hover:bg-[#eaea00] transition-colors"
                  >
                    AI ZOYA AKTIF
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 font-body uppercase tracking-widest mt-0.5">
                Customer ID: #{conversation.id.slice(-4).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Right: Total Spend + Actions */}
          <div className="flex items-center gap-6">

            {/* Total Spend */}
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 font-body uppercase tracking-widest">Total Spend</p>
              <p className="text-lg font-headline font-bold text-[#FFFF00] leading-tight">
                Rp 12.450.000
              </p>
            </div>

            {/* Zoya AI Toggle */}
            <div className="flex items-center gap-3 bg-[#1c1b1b] px-3 py-1.5 rounded-sm border border-white/5">
              <span className="text-[10px] font-headline font-bold text-zinc-400 uppercase tracking-tighter">
                Zoya AI
              </span>
              <button
                onClick={handleAiToggle}
                disabled={isTogglingAi || loading}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
                  aiEnabled ? 'bg-[#FFFF00]' : 'bg-zinc-600'
                )}
              >
                <span className="sr-only">Toggle AI</span>
                <span
                  className={cn(
                    'inline-block h-3 w-3 transform rounded-full transition-transform shadow-sm',
                    aiEnabled ? 'translate-x-5 bg-black' : 'translate-x-1 bg-white'
                  )}
                />
              </button>
              <span
                className={cn(
                  'text-[10px] font-headline font-bold',
                  aiEnabled ? 'text-[#FFFF00]' : 'text-zinc-500'
                )}
              >
                {aiEnabled ? 'ON' : 'OFF'}
              </span>
            </div>

            {/* Buat Booking */}
            <button
              onClick={() => setShowBookingModal(true)}
              className="px-4 h-10 flex items-center gap-2 rounded-sm text-[10px] font-headline font-bold bg-[#FFFF00] text-black hover:bg-[#eaea00] active:scale-95 transition-all uppercase tracking-widest"
            >
              <span className="material-symbols-outlined text-[16px]">calendar_add_on</span>
              Buat Booking
            </button>

            {/* More */}
            <button className="w-10 h-10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#2a2a2a] transition-colors rounded-sm">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
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
                'p-4 rounded-sm border border-white/5 text-[11px] font-headline font-black uppercase transition-all flex items-center gap-3',
                selectedLabel === ''
                  ? 'bg-[#FFFF00] text-black'
                  : 'bg-[#2a2a2a] text-zinc-400 hover:bg-zinc-800'
              )}
            >
              <span className="material-symbols-outlined text-[18px]">block</span>
              No Label
            </button>
            {CONVERSATION_LABELS.map((label) => (
              <button
                key={label.value}
                onClick={() => setSelectedLabel(label.value)}
                className={cn(
                  'p-4 rounded-sm border border-white/5 text-[11px] font-headline font-black uppercase transition-all flex items-center gap-3',
                  selectedLabel === label.value
                    ? 'bg-[#FFFF00] text-black'
                    : 'bg-[#2a2a2a] text-zinc-400 hover:bg-zinc-800'
                )}
              >
                <div className={cn('size-2 rounded-full', label.className.split(' ')[0])} />
                {label.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-headline font-black uppercase tracking-widest text-zinc-500 px-1">
              Catatan Internal
            </label>
            <textarea
              value={labelReason}
              onChange={(e) => setLabelReason(e.target.value)}
              placeholder="Berikan alasan perubahan status..."
              className="w-full px-4 py-3 bg-[#0e0e0e] border border-white/10 rounded-sm text-sm font-body focus:ring-1 focus:ring-[#FFFF00]/30 outline-none resize-none transition-all placeholder:text-zinc-600 text-white"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => setShowLabelModal(false)}
              variant="secondary"
              disabled={isUpdatingLabel}
              className="flex-1 font-headline font-black h-12 rounded-sm bg-zinc-800 border-none text-zinc-400 hover:text-white"
            >
              BATAL
            </Button>
            <Button
              onClick={handleLabelUpdate}
              variant="primary"
              isLoading={isUpdatingLabel}
              disabled={selectedLabel === conversation.label && !labelReason}
              className="flex-[2] font-headline font-black h-12 rounded-sm bg-[#FFFF00] text-black hover:bg-[#eaea00] border-none"
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
          allConversations={allConversations}
          apiClient={apiClient}
          onSuccess={() => {
            setShowBookingModal(false);
          }}
          onCancel={() => setShowBookingModal(false)}
        />
      </Modal>
    </>
  );
}
