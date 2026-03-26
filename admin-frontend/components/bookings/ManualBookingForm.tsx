'use client';

import { useState, useMemo } from 'react';
import { ApiClient } from '@/lib/api/client';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import {
  MOTOR_DATABASE, SERVICES, CATEGORY_LABELS,
  getServicePrice, formatRupiah,
  type MotorModel, type ServiceItem,
} from '@/lib/data/pricing';

interface CartItem {
  service: ServiceItem;
  autoPrice: number;
  manualPrice: number | null;
  spotCount: number;
  spotPrice: number;
}

interface ManualBookingFormProps {
  initialData?: { customerName?: string; customerPhone?: string };
  allConversations?: Conversation[];
  apiClient: ApiClient;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ManualBookingForm({
  initialData, allConversations, apiClient, onSuccess, onCancel,
}: ManualBookingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer & booking info
  const [customerName, setCustomerName] = useState(initialData?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(initialData?.customerPhone || '');
  const [invoiceName, setInvoiceName] = useState('');
  const [motorSearch, setMotorSearch] = useState('');
  const [selectedMotor, setSelectedMotor] = useState<MotorModel | null>(null);
  const [platNomor, setPlatNomor] = useState('');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [homeService, setHomeService] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Discount
  const [discountType, setDiscountType] = useState<'percentage' | 'nominal'>('nominal');
  const [discountValue, setDiscountValue] = useState(0);

  // Manual total override
  const [useManualTotal, setUseManualTotal] = useState(false);
  const [manualTotal, setManualTotal] = useState(0);

  // DP
  const [dpAmount, setDpAmount] = useState(0);

  // Motor search/filter
  const [showMotorDropdown, setShowMotorDropdown] = useState(false);
  const filteredMotors = useMemo(() => {
    if (!motorSearch) return MOTOR_DATABASE.slice(0, 20);
    const q = motorSearch.toLowerCase();
    return MOTOR_DATABASE.filter(m => m.model.toLowerCase().includes(q)).slice(0, 20);
  }, [motorSearch]);

  // Plate auto-suggest
  const [showPlateDropdown, setShowPlateDropdown] = useState(false);
  const [plateSuggestions, setPlateSuggestions] = useState<Array<{id: string, modelName: string, plateNumber: string}>>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<{id: string, modelName: string, plateNumber: string} | null>(null);

  // Search for existing vehicle by plate number
  const searchVehicleByPlate = async (plate: string) => {
    if (plate.length < 3) {
      setPlateSuggestions([]);
      setShowPlateDropdown(false);
      return;
    }

    try {
      const res = await fetch(`/api/vehicles?q=${encodeURIComponent(plate)}`);
      const data = await res.json();
      if (data.success && data.vehicles) {
        setPlateSuggestions(data.vehicles.slice(0, 5));
        setShowPlateDropdown(data.vehicles.length > 0);
      }
    } catch (error) {
      console.error('Error searching vehicles:', error);
    }
  };

  // Handle plate number change
  const handlePlateChange = (value: string) => {
    setPlatNomor(value.toUpperCase());
    searchVehicleByPlate(value);
    
    // Clear selected vehicle if plate doesn't match
    if (selectedVehicle && !value.includes(selectedVehicle.plateNumber)) {
      setSelectedVehicle(null);
    }
  };

  // Select vehicle from suggestions
  const handleSelectVehicle = (vehicle: {id: string, modelName: string, plateNumber: string}) => {
    setSelectedVehicle(vehicle);
    setPlatNomor(vehicle.plateNumber);
    
    // Auto-fill motor model
    const motorMatch = MOTOR_DATABASE.find(m => 
      m.model.toLowerCase().includes(vehicle.modelName.toLowerCase()) ||
      vehicle.modelName.toLowerCase().includes(m.model.toLowerCase())
    );
    if (motorMatch) {
      setSelectedMotor(motorMatch);
      setMotorSearch(motorMatch.model);
    } else {
      setMotorSearch(vehicle.modelName);
    }
    
    setShowPlateDropdown(false);
  };

  // Calculations
  const subtotal = useMemo(() =>
    cart.reduce((sum, item) => {
      if (item.service.name === 'Spot Repair') return sum + (item.spotCount * item.spotPrice);
      return sum + (item.manualPrice ?? item.autoPrice);
    }, 0), [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percentage') return Math.round(subtotal * (discountValue / 100));
    return discountValue;
  }, [subtotal, discountType, discountValue]);

  const grandTotal = useManualTotal ? manualTotal : Math.max(0, subtotal - discountAmount);

  // Handlers
  const handleSelectCustomer = (id: string) => {
    const c = allConversations?.find(x => x.id === id);
    if (c) { setCustomerName(c.customerName); setCustomerPhone(c.customerPhone); }
  };

  const handleSelectMotor = (motor: MotorModel) => {
    setSelectedMotor(motor);
    setMotorSearch(motor.model);
    setShowMotorDropdown(false);
    // Re-price existing cart items
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
      setCart(prev => [...prev, {
        service,
        autoPrice: price,
        manualPrice: null,
        spotCount: 1,
        spotPrice: 100000,
      }]);
    }
  };

  const updateCartItem = (name: string, update: Partial<CartItem>) => {
    setCart(prev => prev.map(i => i.service.name === name ? { ...i, ...update } : i));
  };

  const isInCart = (name: string) => cart.some(i => i.service.name === name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) { alert('Pilih minimal 1 layanan'); return; }
    if (!selectedMotor) { alert('Pilih model motor'); return; }
    setIsSubmitting(true);
    try {
      const serviceName = cart.map(i => i.service.name).join(', ');
      const vehicleInfo = `${selectedMotor.model}${platNomor ? ` (${platNomor})` : ''}`;
      const finalTotal = grandTotal;

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName, customerPhone, invoiceName,
          serviceName, bookingDate, bookingTime,
          vehicleInfo, notes, subtotal: finalTotal,
          dpAmount, homeService,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat booking');

      // Auto-send invoice
      try {
        await fetch('/api/bookings/invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType: 'invoice',
            customerName: invoiceName || customerName,
            customerPhone,
            motorDetails: vehicleInfo,
            items: cart.map(i => {
              const p = i.service.name === 'Spot Repair'
                ? i.spotCount * i.spotPrice
                : (i.manualPrice ?? i.autoPrice);
              return `${i.service.name}: ${p}`;
            }).join('\n'),
            totalAmount: finalTotal,
            amountPaid: dpAmount,
            notes,
            bookingDate,
          }),
        });
      } catch { console.warn('Invoice sending failed, booking was still created'); }

      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Gagal membuat booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none transition-all placeholder:text-slate-300";
  const labelClass = "text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 px-0.5";

  const groupedServices = SERVICES.reduce((acc, svc) => {
    if (!acc[svc.category]) acc[svc.category] = [];
    acc[svc.category].push(svc);
    return acc;
  }, {} as Record<string, ServiceItem[]>);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      {/* Customer Selector */}
      {allConversations && allConversations.length > 0 && (
        <div className="space-y-1 pb-3 border-b border-slate-100">
          <label className={`${labelClass} !text-teal-600`}>Pilih Dari Daftar Chat</label>
          <select onChange={(e) => handleSelectCustomer(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 text-white border-none rounded-xl text-[13px] font-bold focus:ring-2 focus:ring-teal-500/20 outline-none cursor-pointer">
            <option value="">-- Pilih Customer --</option>
            {allConversations.map(c => (
              <option key={c.id} value={c.id}>{c.customerName || 'No Name'} ({c.customerPhone})</option>
            ))}
          </select>
        </div>
      )}

      {/* Name + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>Nama Pelanggan</label>
          <input required value={customerName} onChange={e => setCustomerName(e.target.value)} className={inputClass} placeholder="Budi" />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>No. WhatsApp</label>
          <input required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className={`${inputClass} font-mono`} placeholder="62812345678" />
        </div>
      </div>
      <div className="space-y-1">
        <label className={`${labelClass} !text-blue-500`}>Nama di Invoice <span className="text-slate-300 normal-case tracking-normal font-medium">(opsional)</span></label>
        <input value={invoiceName} onChange={e => setInvoiceName(e.target.value)} className={`${inputClass} !border-blue-200 !bg-blue-50/30`} placeholder="Kosongkan jika sama" />
      </div>

      {/* Motor Selector */}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1 relative">
          <label className={`${labelClass} !text-amber-600`}>Model Motor</label>
          <input required value={motorSearch}
            onChange={e => { setMotorSearch(e.target.value); setShowMotorDropdown(true); setSelectedMotor(null); }}
            onFocus={() => setShowMotorDropdown(true)}
            className={`${inputClass} !border-amber-200 !bg-amber-50/30`}
            placeholder="Cari: Vario, NMax, CBR..." />
          {showMotorDropdown && filteredMotors.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto">
              {filteredMotors.map(m => (
                <button key={m.model} type="button" onClick={() => handleSelectMotor(m)}
                  className="w-full px-3 py-2 text-left text-[12px] hover:bg-teal-50 transition-colors flex justify-between items-center">
                  <span className="font-bold text-slate-700">{m.model}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Svc: {m.service_size} | Rpt: {m.repaint_size}
                  </span>
                </button>
              ))}
            </div>
          )}
          {selectedMotor && (
            <p className="text-[10px] mt-1 font-bold text-amber-600">
              ✓ Size Detailing: {selectedMotor.service_size} | Repaint: {selectedMotor.repaint_size}
            </p>
          )}
        </div>
        <div className="space-y-1 relative">
          <label className={labelClass}>Plat Nomor</label>
          <input 
            value={platNomor} 
            onChange={e => handlePlateChange(e.target.value)}
            className={`${inputClass} w-32 font-mono uppercase`} 
            placeholder="B 1234 XY"
          />
          {showPlateDropdown && plateSuggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto">
              <div className="px-3 py-2 text-[10px] text-slate-400 border-b bg-slate-50">
                Kendaraan ditemukan:
              </div>
              {plateSuggestions.map(v => (
                <button 
                  key={v.id} 
                  type="button" 
                  onClick={() => handleSelectVehicle(v)}
                  className="w-full px-3 py-2 text-left text-[12px] hover:bg-teal-50 transition-colors flex justify-between items-center border-b border-slate-50 last:border-0"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-700">{v.plateNumber}</span>
                    <span className="text-slate-400 ml-2">{v.modelName}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {selectedVehicle && (
            <p className="text-[10px] mt-1 font-bold text-teal-600">
              ✓ {selectedVehicle.modelName}
            </p>
          )}
        </div>
      </div>

      {/* Service Selector */}
      <div className="space-y-2">
        <label className={labelClass}>Pilih Layanan</label>
        {Object.entries(groupedServices).map(([cat, services]) => (
          <div key={cat}>
            <p className="text-[11px] font-bold text-slate-500 mb-1.5">{CATEGORY_LABELS[cat] || cat}</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {services.map(svc => {
                const inCart = isInCart(svc.name);
                const price = getServicePrice(svc, selectedMotor);
                const showPrice = svc.pricingType !== 'manual' && price > 0;
                return (
                  <button key={svc.name} type="button" onClick={() => toggleService(svc)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                      inCart
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-700'
                    }`}>
                    {inCart && '✓ '}{svc.name}
                    {showPrice && <span className="ml-1 opacity-75 text-[10px]">{formatRupiah(price)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Cart / Line Items */}
      {cart.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-200">
          <p className={`${labelClass} !text-teal-600`}>🛒 Keranjang ({cart.length} item)</p>
          {cart.map(item => {
            const isSpot = item.service.name === 'Spot Repair';
            const lineTotal = isSpot ? item.spotCount * item.spotPrice : (item.manualPrice ?? item.autoPrice);
            return (
              <div key={item.service.name} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-100">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-slate-700 truncate">{item.service.name}</p>
                  {isSpot && (
                    <div className="flex items-center gap-2 mt-1">
                      <input type="number" min={1} value={item.spotCount}
                        onChange={e => updateCartItem(item.service.name, { spotCount: parseInt(e.target.value) || 1 })}
                        className="w-14 px-2 py-1 border rounded-lg text-[11px] text-center" />
                      <span className="text-[10px] text-slate-400">spot ×</span>
                      <input type="number" step={25000} value={item.spotPrice}
                        onChange={e => updateCartItem(item.service.name, { spotPrice: parseInt(e.target.value) || 75000 })}
                        className="w-24 px-2 py-1 border rounded-lg text-[11px] text-right font-mono" />
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-black text-teal-700 font-mono">{formatRupiah(lineTotal)}</p>
                  {!isSpot && item.autoPrice > 0 && (
                    <p className="text-[9px] text-slate-400">auto</p>
                  )}
                </div>
                <button type="button" onClick={() => toggleService(item.service)}
                  className="text-red-400 hover:text-red-600 text-[14px] font-bold flex-shrink-0 ml-1">✕</button>
              </div>
            );
          })}

          {/* Subtotal */}
          <div className="border-t border-dashed border-slate-300 pt-2 mt-2 space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-slate-500 font-medium">Subtotal</span>
              <span className="font-bold font-mono text-slate-700">{formatRupiah(subtotal)}</span>
            </div>

            {/* Discount */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-medium flex-shrink-0">Diskon</span>
              <select value={discountType} onChange={e => setDiscountType(e.target.value as 'percentage' | 'nominal')}
                className="px-2 py-1 border rounded-lg text-[11px] bg-white font-bold">
                <option value="nominal">Rp</option>
                <option value="percentage">%</option>
              </select>
              <input type="number" min={0} value={discountValue || ''}
                onChange={e => setDiscountValue(parseInt(e.target.value) || 0)}
                className="w-24 px-2 py-1 border rounded-lg text-[11px] text-right font-mono" placeholder="0" />
              {discountAmount > 0 && (
                <span className="text-[11px] font-bold text-red-500 ml-auto">-{formatRupiah(discountAmount)}</span>
              )}
            </div>

            {/* Manual Total Override */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                <input type="checkbox" checked={useManualTotal} onChange={e => setUseManualTotal(e.target.checked)}
                  className="size-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500/20" />
                <span className="text-[10px] font-bold text-amber-600 uppercase">Harga Spesial</span>
              </label>
              {useManualTotal && (
                <input type="number" min={0} value={manualTotal || ''}
                  onChange={e => setManualTotal(parseInt(e.target.value) || 0)}
                  className="flex-1 px-2 py-1 border-2 border-amber-300 bg-amber-50 rounded-lg text-[12px] text-right font-mono font-bold" placeholder="0" />
              )}
            </div>

            {/* Grand Total */}
            <div className="flex justify-between text-[14px] bg-teal-600 text-white rounded-lg px-3 py-2 -mx-1">
              <span className="font-bold">TOTAL</span>
              <span className="font-black font-mono">{formatRupiah(grandTotal)}</span>
            </div>

            {/* DP */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-amber-600 font-bold flex-shrink-0">DP (Uang Muka)</span>
              <input type="number" min={0} value={dpAmount || ''}
                onChange={e => setDpAmount(parseInt(e.target.value) || 0)}
                className="flex-1 px-2 py-1 border-2 border-amber-200 bg-amber-50/50 rounded-lg text-[12px] text-right font-mono" placeholder="0" />
            </div>
            {dpAmount > 0 && grandTotal > 0 && (
              <p className="text-[10px] text-slate-400 text-right">Sisa: {formatRupiah(grandTotal - dpAmount)}</p>
            )}
          </div>
        </div>
      )}

      {/* Date, Time, Home Service, Notes */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={labelClass}>Tanggal</label>
          <input required type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} className={inputClass} />
        </div>
        <div className="space-y-1">
          <label className={labelClass}>Jam</label>
          <input required type="time" value={bookingTime} onChange={e => setBookingTime(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <label htmlFor="hs-check" className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
          <input type="checkbox" id="hs-check" checked={homeService} onChange={e => setHomeService(e.target.checked)}
            className="size-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/20" />
          <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">Home Service</span>
        </label>
        <input value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} placeholder="Catatan: warna custom, kondisi baret, dll..." />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1 sticky bottom-0 bg-white pb-1">
        <button type="button" onClick={onCancel} disabled={isSubmitting}
          className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 font-black text-[12px] uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50">
          Batal
        </button>
        <button type="submit" disabled={isSubmitting || cart.length === 0}
          className="flex-[2] h-11 rounded-xl bg-teal-600 text-white hover:bg-teal-700 font-black text-[12px] uppercase tracking-wider shadow-lg shadow-teal-600/25 transition-all active:scale-95 disabled:opacity-50">
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Membuat & Mengirim Invoice...
            </span>
          ) : (
            `🗓️ Buat Booking ${grandTotal > 0 ? `(${formatRupiah(grandTotal)})` : ''}`
          )}
        </button>
      </div>
    </form>
  );
}
