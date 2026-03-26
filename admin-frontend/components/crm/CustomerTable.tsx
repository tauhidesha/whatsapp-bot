'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface Vehicle {
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

export interface Customer {
  id: string;
  name: string;
  phone: string;
  lastService: string | null;
  totalSpending: number;
  bikes: string[];
  vehicles: Vehicle[];
  status: 'active' | 'churned' | 'new';
}

export function CustomerTable({ 
  customers, 
  onRowClick 
}: { 
  customers: Customer[], 
  onRowClick: (c: Customer) => void 
}) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead>Pelanggan</TableHead>
            <TableHead>No. HP</TableHead>
            <TableHead>Motor / Plat</TableHead>
            <TableHead>Terakhir Servis</TableHead>
            <TableHead className="text-right">Total Transaksi</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id} className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => onRowClick(customer)}>
              <TableCell className="font-medium flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-teal-100 text-teal-700">{customer.name.substring(0,2).toUpperCase()}</AvatarFallback>
                </Avatar>
                {customer.name}
              </TableCell>
              <TableCell className="text-slate-600 font-mono text-sm">{customer.phone}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {customer.vehicles.length > 0 ? (
                    customer.vehicles.map((v, i) => (
                      <Badge 
                        key={v.id} 
                        variant="outline" 
                        className="text-xs font-normal"
                        title={`${v.serviceCount}x servis`}
                      >
                        {v.plateNumber ? (
                          <>
                            <span className="font-mono font-semibold">{v.plateNumber}</span>
                            {v.modelName && <span className="ml-1 text-slate-400">({v.modelName})</span>}
                          </>
                        ) : (
                          v.modelName
                        )}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-slate-400 text-sm">-</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-slate-600 text-sm">{formatDate(customer.lastService)}</TableCell>
              <TableCell className="text-right font-medium">Rp {customer.totalSpending.toLocaleString('id-ID')}</TableCell>
              <TableCell>
                <Badge variant={customer.status === 'active' ? 'default' : customer.status === 'new' ? 'secondary' : 'destructive'}>
                  {customer.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
