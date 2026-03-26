'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';

interface Customer {
  id: string;
  name: string;
  phone: string;
  vehicles: Array<{
    id: string;
    modelName: string;
    plateNumber: string | null;
  }>;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddTransactionModal({ isOpen, onClose }: AddTransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [formData, setFormData] = useState({
    type: 'income',
    amount: '',
    category: '',
    description: '',
    paymentMethod: 'transfer',
    customerId: '',
    customerName: '',
    vehicleId: '',
    plateNumber: '',
    serviceType: '',
    bookingDate: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/crm/customers?limit=100');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const selectedCustomer = customers.find(c => c.id === formData.customerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount),
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      onClose();
      setFormData({
        type: 'income',
        amount: '',
        category: '',
        description: '',
        paymentMethod: 'transfer',
        customerId: '',
        customerName: '',
        vehicleId: '',
        plateNumber: '',
        serviceType: '',
        bookingDate: '',
      });
      setSearchQuery('');
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert('Gagal menambah transaksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tambah Transaksi Baru">
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['income', 'expense'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFormData({ ...formData, type: t })}
              className={`flex-1 py-2 rounded-lg text-[13px] font-black transition-all ${
                formData.type === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {t === 'income' ? 'Pemasukan' : 'Pengeluaran'}
            </button>
          ))}
        </div>

        {formData.type === 'income' && (
          <>
            <div className="space-y-1.5">
              <label className="text-[12px] font-black text-slate-400 uppercase tracking-wider">Pelanggan</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari nama atau nomor HP..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-[14px] font-bold focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                />
                {showCustomerDropdown && searchQuery && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, customerId: c.id, customerName: c.name });
                            setSearchQuery(c.name);
                            setShowCustomerDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-slate-50 text-sm"
                        >
                          <span className="font-bold">{c.name}</span>
                          <span className="text-slate-400 ml-2">{c.phone}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-slate-400">Tidak ditemukan</div>
                    )}
                  </div>
                )}
              </div>
              {selectedCustomer && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedCustomer.vehicles.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, vehicleId: v.id, plateNumber: v.plateNumber || '' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        formData.vehicleId === v.id
                          ? 'bg-teal-50 border-teal-500 text-teal-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'
                      }`}
                    >
                      {v.modelName} {v.plateNumber && `(${v.plateNumber})`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Plat Nomor"
                placeholder="Contoh: B 1234 AB"
                value={formData.plateNumber}
                onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
              />
              <Input
                label="Jenis Kendaraan"
                placeholder="Contoh: Honda Vario"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>

            <Input
              label="Layanan"
              placeholder="Contoh: Repaint Bodi, Coating, Cuci"
              value={formData.serviceType}
              onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
            />
          </>
        )}

        <Input
          label="Nominal (IDR)"
          type="number"
          placeholder="Contoh: 500000"
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          required
        />

        <Input
          label="Kategori"
          placeholder="Contoh: Repaint, Gaji, Listrik"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          required
        />

        <Input
          label="Keterangan"
          placeholder="Detail transaksi..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          required
        />

        <div className="space-y-1.5">
          <label className="text-[12px] font-black text-slate-400 uppercase tracking-wider">Metode Pembayaran</label>
          <select 
            className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-white text-[14px] font-bold focus:ring-2 focus:ring-teal-500 outline-none transition-all"
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
          >
            <option value="transfer">Transfer</option>
            <option value="cash">Cash</option>
            <option value="qris">QRIS</option>
          </select>
        </div>

        <div className="pt-4 flex gap-3">
          <Button variant="outline" className="flex-1 rounded-xl h-12" onClick={onClose} type="button">Batal</Button>
          <Button className="flex-1 bg-teal-500 hover:bg-teal-600 rounded-xl h-12" type="submit" isLoading={loading}>
            Simpan Transaksi
          </Button>
        </div>
      </form>
    </Modal>
  );
}
