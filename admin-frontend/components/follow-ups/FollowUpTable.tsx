'use client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface FollowUp {
  id: string;
  customerName: string;
  phone: string;
  lastServiceDate: string;
  serviceType: string;
  dueDate: string;
  status: 'upcoming' | 'overdue' | 'sent';
}

export function FollowUpTable({ data, onSendAction }: { data: FollowUp[], onSendAction: (f: FollowUp) => void }) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border bg-white p-8 text-center shadow-sm">
        <p className="text-slate-500 font-medium">Tidak ada data di kategori ini.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead>Pelanggan</TableHead>
            <TableHead>Servis Terakhir</TableHead>
            <TableHead>Jatuh Tempo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
              <TableCell className="font-medium">
                <div className="text-slate-800">{item.customerName}</div>
                <div className="text-xs text-slate-500 font-normal">{item.phone}</div>
              </TableCell>
              <TableCell>
                <div className="text-slate-800">{item.serviceType}</div>
                <div className="text-xs text-slate-500">{item.lastServiceDate}</div>
              </TableCell>
              <TableCell className="font-semibold text-slate-700">{item.dueDate}</TableCell>
              <TableCell>
                <Badge variant={item.status === 'sent' ? 'default' : item.status === 'overdue' ? 'destructive' : 'secondary'}>
                  {item.status.toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  size="sm" 
                  variant={item.status === 'sent' ? 'outline' : 'default'} 
                  onClick={() => onSendAction(item)} 
                  disabled={item.status === 'sent'}
                  className={item.status !== 'sent' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                >
                  {item.status === 'sent' ? 'Terkirim' : 'Kirim Pesan'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
