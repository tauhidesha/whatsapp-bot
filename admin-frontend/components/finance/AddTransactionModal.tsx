'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/shared/Modal';
import Button from '@/components/shared/Button';
import Input from '@/components/shared/Input';
import { 
  MOTOR_DATABASE, SERVICES, CATEGORY_LABELS, 
  getServicePrice, formatRupiah,
  type MotorModel, type ServiceItem 
} from '@/lib/data/pricing';
import { Transaction } from '@/lib/hooks/useFinanceData';

interface Vehicle {
  id: string;
  modelName: string;
  plateNumber: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  vehicles: Vehicle[];
}

interface Booking {
  id: string;
  serviceType: string;
  vehicleModel: string | null;
  plateNumber: string | null;
  totalAmount: number | null;
  subtotal: number | null;
  downPayment: number | null;
  amountPaid: number;
  paymentStatus: string;
  status: string;
  bookingDate: string;
}

interface CartItem {
  service: ServiceItem;
  autoPrice: number;
  manualPrice: number | null;
  spotCount?: number;
  spotPrice?: number;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editData?: Transaction | null;
}

const PRESET_SERVICES = [
  'Repaint Bodi',
  'Repaint Velg',
  'Coating',
  'Detailing',
  'Ganti Oli',
  'Servis Rutin',
  'Cuci Motor',
];

const STORAGE_KEY = 'add_transaction_draft';

export default function AddTransactionModal({ isOpen, onClose, editData }: AddTransactionModalProps) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // NEW: Pricing & Cart State
  const [selectedMotor, setSelectedMotor] = useState<MotorModel | null>(null);
  const [motorSearch, setMotorSearch] = useState('');
  const [showMotorDropdown, setShowMotorDropdown] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'percentage' | 'nominal'>('nominal');
  const [discountValue, setDiscountValue] = useState(0);
  const [useManualTotal, setUseManualTotal] = useState(false);
  const [manualTotal, setManualTotal] = useState(0);

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
    bookingId: '',
  });

  // Load Edit Data or Draft
  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData({
          type: editData.type,
          amount: editData.amount.toString(),
          category: editData.category || '',
          description: editData.description || '',
          paymentMethod: editData.paymentMethod || 'transfer',
          customerId: editData.customerId || '',
          customerName: editData.customerName || editData.customer?.name || '',
          vehicleId: '', // We don't easily have vehicle context from base transaction
          plateNumber: '',
          serviceType: '',
          bookingId: editData.bookingId || '',
        });
        setCart([]); // Clear cart for edits for now to avoid complexity
        setUseManualTotal(true);
        setManualTotal(editData.amount);
        setMotorSearch('');
        setSelectedMotor(null);
        setSearchQuery(editData.customer?.name || '');
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const draft = JSON.parse(saved);
            setFormData(prev => ({ ...prev, ...draft.formData }));
            setCart(draft.cart || []);
            setDiscountType(draft.discountType || 'nominal');
            setDiscountValue(draft.discountValue || 0);
            setUseManualTotal(draft.useManualTotal || false);
            setManualTotal(draft.manualTotal || 0);
            setSelectedMotor(draft.selectedMotor || null);
            setMotorSearch(draft.motorSearch || '');
            setSearchQuery(draft.customerName || '');
          } catch (e) {
            console.error('Failed to load draft', e);
          }
        }
      }
    }
  }, [isOpen, editData]);

  // Save Draft
  useEffect(() => {
    if (isOpen && formData.customerId && !editData) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        formData, cart, discountType, discountValue, useManualTotal, manualTotal, selectedMotor, motorSearch, customerName: searchQuery
      }));
    }
  }, [formData, cart, discountType, discountValue, useManualTotal, manualTotal, selectedMotor, motorSearch, isOpen, editData]);

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCart([]);
    setDiscountValue(0);
    setUseManualTotal(false);
    setManualTotal(0);
    setSelectedMotor(null);
    setMotorSearch('');
  };

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.customerId) {
      fetchCustomerBookings(formData.customerId);
    } else {
      setBookings([]);
    }
  }, [formData.customerId]);

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

  const fetchCustomerBookings = async (customerId: string) => {
    try {
      // Find customer phone for the API
      const customer = customers.find(c => c.id === customerId);
      if (!customer) return;

      const res = await fetch(`/api/bookings?customerPhone=${customer.phone}&limit=20`);
      const data = await res.json();
      if (data.success) {
        // Filter for active or unpaid bookings
        const activeBookings = data.data.filter((b: any) => 
          ['pending', 'in_progress', 'done'].includes(b.status) && 
          ['UNPAID', 'PARTIAL'].includes(b.paymentStatus || 'UNPAID')
        );
        setBookings(activeBookings);
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const filteredMotors = useMemo(() => {
    if (!motorSearch) return MOTOR_DATABASE.slice(0, 10);
    const q = motorSearch.toLowerCase();
    return MOTOR_DATABASE.filter(m => m.model.toLowerCase().includes(q)).slice(0, 10);
  }, [motorSearch]);

  const selectedCustomer = customers.find(c => c.id === formData.customerId);

  // Calculations
  const subtotal = useMemo(() =>
    cart.reduce((sum, item) => {
      if (item.service.name === 'Spot Repair') {
        return sum + ((item.spotCount || 1) * (item.spotPrice || 100000));
      }
      return sum + (item.manualPrice ?? item.autoPrice);
    }, 0), 
  [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percentage') return Math.round(subtotal * (discountValue / 100));
    return discountValue;
  }, [subtotal, discountType, discountValue]);

  const grandTotal = useManualTotal ? manualTotal : Math.max(0, subtotal - discountAmount);

  const handleSelectMotor = (motor: MotorModel) => {
    setSelectedMotor(motor);
    setMotorSearch(motor.model);
    setShowMotorDropdown(false);
    // Re-price cart
    setCart(prev => prev.map(item => ({
      ...item,
      autoPrice: getServicePrice(item.service, motor),
    })));
  };

  const toggleService = (service: ServiceItem) => {
    const exists = cart.find(i => i.service.name === service.name);
    if (exists) {
      setCart(prev => prev.filter(i => i.service.name !== service.name));
    } else {
      const price = getServicePrice(service, selectedMotor);
      const newItem: CartItem = { 
        service, 
        autoPrice: price, 
        manualPrice: null,
        ...(service.name === 'Spot Repair' ? { spotCount: 1, spotPrice: 100000 } : {})
      };
      setCart(prev => [...prev, newItem]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const finalServiceType = cart.map(i => i.service.name).join(', ') || formData.serviceType;
      const isNewCart = cart.length > 0;
      const finalDescription = isNewCart ? `[CAR] ${formData.description || finalServiceType}` : formData.description;

      const url = editData ? `/api/finance/${editData.id}` : '/api/finance';
      const method = editData ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          amount: grandTotal,
          serviceType: finalServiceType,
          description: finalDescription,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      if (!editData) clearDraft();
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
        bookingId: '',
      });
      setSearchQuery('');
      setBookings([]);
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert('Gagal menambah transaksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? "Edit Transaksi" : "Tambah Transaksi Baru"}>
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
                <div className="space-y-4 mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Booking Aktif (Belum Lunas)</label>
                    <div className="flex flex-col gap-2">
                      {bookings.length > 0 ? (
                        bookings.map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              const remaining = (b.subtotal || 0) - (b.amountPaid || 0);
                              setFormData({
                                ...formData,
                                bookingId: b.id,
                                amount: remaining > 0 ? remaining.toString() : '',
                                serviceType: b.serviceType,
                                plateNumber: b.plateNumber || '',
                                description: `Pembayaran Sisa Booking untuk ${b.serviceType}`,
                                category: 'Repaint',
                              });
                              setUseManualTotal(true);
                              setManualTotal(remaining);
                            }}
                            className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                              formData.bookingId === b.id
                                ? 'bg-teal-50 border-teal-500 shadow-sm'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-sm text-slate-800">{b.serviceType}</span>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                b.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {b.status}
                              </span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-[11px] text-slate-500 font-medium">
                                {b.plateNumber || 'Tanpa Plat'} • {b.bookingDate}
                              </span>
                              <span className="text-[11px] font-bold text-teal-600">
                                Sisa: Rp {((b.subtotal || 0) - (b.amountPaid || 0)).toLocaleString()}
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="text-[11px] text-slate-400 italic py-1 px-1">Tidak ada booking aktif untuk pelanggan ini.</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Model Motor</label>
                    <div className="relative">
                      <input 
                        value={motorSearch}
                        onChange={e => { setMotorSearch(e.target.value); setShowMotorDropdown(true); }}
                        onFocus={() => setShowMotorDropdown(true)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-[13px] font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                        placeholder="Cari: NMax, Vario..." 
                      />
                      {showMotorDropdown && filteredMotors.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                          {filteredMotors.map(m => (
                            <button key={m.model} type="button" onClick={() => handleSelectMotor(m)}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 font-bold border-b border-slate-50 last:border-0">
                              {m.model}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Pilih Kendaraan Terdaftar</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedCustomer.vehicles.map(v => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, vehicleId: v.id, plateNumber: v.plateNumber || '' });
                            setMotorSearch(v.modelName);
                            
                            // NEW: Find matching motor in database to trigger auto-price
                            const motorMatch = MOTOR_DATABASE.find(m => 
                              m.model.toLowerCase().includes(v.modelName.toLowerCase()) ||
                              v.modelName.toLowerCase().includes(m.model.toLowerCase())
                            );
                            if (motorMatch) {
                              handleSelectMotor(motorMatch);
                            } else {
                              setSelectedMotor(null);
                            }
                          }}
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
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Plat Nomor"
                placeholder="B 1234 AB"
                value={formData.plateNumber}
                onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value })}
              />
              <Input
                label="Servis (Opsional)"
                placeholder="Servis Tambahan"
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
              />
            </div>

            {/* NEW: Basket / Cart Section */}
            <div className="space-y-3 p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
                <span>🛒 Keranjang Servis</span>
                <span className="text-teal-400">{cart.length} item</span>
              </label>
              
              <div className="flex flex-wrap gap-2">
                {SERVICES.map(svc => (
                  <button
                    key={svc.name}
                    type="button"
                    onClick={() => toggleService(svc)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${
                      cart.find(i => i.service.name === svc.name)
                        ? 'bg-teal-500 border-teal-400 text-white shadow-lg'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {svc.name}
                  </button>
                ))}
              </div>

              {cart.length > 0 && (
                <div className="space-y-2 mt-4 pt-4 border-t border-slate-800">
                  {cart.map(item => {
                    const isSpot = item.service.name === 'Spot Repair';
                    return (
                      <div key={item.service.name} className="flex flex-col gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                        <div className="flex justify-between items-center text-[12px]">
                          <span className="text-slate-300 font-bold">{item.service.name}</span>
                          <button type="button" onClick={() => toggleService(item.service)} className="text-slate-500 hover:text-red-400 text-sm">✕</button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {isSpot ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input 
                                type="number" 
                                min={1} 
                                value={item.spotCount || 1}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 1;
                                  setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, spotCount: val } : i));
                                }}
                                className="w-12 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-center text-white text-[11px]"
                              />
                              <span className="text-slate-500 text-[10px]">spot ×</span>
                              <input 
                                type="number" 
                                value={item.spotPrice || 100000}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, spotPrice: val } : i));
                                }}
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-teal-400 font-mono font-bold text-[11px]"
                              />
                            </div>
                          ) : (
                            <input 
                              type="number"
                              value={item.manualPrice ?? item.autoPrice}
                              onChange={e => {
                                const val = parseInt(e.target.value) || 0;
                                setCart(prev => prev.map(i => i.service.name === item.service.name ? { ...i, manualPrice: val } : i));
                              }}
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-teal-400 font-mono font-bold text-[12px]"
                            />
                          )}
                          <div className="text-[12px] font-mono font-bold text-white min-w-[80px] text-right">
                            {formatRupiah(isSpot ? (item.spotCount || 1) * (item.spotPrice || 100000) : (item.manualPrice ?? item.autoPrice))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-3 space-y-2">
                    <div className="flex justify-between text-[11px] text-slate-400 font-black uppercase">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatRupiah(subtotal)}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <select 
                        value={discountType} 
                        onChange={e => setDiscountType(e.target.value as any)}
                        className="bg-slate-800 border border-slate-700 rounded-lg text-[10px] text-slate-300 px-1 py-1"
                      >
                        <option value="nominal">IDR</option>
                        <option value="percentage">%</option>
                      </select>
                      <input 
                        type="number" 
                        value={discountValue || ''} 
                        onChange={e => setDiscountValue(parseInt(e.target.value) || 0)}
                        placeholder="Diskon"
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-[12px] text-white"
                      />
                      {discountAmount > 0 && <span className="text-red-400 text-[11px] font-bold">-{formatRupiah(discountAmount)}</span>}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={useManualTotal} onChange={e => setUseManualTotal(e.target.checked)} className="size-3 rounded border-slate-700 bg-slate-800" />
                        <span className="text-[10px] font-black text-amber-500 uppercase">Special Price</span>
                      </label>
                      {useManualTotal && (
                        <input 
                          type="number" 
                          value={manualTotal || ''} 
                          onChange={e => setManualTotal(parseInt(e.target.value) || 0)}
                          className="flex-1 bg-amber-900/30 border border-amber-700 rounded-lg px-2 py-1 text-right text-[12px] text-amber-400 font-bold"
                        />
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-3 mt-2 border-t border-slate-800">
                      <span className="text-[13px] font-black text-white uppercase tracking-wider">Total</span>
                      <span className="text-[18px] font-black text-teal-400 font-mono">{formatRupiah(grandTotal)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {formData.type === 'expense' && (
          <Input
            label="Nominal (IDR)"
            type="number"
            placeholder="Contoh: 500000"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />
        )}

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
