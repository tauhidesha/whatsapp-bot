'use client';

import { Transaction } from '@/lib/hooks/useFinanceData';
import { cn } from '@/lib/utils';
import { format, subDays, startOfDay, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';

interface FinanceChartProps {
  transactions: Transaction[];
  loading?: boolean;
}

export default function FinanceChart({ transactions, loading }: FinanceChartProps) {
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm animate-pulse">
        <div className="h-6 w-48 bg-slate-100 rounded mb-8" />
        <div className="flex items-end justify-between h-[200px] gap-2 mt-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex-1 bg-slate-100 rounded-t-lg" style={{ height: '40%' }} />
          ))}
        </div>
      </div>
    );
  }

  // Generate last 7 days data
  const chartData = [...Array(7)].map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayTransactions = transactions.filter(t => isSameDay(new Date(t.createdAt), date));
    
    const income = dayTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const expense = dayTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      date: format(date, 'EEE', { locale: id }),
      income,
      expense,
      profit: income - expense
    };
  });

  const maxVal = Math.max(...chartData.map(d => Math.max(d.income, d.expense)), 1000000);

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Tren Mingguan</h3>
          <p className="text-[12px] text-slate-400 font-medium">Perbandingan Pemasukan & Pengeluaran</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-bold text-slate-500">Masuk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-rose-500" />
            <span className="text-[11px] font-bold text-slate-500">Keluar</span>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between h-[200px] gap-2 sm:gap-4 relative px-2">
        {/* Y-Axis lines (simplified) */}
        <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-50">
          <div className="border-t border-slate-100 w-full" />
          <div className="border-t border-slate-100 w-full" />
          <div className="border-t border-slate-100 w-full" />
        </div>

        {chartData.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 relative group h-full">
            <div className="flex items-end gap-1 w-full flex-1 justify-center min-h-0">
              {/* Income bar */}
              <div 
                className="w-1.5 sm:w-3 bg-emerald-500 rounded-t-full transition-all duration-700 hover:brightness-110 relative"
                style={{ height: `${(d.income / maxVal) * 100}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-bold">
                  {d.income.toLocaleString('id-ID')}
                </div>
              </div>
              {/* Expense bar */}
              <div 
                className="w-1.5 sm:w-3 bg-rose-500 rounded-t-full transition-all duration-700 hover:brightness-110 relative"
                style={{ height: `${(d.expense / maxVal) * 100}%` }}
              >
                 <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 font-bold">
                  {d.expense.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
            <span className="text-[11px] font-black text-slate-400 uppercase">{d.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
