'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Customer, Vehicle } from "./CustomerTable";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Info, 
  History, 
  ShieldCheck, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  Bike
} from "lucide-react";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BookingHistory {
  id: string;
  bookingDate: string;
  serviceType: string;
  status: string;
  plateNumber?: string;
  vehicleModel?: string;
}

export interface VehicleDetail {
  id: string;
  modelName: string;
  plateNumber: string | null;
  color: string | null;
  serviceCount: number;
  bookings?: Array<{
    id: string;
    bookingDate: string;
    serviceType: string;
    status: string;
  }>;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  lastService: string | null;
  totalSpending: number;
  vehicles: VehicleDetail[];
  bookings?: BookingHistory[];
  status: 'active' | 'churned' | 'new';
  warranties?: Array<{
    id: string;
    type: string;
    vehicle: string;
    plateNumber?: string;
    startDate: string;
    expiryDate: string;
    status: 'ACTIVE' | 'EXPIRED' | 'VOID';
    lastMaintenance?: string;
    nextMaintenance?: string | null;
    serviceType: string;
  }>;
}

interface Props {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailSheet({ customer, open, onOpenChange }: Props) {
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customer?.id && open) {
      fetchCustomerDetail(customer.id);
    }
  }, [customer?.id, open]);

  const fetchCustomerDetail = async (customerId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/customers/${customerId}`);
      const data = await res.json();
      if (data.success) {
        setCustomerDetail(data.customer);
      }
    } catch (error) {
      console.error('Error fetching customer detail:', error);
      // Fallback to basic customer data
      setCustomerDetail(customer as unknown as CustomerDetail);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (!customer) return null;

  const displayCustomer = customerDetail || customer;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto bg-slate-50">
        <SheetHeader className="mb-6 bg-white p-6 -mx-6 -mt-6 border-b">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl bg-teal-100 text-teal-700">
                {displayCustomer.name.substring(0,2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-2xl font-black text-slate-800">{displayCustomer.name}</SheetTitle>
              <SheetDescription className="text-base text-slate-500 font-mono">
                {displayCustomer.phone}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-100/80 p-1">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Info className="h-4 w-4" />
              Info
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <History className="h-4 w-4" />
              Riwayat
            </TabsTrigger>
            <TabsTrigger value="warranty" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              Garansi
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="mt-0 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="py-3 px-4 bg-slate-50/50">
                  <CardTitle className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Total Transaksi</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="text-xl font-black text-slate-800">
                    Rp {(displayCustomer.totalSpending || 0).toLocaleString('id-ID')}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="py-3 px-4 bg-slate-50/50">
                  <CardTitle className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Status CRM</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2 flex items-center">
                  <Badge 
                    variant={
                      displayCustomer.status === 'active' ? 'default' : 
                      displayCustomer.status === 'new' ? 'secondary' : 'destructive'
                    } 
                    className="text-xs font-bold"
                  >
                    {displayCustomer.status?.toUpperCase() || 'NEW'}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm border-slate-200 overflow-hidden">
              <div className="p-4 bg-white">
                <h3 className="font-bold mb-4 text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Bike className="h-4 w-4 text-teal-600" />
                    Daftar Kendaraan
                  </span>
                  <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                    {displayCustomer.vehicles?.length || 0} MOTOR
                  </span>
                </h3>
                
                {loading ? (
                  <div className="space-y-3">
                    {[1,2].map(i => <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-lg" />)}
                  </div>
                ) : displayCustomer.vehicles && displayCustomer.vehicles.length > 0 ? (
                  <div className="space-y-3">
                    {displayCustomer.vehicles.map((vehicle) => (
                      <div key={vehicle.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200/50 hover:border-teal-200 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-slate-800 leading-tight">
                              {vehicle.modelName}
                            </div>
                            <div className="flex gap-2 mt-1 items-center">
                              {vehicle.plateNumber && (
                                <span className="font-mono text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                  {vehicle.plateNumber}
                                </span>
                              )}
                              {vehicle.color && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {vehicle.color.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-white">
                            {vehicle.serviceCount}x Servis
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 text-center py-6 border-2 border-dashed rounded-lg">
                    Kosong
                  </div>
                )}
              </div>
            </Card>

            <Card className="shadow-sm border-slate-200">
              <div className="p-4">
                 <h3 className="font-bold mb-3 text-slate-800 flex items-center gap-2">
                   <Clock className="h-4 w-4 text-amber-500" />
                   Info Terakhir
                 </h3>
                 <div className="text-sm space-y-2">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-slate-500">Servis Terakhir</span>
                      <span className="font-bold text-slate-700">{formatDate(displayCustomer.lastService)}</span>
                    </div>
                    {(displayCustomer as any).warranties && (displayCustomer as any).warranties.some((w: any) => w.status === 'ACTIVE') && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-500">Garansi Aktif</span>
                        <Badge className="bg-emerald-500">YA</Badge>
                      </div>
                    )}
                 </div>
              </div>
            </Card>
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history" className="mt-0 space-y-4">
             <ScrollArea className="h-[500px] pr-4 -mr-4">
                <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                  {loading ? (
                    [1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-lg" />)
                  ) : customerDetail?.bookings && customerDetail.bookings.length > 0 ? (
                    customerDetail.bookings.map((booking, idx) => (
                      <div key={booking.id} className="relative">
                        <div className={`absolute -left-[23px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                          booking.status === 'COMPLETED' ? 'bg-emerald-500' : 
                          booking.status === 'CANCELLED' ? 'bg-slate-300' : 'bg-amber-500'
                        }`} />
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">
                              {formatDate(booking.bookingDate)}
                            </span>
                            <Badge variant="outline" className="text-[10px] scale-90 origin-right">
                              {booking.status}
                            </Badge>
                          </div>
                          <div className="font-bold text-slate-800 mb-1">{booking.serviceType}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                             <Bike className="h-3 w-3" />
                             {booking.vehicleModel} ({booking.plateNumber || '-'})
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-20 text-slate-400">
                      Belum ada riwayat servis
                    </div>
                  )}
                </div>
             </ScrollArea>
          </TabsContent>

          {/* WARRANTY TAB */}
          <TabsContent value="warranty" className="mt-0 space-y-4">
            {loading ? (
              <div className="h-40 bg-slate-100 animate-pulse rounded-lg" />
            ) : customerDetail?.warranties && customerDetail.warranties.length > 0 ? (
              <div className="space-y-4">
                {customerDetail.warranties.map((warranty) => (
                  <Card key={warranty.id} className={`overflow-hidden border-l-4 ${
                    warranty.status === 'ACTIVE' ? 'border-l-emerald-500' : 
                    warranty.status === 'VOID' ? 'border-l-red-500' : 'border-l-slate-400'
                  }`}>
                    <CardHeader className="py-3 px-4 bg-slate-50/50 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                           {warranty.type === 'Coating' ? <ShieldCheck className="h-4 w-4 text-blue-600" /> : <Clock className="h-4 w-4 text-amber-500" />}
                           Garansi {warranty.type}
                        </CardTitle>
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          {warranty.vehicle} • {warranty.plateNumber}
                        </div>
                      </div>
                      <Badge className={
                        warranty.status === 'ACTIVE' ? 'bg-emerald-500' : 
                        warranty.status === 'VOID' ? 'bg-red-500' : 'bg-slate-400'
                      }>
                        {warranty.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 text-sm space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Tgl Mulai</div>
                          <div className="font-semibold text-slate-700">{formatDate(warranty.startDate)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase">Berakhir</div>
                          <div className="font-semibold text-slate-700">{formatDate(warranty.expiryDate)}</div>
                        </div>
                      </div>

                      {warranty.type === 'Coating' && (
                        <div className="pt-3 border-t border-slate-100">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-slate-500 flex items-center gap-1 font-bold">
                              <Calendar className="h-3 w-3" /> JADWAL MAINTENANCE
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">Tiap 3 Bulan</span>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                             <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${warranty.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-slate-300'}`} style={{ width: '75%' }} />
                             </div>
                             <span className="text-[10px] font-bold text-slate-500">75%</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-2">
                             <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <div className="text-[9px] text-slate-400 font-bold uppercase">Terakhir</div>
                                <div className="text-xs font-bold text-slate-600">{formatDate(warranty.lastMaintenance || null)}</div>
                             </div>
                             <div className={`p-2 rounded border ${warranty.status === 'VOID' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="text-[9px] text-slate-400 font-bold uppercase">Next Maint</div>
                                <div className={`text-xs font-bold ${warranty.status === 'VOID' ? 'text-red-600' : 'text-slate-600'}`}>
                                   {warranty.status === 'VOID' ? 'VOID (Hangus)' : formatDate(warranty.nextMaintenance || null)}
                                </div>
                             </div>
                          </div>
                          
                          {warranty.status === 'VOID' && (
                            <div className="mt-3 p-2 bg-red-50 text-red-700 text-[10px] rounded border border-red-100 flex gap-2 items-start">
                               <AlertCircle className="h-4 w-4 shrink-0" />
                               <span>Garansi hangus karena melewati batas maintenance 3 bulan. Silakan hubungi admin untuk aktivasi kembali (syarat & ketentuan berlaku).</span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 bg-white rounded-xl border-2 border-dashed">
                <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>Tidak ada garansi aktif</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
