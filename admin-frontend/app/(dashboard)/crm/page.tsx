'use client';

import { useState, useEffect } from 'react';
import { CustomerTable, Customer } from '@/components/crm/CustomerTable';
import { CustomerDetailSheet } from '@/components/crm/CustomerDetailSheet';
import { Loader2 } from 'lucide-react';

export default function CRMPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const res = await fetch('/api/crm/customers');
        const data = await res.json();
        if (data.success) {
          setCustomers(data.customers);
        }
      } catch (err) {
        console.error('Failed to fetch customers:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-6">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Customer Relationship Management</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Kelola data pelanggan, riwayat servis, dan profil motor.</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <CustomerTable customers={customers} onRowClick={(customer) => setSelectedCustomer(customer)} />
        )}
      </div>

      <CustomerDetailSheet 
        customer={selectedCustomer} 
        open={!!selectedCustomer} 
        onOpenChange={(open) => !open && setSelectedCustomer(null)} 
      />
    </div>
  );
}
