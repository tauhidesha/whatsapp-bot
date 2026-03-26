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
import { useState, useEffect } from "react";

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
  bikes: string[];
  vehicles: VehicleDetail[];
  status: 'active' | 'churned' | 'new';
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
      setCustomerDetail(customer as CustomerDetail);
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

        <div className="grid gap-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="py-3 px-4 bg-slate-50/50">
                <CardTitle className="text-xs uppercase font-bold tracking-wider text-slate-500">Total Transaksi</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="text-2xl font-black text-slate-800">
                  Rp {(displayCustomer.totalSpending || 0).toLocaleString('id-ID')}
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="py-3 px-4 bg-slate-50/50">
                <CardTitle className="text-xs uppercase font-bold tracking-wider text-slate-500">Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 flex items-center">
                <Badge 
                  variant={
                    displayCustomer.status === 'active' ? 'default' : 
                    displayCustomer.status === 'new' ? 'secondary' : 'destructive'
                  } 
                  className="text-sm px-3 py-1"
                >
                  {displayCustomer.status?.toUpperCase() || 'NEW'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Vehicles Section */}
          <Card className="shadow-sm border-slate-200">
            <div className="p-4 bg-white rounded-xl">
              <h3 className="font-bold mb-3 text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                  Kendaraan Dimiliki
                </span>
                <span className="text-xs font-normal text-slate-400">
                  {displayCustomer.vehicles?.length || 0} motor
                </span>
              </h3>
              
              {loading ? (
                <div className="text-sm text-slate-400">Memuat...</div>
              ) : displayCustomer.vehicles && displayCustomer.vehicles.length > 0 ? (
                <div className="space-y-3">
                  {displayCustomer.vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-slate-800">
                            {vehicle.modelName}
                          </div>
                          {vehicle.plateNumber && (
                            <Badge variant="outline" className="mt-1 font-mono text-xs">
                              {vehicle.plateNumber}
                            </Badge>
                          )}
                          {vehicle.color && (
                            <span className="text-xs text-slate-500 ml-2">
                              {vehicle.color}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-400">
                            {vehicle.serviceCount}x servis
                          </div>
                        </div>
                      </div>
                      
                      {/* Recent bookings for this vehicle */}
                      {vehicle.bookings && vehicle.bookings.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100">
                          <div className="text-xs text-slate-400 mb-1">Servis terakhir:</div>
                          {vehicle.bookings.slice(0, 2).map((booking) => (
                            <div key={booking.id} className="flex justify-between text-xs">
                              <span className="text-slate-600 truncate flex-1">
                                {booking.serviceType}
                              </span>
                              <span className="text-slate-400 ml-2">
                                {formatDate(booking.bookingDate)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400 text-center py-4">
                  Belum ada kendaraan terdaftar
                </div>
              )}
            </div>
          </Card>

          {/* Service History */}
          <Card className="shadow-sm border-slate-200">
            <div className="p-4 bg-white rounded-xl">
              <h3 className="font-bold mb-4 text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Riwayat Servis Terakhir
              </h3>
              {loading ? (
                <div className="text-sm text-slate-400">Memuat...</div>
              ) : (
                <div className="space-y-4">
                  {customerDetail?.lastService ? (
                    <div className="text-sm text-slate-500">
                      Terakhir servis: {formatDate(customerDetail.lastService)}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">
                      Belum ada riwayat servis
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
