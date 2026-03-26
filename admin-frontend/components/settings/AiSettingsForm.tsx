'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function AiSettingsForm() {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50 border-b border-slate-100">
        <CardTitle className="text-xl font-bold">AI Assistant Configuration</CardTitle>
        <CardDescription>Atur perilaku dan response dasar dari agen AI WhatsApp.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 border border-slate-100 rounded-lg bg-slate-50/50">
            <div className="space-y-0.5">
              <Label className="text-base font-bold text-slate-800">Aktifkan Auto-Reply</Label>
              <div className="text-sm text-slate-500 font-medium">Izinkan AI untuk membalas pesan secara otomatis tanpa persetujuan Admin.</div>
            </div>
            <Switch defaultChecked />
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="system_prompt" className="text-base font-bold">System Prompt</Label>
            <Textarea 
              id="system_prompt" 
              className="min-h-[300px] font-mono text-sm leading-relaxed p-4 bg-slate-900 text-teal-50 border-0 focus-visible:ring-teal-500 shadow-inner" 
              defaultValue="Anda adalah AI Assistant untuk bengkel motor BosMat. Tugas Anda adalah membantu pelanggan melakukan booking servis, menjawab harga servis, dan memberikan estimasi waktu.\n\nAturan:\n1. Selalu jawab dengan sopan dan kasual.\n2. Jangan merekomendasikan layanan yang tidak ada di price list.\n3. Arahkan pelanggan untuk booking setiap selesai menjawab info harga."
            />
            <p className="text-sm font-medium text-slate-500 mt-2 flex items-center gap-1.5">
              <span className="text-amber-500 font-bold">⚠️</span> Instruksi utama sistem agen ini. Berhati-hatilah saat mengubah.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t mt-6 flex justify-end">
          <Button className="bg-teal-600 hover:bg-teal-700 text-white px-6">Simpan Perubahan</Button>
        </div>
      </CardContent>
    </Card>
  );
}
