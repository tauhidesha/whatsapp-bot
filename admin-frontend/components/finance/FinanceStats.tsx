'use client';

import { FinanceSummary } from '@/lib/hooks/useFinanceData';
import { cn } from '@/lib/utils';

interface FinanceStatsProps {
  summary: FinanceSummary;
  loading?: boolean;
  className?: string;
}

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function FinanceStats({ summary, loading, className }: FinanceStatsProps) {
  if (loading) {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-6 rounded-2xl border border-slate-100 bg-white animate-pulse">
            <div className="size-10 rounded-xl bg-slate-100 mb-4" />
            <div className="h-3 w-20 bg-slate-50 rounded mb-2" />
            <div className="h-8 w-32 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }
  const stats = [
    {
      label: 'Total Pemasukan',
      value: formatIDR(summary.totalIncome),
      icon: 'trending_up',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-100',
    },
    {
      label: 'Total Pengeluaran',
      value: formatIDR(summary.totalExpense),
      icon: 'trending_down',
      color: 'text-rose-500',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-100',
    },
    {
      label: 'Profit Bersih',
      value: formatIDR(summary.netProfit),
      icon: 'payments',
      color: summary.netProfit >= 0 ? 'text-teal-500' : 'text-rose-600',
      bgColor: summary.netProfit >= 0 ? 'bg-teal-50' : 'bg-rose-50',
      borderColor: summary.netProfit >= 0 ? 'border-teal-100' : 'border-rose-100',
    },
    {
      label: 'Jumlah Transaksi',
      value: summary.transactionCount.toString(),
      icon: 'receipt_long',
      color: 'text-slate-500',
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-100',
    },
  ];

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
      {stats.map((stat, i) => (
        <div 
          key={i}
          className={cn(
            "p-6 rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md hover:scale-[1.02]",
            stat.borderColor
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={cn("p-2.5 rounded-xl", stat.bgColor)}>
              <span className={cn("material-symbols-outlined block text-[24px]", stat.color)}>
                {stat.icon}
              </span>
            </div>
            <span className="material-symbols-outlined text-slate-300 text-[20px]">
              more_horiz
            </span>
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <h3 className={cn("text-2xl font-black tracking-tight", stat.color === 'text-slate-500' ? 'text-slate-900' : stat.color)}>
              {stat.value}
            </h3>
          </div>
        </div>
      ))}
    </div>
  );
}
