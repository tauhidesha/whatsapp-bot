'use client';

import { useState } from 'react';
import { useFinanceData } from '@/lib/hooks/useFinanceData';
import FinanceStats from './FinanceStats';
import FinanceChart from './FinanceChart';
import TransactionList from './TransactionList';
import AddTransactionModal from './AddTransactionModal';
import Button from '@/components/shared/Button';
import { Transaction } from '@/lib/hooks/useFinanceData';

export default function FinanceDashboard() {
  const [timeframe, setTimeframe] = useState(30);
  const { transactions, summary, loading, refresh } = useFinanceData(timeframe);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Finance Management</h1>
          <p className="text-slate-500 font-medium text-[14px]">Lacak pemasukan, pengeluaran, dan profit Bosmat Studio.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <select 
              value={timeframe}
              onChange={(e) => setTimeframe(Number(e.target.value))}
              className="appearance-none bg-white border border-slate-200 text-slate-700 font-bold h-12 pl-4 pr-10 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all text-sm cursor-pointer"
            >
              <option value={7}>7 Hari Terakhir</option>
              <option value={30}>30 Hari Terakhir</option>
              <option value={90}>3 Bulan Terakhir</option>
              <option value={0}>Semua Waktu</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[20px]">
              expand_more
            </span>
          </div>

          <Button 
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-900 text-white hover:bg-slate-800 rounded-2xl px-6 h-12 shadow-lg shadow-slate-900/10 flex items-center gap-2 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Tambah
          </Button>
        </div>
      </div>

      <FinanceStats summary={summary} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <TransactionList 
            transactions={transactions} 
            loading={loading} 
            onEdit={handleEdit}
            onRefresh={refresh}
          />
        </div>
        <div>
          <FinanceChart transactions={transactions} loading={loading} />
        </div>
      </div>

      <AddTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
          refresh();
        }} 
        editData={editingTransaction}
      />
    </div>
  );
}
