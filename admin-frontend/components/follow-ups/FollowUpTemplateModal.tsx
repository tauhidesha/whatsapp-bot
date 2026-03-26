'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FollowUp } from "./FollowUpTable";
import { useState, useEffect } from "react";

interface Props {
  followUp: FollowUp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (followUp: FollowUp, message: string) => void;
}

export function FollowUpTemplateModal({ followUp, open, onOpenChange, onSend }: Props) {
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (followUp) {
      setMessage(`Halo ${followUp.customerName}! Sudah waktunya servis untuk motor Anda sejak kunjungan terakhir pada ${followUp.lastServiceDate}. Yuk jadwalkan servis di BosMat agar performa motor tetap prima! Balas pesan ini untuk melihat jadwal kosong kami hari ini.`);
    }
  }, [followUp]);

  if (!followUp) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Kirim Follow-up AI</DialogTitle>
          <DialogDescription className="text-slate-500">
            Edit pesan template di bawah sebelum AI Assistant mengirim Notifikasi WhatsApp ke <strong className="text-slate-700">{followUp.customerName}</strong> ({followUp.phone}).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[160px] text-base leading-relaxed p-4 bg-slate-50 focus-visible:ring-teal-500"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button 
            className="bg-teal-600 hover:bg-teal-700 text-white" 
            onClick={() => {
              onSend(followUp, message);
              onOpenChange(false);
            }}
          >
            Kirim via AI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
