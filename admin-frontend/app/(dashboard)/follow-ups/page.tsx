'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FollowUpTable, FollowUp } from '@/components/follow-ups/FollowUpTable';
import { FollowUpTemplateModal } from '@/components/follow-ups/FollowUpTemplateModal';
import { Loader2 } from 'lucide-react';

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUp | null>(null);

  useEffect(() => {
    async function fetchFollowUps() {
      try {
        const res = await fetch('/api/follow-ups');
        const data = await res.json();
        if (data.success) {
          setFollowUps(data.items);
        }
      } catch (err) {
        console.error('Failed to fetch follow-ups:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchFollowUps();
  }, []);

  const upcomingFollowUps = followUps.filter(f => f.status === 'upcoming');
  const overdueFollowUps = followUps.filter(f => f.status === 'overdue');
  const sentFollowUps = followUps.filter(f => f.status === 'sent');

  const handleSendFollowUp = async (followUp: FollowUp, message: string) => {
    console.log(`[Follow-up] Sending to ${followUp.phone}: ${message}`);
    // Optional: Call API to send via AI
    try {
      await fetch('/api/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: `Kirim pesan ini ke pelanggan: ${message}`,
          senderNumber: followUp.phone,
          mode: 'admin'
        })
      });
      alert(`Pesan follow-up untuk ${followUp.customerName} sedang diproses.`);
    } catch (err) {
      console.error('Failed to send follow-up:', err);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Follow-up Hub</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">Kelola pengingat servis dan pesan retensi pelanggan via AI.</p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">Upcoming ({upcomingFollowUps.length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({overdueFollowUps.length})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({sentFollowUps.length})</TabsTrigger>
        </TabsList>
        
        {loading ? (
          <div className="flex items-center justify-center h-64 border rounded-md bg-white">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <TabsContent value="upcoming">
              <FollowUpTable data={upcomingFollowUps} onSendAction={(f) => setSelectedFollowUp(f)} />
            </TabsContent>
            <TabsContent value="overdue">
              <FollowUpTable data={overdueFollowUps} onSendAction={(f) => setSelectedFollowUp(f)} />
            </TabsContent>
            <TabsContent value="sent">
              <FollowUpTable data={sentFollowUps} onSendAction={(f) => setSelectedFollowUp(f)} />
            </TabsContent>
          </>
        )}
      </Tabs>

      <FollowUpTemplateModal 
        followUp={selectedFollowUp} 
        open={!!selectedFollowUp} 
        onOpenChange={(open) => !open && setSelectedFollowUp(null)} 
        onSend={handleSendFollowUp}
      />
    </div>
  );
}
