'use client';

import { useFinanceData } from '@/lib/hooks/useFinanceData';
import { cn } from '@/lib/utils';

interface CustomerFinanceSummaryProps {
  customerId: string;
  className?: string;
}

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export default function CustomerFinanceSummary({ customerId, className }: CustomerFinanceSummaryProps) {
  const { summary, loading } = useFinanceData(0, customerId);

  if (loading) {
    return (
      <div className={cn("animate-pulse bg-slate-50 h-10 w-28 rounded-xl", className)} />
    );
  }

  if (summary.transactionCount === 0) return null;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm shadow-emerald-500/5">
        <span className="material-symbols-outlined text-[18px] text-emerald-600">payments</span>
        <div className="flex flex-col">
          <p className="text-[8px] font-black text-emerald-500 uppercase leading-none mb-1 tracking-wider">Total Spend</p>
          <p className="text-[12px] font-black text-emerald-700 leading-none tracking-tight">
            {formatIDR(summary.totalIncome)}
          </p>
        </div>
      </div>
    </div>
  );
}
