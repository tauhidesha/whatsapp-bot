'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function StudioSettingsForm() {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50 border-b border-slate-100">
        <CardTitle className="text-xl font-bold">Profil Bengkel</CardTitle>
        <CardDescription>Informasi umum tentang studio BosMat yang digunakan oleh AI.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="studio_name" className="font-bold">Nama Bengkel</Label>
            <Input id="studio_name" defaultValue="BosMat Garage" className="bg-slate-50"/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="font-bold">Nomor WhatsApp Resmi</Label>
            <Input id="phone" defaultValue="+6281234567890" className="bg-slate-50"/>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="font-bold">Alamat Lengkap</Label>
          <Input id="address" defaultValue="Jl. Raya Otista No. 12, Jakarta Timur" className="bg-slate-50"/>
        </div>

        <div className="grid grid-cols-2 gap-6 p-5 border rounded-lg bg-slate-50/50">
          <div className="space-y-2">
            <Label className="font-bold text-slate-700">Jam Buka Pagi</Label>
            <Input type="time" defaultValue="09:00" className="bg-white" />
          </div>
          <div className="space-y-2">
            <Label className="font-bold text-slate-700">Jam Tutup Sore</Label>
            <Input type="time" defaultValue="18:00" className="bg-white" />
          </div>
        </div>

        <div className="pt-6 border-t mt-6 flex justify-end">
          <Button className="bg-teal-600 hover:bg-teal-700 text-white px-6">Simpan Konfigurasi</Button>
        </div>
      </CardContent>
    </Card>
  );
}
