'use client';

import { Transaction } from '@/lib/hooks/useFinanceData';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState } from 'react';

import Link from 'next/link';

interface TransactionListProps {
  transactions: Transaction[];
  loading?: boolean;
  className?: string;
  onEdit?: (t: Transaction) => void;
  onRefresh?: () => void;
}

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function TransactionList({ transactions, loading, className, onEdit, onRefresh }: TransactionListProps) {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const filtered = transactions.filter(t => {
    if (filter === 'all') return true;
    return t.type === filter;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus transaksi ini? Data booking terkait akan dihitung ulang.')) return;
    
    setIsDeleting(id);
    try {
      const res = await fetch(`/api/finance/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        onRefresh?.();
      } else {
        alert(json.error || 'Gagal menghapus transaksi');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Gagal menghapus transaksi');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className={cn("bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden", className)}>
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Riwayat Transaksi</h3>
          <p className="text-[12px] text-slate-400 font-medium">Data 30 hari terakhir</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['all', 'income', 'expense'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all capitalize",
                filter === type 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {type === 'all' ? 'Semua' : type === 'income' ? 'Masuk' : 'Keluar'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
              <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Kategori</th>
              <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Keterangan</th>
              <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Nominal</th>
              <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={5} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium italic">Belum ada transaksi</td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-bold text-slate-900">{format(new Date(t.createdAt), 'dd MMM yy')}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{format(new Date(t.createdAt), 'HH:mm')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-tight",
                      t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    )}>{t.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[13px] font-medium text-slate-600 truncate max-w-[150px]">{t.description}</p>
                    {t.customer && (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[11px] text-slate-400 font-bold leading-none">Cust: {t.customer.name}</p>
                        <Link 
                          href={`/conversations?id=${t.customer.phone}`}
                          className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-0.5 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">chat</span>
                          Lihat Chat
                        </Link>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className={cn("text-[14px] font-black tracking-tight", t.type === 'income' ? "text-emerald-600" : "text-rose-600")}>
                      {t.type === 'income' ? '+' : '-'} {formatIDR(t.amount)}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => onEdit?.(t)}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-teal-50 hover:text-teal-600 transition-all"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button 
                        onClick={() => handleDelete(t.id)}
                        disabled={isDeleting === t.id}
                        className={cn(
                          "p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all",
                          isDeleting === t.id && "animate-pulse opacity-50"
                        )}
                        title="Hapus"
                      >
                        <span className="material-symbols-outlined text-[18px]">{isDeleting === t.id ? 'refresh' : 'delete'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
