'use client';

import { useState, useMemo, useEffect } from 'react';
import { ApiClient } from '@/lib/api/client';
import { Conversation } from '@/lib/hooks/useRealtimeConversations';
import {
  MOTOR_DATABASE, SERVICES,
  getServicePrice, formatRupiah,
  type MotorModel, type ServiceItem,
} from '@/lib/data/pricing';
import { cn } from '@/lib/utils';
import { 
  X, Search, Check, Bolt, Smartphone, History, Verified, 
  ChevronDown, PlusCircle, FileText, Wrench, HelpCircle, 
  Minus, Plus, Trash2, Edit 
} from 'lucide-react';
import Image from 'next/image';

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
}

interface ManualBookingFormProps {
  apiClient: ApiClient;
  allConversations: Conversation[];
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: any; // To support edit
  onDelete?: (id: string) => Promise<any>;
  onUpdate?: (id: string, updates: any) => Promise<any>;
}

interface CartItem {
  name: string;
  price: number;
}

export default function ManualBookingForm({
  apiClient, allConversations, onSuccess, onCancel, initialData, onDelete, onUpdate
}: ManualBookingFormProps) {
  const isEdit = !!initialData;
  // --- FORM STATE ---
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [invoiceName, setInvoiceName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [motorcycleModel, setMotorcycleModel] = useState<MotorModel | null>(null);
  const [platNomor, setPlatNomor] = useState('');
  const [activeTab, setActiveTab] = useState<'repaint' | 'detailing' | 'coating'>('repaint');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Custom Service state
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState<number>(0);

  // Spot Repair state
  const [spotCount, setSpotCount] = useState<number>(0);
  const [spotPrice, setSpotPrice] = useState<number>(100000);

  // Discount
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Logistics & Billing
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState('10:00');
  const [homeService, setHomeService] = useState(false);
  const [dpRequired, setDpRequired] = useState(true);
  const [nominalDP, setNominalDP] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Transfer BCA');
  const [sendInvoiceWA, setSendInvoiceWA] = useState(false);

  // --- SMART SEARCH STATE ---
  const [foundVehicle, setFoundVehicle] = useState<{ model: string, owner: string, phone: string, plate: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // TAMBAHAN BARU: State khusus untuk mencegah tabrakan pencarian
  const [skipNextSearch, setSkipNextSearch] = useState(false);

  // --- SMART SEARCH LOGIC (Untuk ngetik manual) ---
  useEffect(() => {
    // 1. Jika tameng aktif (karena baru klik dari sidebar), DIAM SAJA!
    if (skipNextSearch) return;

    // 2. Jika input kosong, DIAM SAJA! (jangan reset card yang ada)
    if (!platNomor || platNomor.trim() === '') return;

    const searchVehicle = async () => {
      const cleanPlate = platNomor.replace(/\s+/g, '');
      if (cleanPlate.length >= 4) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/vehicles?q=${cleanPlate}`);
          const json = await res.json();
          if (json.success && json.vehicles && json.vehicles.length > 0) {
            const v = json.vehicles[0];
            setFoundVehicle({
              model: v.modelName,
              owner: v.customer?.name || 'Unknown',
              phone: v.customer?.phone || '',
              plate: v.plateNumber || platNomor
            });
          } else {
            setFoundVehicle(null);
          }
        } catch (err) {
          console.error('Smart search error:', err);
        } finally {
          setIsSearching(false);
        }
      } else if (platNomor.length > 0 && platNomor.length < 4) {
        setFoundVehicle(null);
      }
    };

    const timer = setTimeout(searchVehicle, 500);
    return () => clearTimeout(timer);
  }, [platNomor, skipNextSearch]); // Jangan lupa tambahkan skipNextSearch di dependency

  // --- INITIAL POPULATION FOR EDIT ---
  useEffect(() => {
    if (initialData) {
      setInvoiceName(initialData.customerName || '');
      setContactPhone(initialData.customerPhone || '');
      setPlatNomor(initialData.vehicleInfo?.split('(')[1]?.replace(')', '') || '');

      const modelName = initialData.vehicleInfo?.split(' (')[0];
      const model = MOTOR_DATABASE.find(m => m.model === modelName);
      if (model) setMotorcycleModel(model);

      if (initialData.bookingDate) setEntryDate(initialData.bookingDate);
      if (initialData.bookingTime) setTimeSlot(initialData.bookingTime);

      if (initialData.status) {
        const services = Array.isArray(initialData.services)
          ? initialData.services
          : (initialData.services?.split(' / ') || []);

        const newCart: CartItem[] = [];
        services.forEach((s: string) => {
          const found = SERVICES.find(srv => srv.name === s);
          if (found) {
            newCart.push({ name: found.name, price: getServicePrice(found, model) });
          } else if (!s.includes('Spot Repair')) {
            newCart.push({ name: s, price: 0 });
          }
        });
        setCart(newCart);

        if (initialData.services?.includes('Spot Repair')) {
          const match = initialData.services.match(/Spot Repair \((\d+) spots\)/);
          if (match) setSpotCount(parseInt(match[1]));
        }
      }

      setNominalDP(initialData.dpAmount || initialData.downPayment || 0);
      setDpRequired((initialData.dpAmount || initialData.downPayment) > 0);
      setHomeService(!!initialData.homeService);
    }
  }, [initialData]);

  // --- COMPUTED TOTALS ---
  const servicesTotal = useMemo(() => {
    const baseTotal = cart.reduce((sum, item) => sum + item.price, 0);
    const spotTotal = spotCount * spotPrice;
    return baseTotal + spotTotal;
  }, [cart, spotCount, spotPrice]);

  const computedDiscount = useMemo(() => {
    if (discountPercent > 0) return Math.round(servicesTotal * (discountPercent / 100));
    return discountAmount;
  }, [servicesTotal, discountPercent, discountAmount]);

  const finalTotal = Math.max(0, servicesTotal - computedDiscount);
  const remainingBalance = Math.max(0, finalTotal - nominalDP);

  // --- ACTIONS ---
  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    setContactPhone(conv.customerPhone);
    setInvoiceName(conv.customerName || '');

    // AKTIFKAN TAMENG: Jangan pedulikan perubahan platNomor setelah ini
    setSkipNextSearch(true);
    setPlatNomor('');

    // AUTO-SEARCH: Cari kendaraan pelanggan pakai No WA! (Bersihkan karakter non-digit)
    if (conv.customerPhone) {
      setIsSearching(true);
      const cleanSearch = conv.customerPhone.replace(/[^0-9]/g, '');
      try {
        const res = await fetch(`/api/vehicles?q=${cleanSearch}`);
        const json = await res.json();

        if (json.success && json.vehicles && json.vehicles.length > 0) {
          const v = json.vehicles[0];
          setFoundVehicle({
            model: v.modelName,
            owner: v.customer?.name || conv.customerName || 'Unknown',
            phone: v.customer?.phone || conv.customerPhone,
            plate: v.plateNumber || ''
          });
        } else {
          setFoundVehicle(null);
        }
      } catch (err) {
        console.error('Auto-search vehicle error:', err);
      } finally {
        setIsSearching(false);
        // MATIKAN TAMENG setelah pencarian dari sidebar selesai
        setTimeout(() => setSkipNextSearch(false), 500);
      }
    } else {
      setSkipNextSearch(false);
    }
  };

  const addServiceToCart = (service: ServiceItem) => {
    const price = getServicePrice(service, motorcycleModel);
    setCart(prev => {
      if (prev.find(i => i.name === service.name)) {
        return prev.filter(i => i.name !== service.name);
      }
      return [...prev, { name: service.name, price }];
    });
  };

  const addCustomService = () => {
    if (!customServiceName || customServicePrice <= 0) return;
    setCart(prev => [...prev, { name: customServiceName.toUpperCase(), price: customServicePrice }]);
    setCustomServiceName('');
    setCustomServicePrice(0);
  };

  const handleSubmit = async () => {
    if (!invoiceName || !contactPhone || !motorcycleModel) {
      alert('Mohon lengkapi info customer dan model motor.');
      return;
    }

    setIsSubmitting(true);
    try {
      const serviceSummary = [
        ...cart.map(i => i.name),
        spotCount > 0 ? `Spot Repair (${spotCount} spots)` : null
      ].filter(Boolean).join(', ');

      const payload = {
        customerName: invoiceName,
        customerPhone: contactPhone,
        serviceName: serviceSummary,
        bookingDate: entryDate,
        bookingTime: timeSlot,
        vehicleInfo: `${motorcycleModel.model} (${platNomor || '-'})`,
        subtotal: finalTotal,
        dpAmount: dpRequired ? nominalDP : 0,
        homeService,
        notes: `Layanan: ${serviceSummary} | DP: ${paymentMethod}`,
      };

      if (isEdit) {
        if (onUpdate) await onUpdate(initialData.id, payload);
      } else {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Gagal membuat booking');
      }

      if (sendInvoiceWA) {
        await fetch('/api/bookings/invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType: 'invoice',
            customerName: invoiceName,
            customerPhone: contactPhone,
            totalAmount: finalTotal,
            amountPaid: nominalDP,
          }),
        });
      }

      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !initialData?.id) return;
    if (confirm('APAKAH ANDA YAKIN INGIN MENGHAPUS BOOKING INI? DATA TIDAK DAPAT DIKEMBALIKAN.')) {
      setIsSubmitting(true);
      try {
        await onDelete(initialData.id);
        onSuccess();
      } catch (err: any) {
        alert(err.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const layoutProps = {
    isEdit, currentStep, setCurrentStep,
    selectedConversation, setSelectedConversation,
    invoiceName, setInvoiceName,
    contactPhone, setContactPhone,
    motorcycleModel, setMotorcycleModel,
    platNomor, setPlatNomor,
    activeTab, setActiveTab,
    cart, addServiceToCart,
    customServiceName, setCustomServiceName,
    customServicePrice, setCustomServicePrice,
    addCustomService,
    spotCount, setSpotCount,
    spotPrice, setSpotPrice,
    discountPercent, setDiscountPercent,
    discountAmount, setDiscountAmount,
    entryDate, setEntryDate,
    timeSlot, setTimeSlot,
    homeService, setHomeService,
    dpRequired, setDpRequired,
    nominalDP, setNominalDP,
    isSubmitting, paymentMethod, setPaymentMethod,
    sendInvoiceWA, setSendInvoiceWA,
    foundVehicle, setFoundVehicle, isSearching,
    handleSubmit, handleDelete, handleSelectConversation,
    onCancel, servicesTotal, computedDiscount, finalTotal, remainingBalance,
    allConversations, skipNextSearch, setSkipNextSearch
  };

  const isMobile = useMediaQuery('(max-width: 768px)');
  return isMobile ? <MobileLayout {...layoutProps} /> : <DesktopLayout {...layoutProps} />;
}

// ── MOBILE LAYOUT ──
function MobileLayout(props: any) {
  const {
    isEdit, selectedConversation, invoiceName, setInvoiceName,
    contactPhone, setContactPhone, motorcycleModel, setMotorcycleModel,
    platNomor, setPlatNomor, activeTab, setActiveTab, cart, addServiceToCart,
    customServiceName, setCustomServiceName, customServicePrice, setCustomServicePrice,
    addCustomService, spotCount, setSpotCount, spotPrice, setSpotPrice,
    discountPercent, setDiscountPercent, discountAmount, setDiscountAmount,
    dpRequired, setDpRequired, nominalDP, setNominalDP, paymentMethod, setPaymentMethod,
    sendInvoiceWA, setSendInvoiceWA, foundVehicle, isSearching,
    handleSubmit, onCancel, servicesTotal, computedDiscount, finalTotal,
    allConversations, isSubmitting, handleSelectConversation,
    skipNextSearch, setSkipNextSearch
  } = props;

  const isSpotRepairSelected = cart.some(item => item.name === 'Spot Repair');

  return (
    <div className="fixed inset-0 z-[60] bg-[#131313] flex flex-col font-body h-screen overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-neutral-950/60 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-6 h-16">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="text-white active:scale-95 transition-all">
            <X className="text-[#FFFF00] size-6" />
          </button>
          <div className="flex flex-col">
            <h1 className="font-spartan italic font-bold text-white tracking-tighter leading-none uppercase">
                {isEdit ? 'EDIT_MISSION' : 'NEW_MISSION'}
            </h1>
            <span className="text-[10px] text-neutral-400 font-headline tracking-widest uppercase">booking input interface</span>
          </div>
        </div>
        <HelpCircle className="text-neutral-400 size-5" />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-8 space-y-8 no-scrollbar scroll-smooth pb-40">
        {/* Section 1: Customer & Invoice */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-[#FFFF00]"></span>
            <h2 className="font-spartan text-sm uppercase tracking-widest text-white">Customer & Invoice</h2>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-[10px] font-headline text-slate-500 uppercase mb-1 ml-1">WhatsApp Quick Select</label>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {allConversations.slice(0, 5).map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={cn(
                      "flex-shrink-0 p-3 flex flex-col gap-1 border transition-all rounded-sm min-w-32",
                      selectedConversation?.id === conv.id 
                        ? "bg-[#FFFF00]/10 border-[#FFFF00]/50" 
                        : "bg-surface-container-low border-white/5"
                    )}
                  >
                    <p className="text-[10px] font-bold text-white uppercase truncate text-left">{conv.customerName || 'No Name'}</p>
                    <p className="text-[8px] text-slate-500">Active Chat</p>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-4 bg-neutral-900/40 p-4 rounded-sm border border-white/5">
              <div className="group">
                <label className="block text-[10px] font-headline text-slate-500 uppercase mb-1">Invoice name (Display Name)</label>
                <input 
                  value={invoiceName}
                  onChange={e => setInvoiceName(e.target.value)}
                  className="w-full bg-neutral-900 border-none focus:ring-0 text-sm py-3 px-4 text-white placeholder-neutral-700" 
                  type="text"
                />
              </div>
              <div className="group">
                <label className="block text-[10px] font-headline text-slate-500 uppercase mb-1">Contact Phone</label>
                <input 
                  value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)}
                  className="w-full bg-neutral-900 border-none focus:ring-0 text-sm py-3 px-4 text-white placeholder-neutral-700 font-mono" 
                  type="tel"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Technical Specs */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-[#FFFF00]"></span>
            <h2 className="font-spartan text-sm uppercase tracking-widest text-white">Technical Specs</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-headline text-slate-500 uppercase ml-1">Motorcycle Model</label>
              <div className="relative">
                <select
                  value={motorcycleModel?.model || ""}
                  onChange={e => {
                    const model = MOTOR_DATABASE.find(m => m.model === e.target.value);
                    if (model) setMotorcycleModel(model);
                  }}
                  className="w-full bg-neutral-900 border-none focus:ring-1 focus:ring-[#FFFF00]/50 text-xs py-3 px-3 text-white appearance-none"
                >
                  <option value="">SELECT MODEL</option>
                  {MOTOR_DATABASE.map(m => (
                    <option key={m.model} value={m.model}>{m.model}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 size-3 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-headline text-slate-500 uppercase ml-1">Plate Number</label>
              <div className="relative">
                <input 
                  value={platNomor}
                  onChange={e => setPlatNomor(e.target.value.toUpperCase())}
                  className="w-full bg-neutral-900 border-none focus:ring-1 focus:ring-[#FFFF00]/50 text-xs py-3 px-4 text-white uppercase font-bold tracking-widest" 
                  type="text" 
                />
                <div className="absolute right-2 bottom-[-14px]">
                  <span className="text-[8px] font-headline text-[#FFFF00] bg-black/80 px-1 py-0.5 rounded-sm border border-[#FFFF00]/30 shadow-lg">SMART SEARCH</span>
                </div>
              </div>
            </div>
          </div>
          
          {foundVehicle && (
            <div className="p-3 bg-[#FFFF00]/5 border border-[#FFFF00]/20 flex items-center justify-between rounded-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3">
                <Bolt className="size-4 text-[#FFFF00]" />
                <div>
                  <p className="text-[10px] font-bold text-white uppercase">{foundVehicle.model}</p>
                  <p className="text-[9px] text-zinc-500 uppercase">OWNER: {foundVehicle.owner}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const model = MOTOR_DATABASE.find(m => m.model.toLowerCase() === foundVehicle.model.toLowerCase() || foundVehicle.model.toLowerCase().includes(m.model.toLowerCase()));
                  if (model) setMotorcycleModel(model);
                  if (!invoiceName) setInvoiceName(foundVehicle.owner);
                  if (!contactPhone) setContactPhone(foundVehicle.phone);
                  setPlatNomor(foundVehicle.plate);
                }}
                className="px-3 py-1 bg-[#FFFF00] text-black font-headline text-[9px] font-black uppercase"
              >
                USE_MISSION_DATA
              </button>
            </div>
          )}
        </section>

        {/* Section 3: Service Selection */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-[#FFFF00]"></span>
            <h2 className="font-spartan text-sm uppercase tracking-widest text-white">Service Selection</h2>
          </div>
          
          <div className="flex gap-1 bg-neutral-900/50 p-1 rounded-sm border border-white/5">
            {(['repaint', 'detailing', 'coating'] as const).map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-2 text-[10px] font-spartan font-bold tracking-tighter uppercase transition-all",
                  activeTab === tab ? "bg-[#FFFF00] text-black" : "text-neutral-500"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {SERVICES.filter(s => s.category === activeTab).map(service => {
              const selected = cart.some(i => i.name === service.name);
              const price = getServicePrice(service, motorcycleModel);
              return (
                <div 
                  key={service.name}
                  onClick={() => addServiceToCart(service)}
                  className={cn(
                    "p-4 flex items-center justify-between transition-all border border-white/5 rounded-sm",
                    selected ? "bg-neutral-800 border-r-4 border-r-[#FFFF00]" : "bg-neutral-900/40 opacity-70"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-sm", selected ? "bg-[#FFFF00]/10" : "bg-neutral-800")}>
                      <Bolt className={cn("size-4", selected ? "text-[#FFFF00]" : "text-neutral-400")} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white uppercase tracking-tight">{service.name}</p>
                      <p className={cn("text-[9px] font-headline", selected ? "text-[#FFFF00]" : "text-neutral-500")}>
                        IDR {price > 0 ? (price / 1000).toFixed(0) + 'K' : 'Manual'}
                      </p>
                    </div>
                  </div>
                  {selected ? <Check className="text-[#FFFF00] size-4" /> : <div className="size-4 border border-neutral-700 rounded-full" />}
                </div>
              );
            })}

            {/* Custom Service */}
            <div className="bg-neutral-900/20 p-4 border border-dashed border-neutral-800 space-y-3 rounded-sm">
              <div className="flex items-center gap-2">
                <PlusCircle className="text-[#FFFF00] size-4" />
                <p className="text-[10px] font-bold text-neutral-400 uppercase">ADD CUSTOM SERVICE</p>
              </div>
              <div className="flex gap-2">
                <input 
                  value={customServiceName}
                  onChange={e => setCustomServiceName(e.target.value)}
                  className="flex-1 bg-neutral-900 border-none focus:ring-0 text-xs py-2 px-3 text-white placeholder-neutral-700 italic" 
                  placeholder="Service Name" 
                />
                <input 
                  value={customServicePrice || ''}
                  onChange={e => setCustomServicePrice(Number(e.target.value))}
                  className="w-20 bg-neutral-900 border-none focus:ring-0 text-xs py-2 px-3 text-white placeholder-neutral-700 italic text-right font-mono" 
                  placeholder="Price" 
                />
                <button onClick={addCustomService} className="bg-[#FFFF00] text-black px-3 rounded-sm active:scale-95 transition-all">
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            {/* Manual Adjust - Only show if Spot Repair is selected */}
            {isSpotRepairSelected && (
              <div className="bg-neutral-900/40 p-4 border border-white/5 space-y-4 rounded-sm animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Edit className="text-neutral-500 size-4" />
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter italic">SPOT REPAIR / MANUAL ADJUST</p>
                  </div>
                  <div className="flex items-center gap-3 bg-neutral-900 px-2 py-1 rounded-sm border border-white/10">
                    <button onClick={() => setSpotCount(prev => Math.max(0, prev - 1))} className="text-neutral-500"><Minus size={14}/></button>
                    <span className="text-xs font-bold text-white font-mono">{spotCount.toString().padStart(2, '0')}</span>
                    <button onClick={() => setSpotCount(prev => prev + 1)} className="text-[#FFFF00]"><Plus size={14}/></button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 font-headline">IDR</span>
                  <input 
                    value={spotPrice || ''}
                    onChange={e => setSpotPrice(Number(e.target.value))}
                    className="w-full bg-neutral-900 border-none focus:ring-0 text-xs py-2 pl-10 pr-4 text-white placeholder-neutral-700 italic" 
                    placeholder="Price Field" 
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 4: Discount */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-[#FFFF00]"></span>
            <h2 className="font-spartan text-sm uppercase tracking-widest text-white">Discount Settings</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 bg-neutral-900/40 p-4 rounded-sm border border-white/5">
            <div className="space-y-1">
              <label className="block text-[9px] font-headline text-neutral-500 uppercase">Percentage (%)</label>
              <div className="relative">
                <input 
                  value={discountPercent || ''}
                  onChange={e => { setDiscountPercent(Number(e.target.value)); setDiscountAmount(0); }}
                  className="w-full bg-neutral-900 border-none focus:ring-0 text-sm py-2 px-3 text-white text-right font-mono" 
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] font-headline text-neutral-500 uppercase">Fixed Amount (Rp)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-neutral-500 font-headline">IDR</span>
                <input 
                  value={discountAmount || ''}
                  onChange={e => { setDiscountAmount(Number(e.target.value)); setDiscountPercent(0); }}
                  className="w-full bg-neutral-900 border-none focus:ring-0 text-sm py-2 pl-8 pr-3 text-white text-right font-mono" 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Logistics & Billing */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-4 bg-[#FFFF00]"></span>
            <h2 className="font-spartan text-sm uppercase tracking-widest text-white">Logistics & Billing</h2>
          </div>
          <div className="bg-neutral-900/40 p-4 rounded-sm border border-white/5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[9px] font-headline text-neutral-500 uppercase">Down Payment</label>
                <div className="flex bg-neutral-950 p-1 rounded-sm">
                  <button onClick={() => setDpRequired(true)} className={cn("flex-1 py-1.5 text-[10px] font-spartan font-bold rounded-sm transition-all", dpRequired ? "bg-[#FFFF00] text-black" : "text-neutral-500")}>YA</button>
                  <button onClick={() => setDpRequired(false)} className={cn("flex-1 py-1.5 text-[10px] font-spartan font-bold rounded-sm transition-all", !dpRequired ? "bg-[#FFFF00] text-black" : "text-neutral-500")}>TIDAK</button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[9px] font-headline text-neutral-500 uppercase">Nominal DP (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-neutral-500 font-headline">IDR</span>
                  <input 
                    value={nominalDP || ''}
                    onChange={e => setNominalDP(Number(e.target.value))}
                    className="w-full bg-neutral-950 border-none focus:ring-0 text-sm py-2 pl-8 pr-3 text-white text-right font-mono" 
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[9px] font-headline text-neutral-500 uppercase">Metode Pembayaran</label>
              <div className="relative">
                <select 
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full bg-neutral-950 border-none focus:ring-0 text-sm py-2.5 px-3 text-white appearance-none cursor-pointer font-body"
                >
                  <option>Tunai</option>
                  <option>Transfer BCA</option>
                  <option>QRIS</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 size-4 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="bg-neutral-800/80 p-5 space-y-3 relative overflow-hidden rounded-sm border border-[#FFFF00]/10">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-headline">Services total</span>
              <span className="text-white font-medium">{formatRupiah(servicesTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-headline">Discount</span>
              <span className="text-red-500 font-medium">- {formatRupiah(computedDiscount)}</span>
            </div>
            <div className="pt-3 mt-1 border-t border-white/10 flex justify-between items-end">
              <span className="text-[10px] text-neutral-400 font-spartan font-bold uppercase tracking-widest leading-none">Final Total</span>
              <span className="text-xl font-spartan font-bold text-[#FFFF00] leading-none">{formatRupiah(finalTotal)}</span>
            </div>
            <label className="flex items-center gap-3 pt-4 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={sendInvoiceWA}
                onChange={e => setSendInvoiceWA(e.target.checked)}
                className="size-5 rounded-sm border-2 border-[#FFFF00] bg-transparent text-[#FFFF00] focus:ring-0"
              />
              <span className="text-[10px] text-neutral-300 font-headline uppercase leading-none">Kirim invoice ke WhatsApp pelanggan</span>
            </label>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 p-4 bg-neutral-950 shadow-[0px_-24px_48px_rgba(0,0,0,0.4)] flex gap-2 pb-8 z-50">
        <button onClick={onCancel} className="flex-[0.3] flex flex-col items-center justify-center text-neutral-500 py-3 active:scale-95 transition-all">
          <X className="size-5" />
          <span className="font-spartan font-bold uppercase text-[10px] mt-1">CANCEL</span>
        </button>
        <button 
          onClick={handleSubmit}
          disabled={isSubmitting || cart.length === 0}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 bg-[#FFFF00] text-black py-4 active:scale-95 transition-all group disabled:opacity-50 disabled:grayscale",
          )}
        >
          {isSubmitting ? (
            <div className="animate-spin rounded-full size-5 border-2 border-black border-t-transparent" />
          ) : (
            <Bolt className="size-5 font-bold fill-current" />
          )}
          <span className="font-spartan font-bold uppercase text-[14px] tracking-tighter">
            {isSubmitting ? 'PROCESSING...' : isEdit ? 'UPDATE MISSION' : 'BUAT BOOKING'}
          </span>
        </button>
      </footer>
    </div>
  );
}

// ── DESKTOP LAYOUT ──
function DesktopLayout(props: any) {
  const {
    isEdit, currentStep, setCurrentStep,
    selectedConversation, invoiceName, setInvoiceName,
    contactPhone, setContactPhone, motorcycleModel, setMotorcycleModel,
    platNomor, setPlatNomor, activeTab, setActiveTab, cart, addServiceToCart,
    customServiceName, setCustomServiceName, customServicePrice, setCustomServicePrice,
    addCustomService, spotCount, setSpotCount, spotPrice, setSpotPrice,
    discountPercent, setDiscountPercent, discountAmount, setDiscountAmount,
    entryDate, setEntryDate, timeSlot, setTimeSlot, homeService, setHomeService,
    dpRequired, setDpRequired, nominalDP, setNominalDP, isSubmitting, paymentMethod, setPaymentMethod,
    sendInvoiceWA, setSendInvoiceWA, foundVehicle, setFoundVehicle, isSearching,
    handleSubmit, handleDelete, handleSelectConversation, onCancel,
    servicesTotal, computedDiscount, finalTotal, remainingBalance, allConversations,
    skipNextSearch, setSkipNextSearch
  } = props;

  const isSpotRepairSelected = cart.some(item => item.name === 'Spot Repair');

  return (
    <div className="w-full max-w-6xl mx-auto h-full max-h-[95vh] bg-[#0E0E0E] border border-white/5 shadow-[0px_24px_48px_rgba(0,0,0,0.4)] flex flex-col md:flex-row overflow-hidden font-body">


      {/* ── SIDEBAR KIRI: PROGRESS & QUICK ACCESS ── */}
      <aside className="w-full md:w-80 bg-[#1c1b1b] p-6 border-r border-white/5 flex flex-col gap-6 overflow-y-auto no-scrollbar shrink-0">
        <div className="mb-4">
          <h2 className="font-display text-3xl font-black text-[#FFFF00] italic leading-none mb-1">
            {isEdit ? 'EDIT_MISSION' : 'NEW_MISSION'}
          </h2>
          <p className="text-[10px] font-headline text-slate-500 uppercase tracking-[0.2em]">{isEdit ? 'Mission Update Interface' : 'Booking Input Interface v2.1'}</p>
        </div>

        {/* WhatsApp Connection Section */}
        <section>
          <label className="block text-[10px] font-headline text-slate-500 uppercase tracking-widest mb-3">WhatsApp Connection</label>
          <div className="space-y-2">
            {allConversations.slice(0, 3).map(conv => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={cn(
                  "w-full flex items-center gap-3 p-2 transition-colors text-left group rounded-sm border",
                  selectedConversation?.id === conv.id
                    ? "bg-[#2a2a2a] border-[#FFFF00]/30"
                    : "bg-[#0e0e0e] border-white/5 hover:bg-[#2a2a2a]"
                )}
              >
                <div className="w-8 h-8 bg-slate-800 flex items-center justify-center rounded-sm grayscale group-hover:grayscale-0">
                  <Smartphone className="size-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-bold font-headline uppercase text-white truncate w-40">{conv.customerName || 'No Name'}</p>
                  <p className={cn(
                    "text-[9px] font-headline tracking-tighter",
                    selectedConversation?.id === conv.id ? "text-[#FFFF00]" : "text-slate-500"
                  )}>
                    {selectedConversation?.id === conv.id ? 'ACTIVE CHAT' : `+${conv.customerPhone}`}
                  </p>
                </div>
              </button>
            ))}
            <button className="w-full flex items-center justify-center gap-2 p-2 border border-dashed border-white/10 text-slate-500 text-[10px] font-headline uppercase hover:text-white transition-colors">
              <Search className="size-3" />
              Browse All Chats
            </button>
          </div>
        </section>

        {/* Total Summary Panel */}
        <div className="mt-auto bg-[#0e0e0e] p-4 border border-white/5">
          <h4 className="text-[10px] font-headline text-slate-500 uppercase mb-4 tracking-widest">Order Summary</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-headline">
              <span className="text-slate-500 uppercase">Services Total</span>
              <span className="text-white">{formatRupiah(servicesTotal)}</span>
            </div>
            <div className="flex justify-between text-xs font-headline">
              <span className="text-slate-500 uppercase">Discount</span>
              <span className="text-red-500">- {formatRupiah(computedDiscount)}</span>
            </div>
            <div className="pt-2 border-t border-white/5 flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-headline text-slate-600 uppercase">
                <span>Equation</span>
                <span>Total - Disc</span>
              </div>
              <div className="flex justify-between text-lg font-display font-black text-[#FFFF00] uppercase italic">
                <span>FINAL TOTAL</span>
                <span>{formatRupiah(finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {isEdit && (
          <div className="mt-6 border-t border-white/5 pt-6">
            <button
              onClick={handleDelete}
              className="text-[10px] font-headline font-bold text-red-500/50 hover:text-red-500 uppercase tracking-[0.2em] transition-colors"
            >
              [ ABORT_MISSION / HAPUS BOOKING ]
            </button>
          </div>
        )}
      </aside>

      {/* ── MODAL BODY: FORMS ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#131313]">

        {/* Fixed Header with Step Indicators */}
        <div className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-[#1c1b1b]/30 flex-shrink-0">
          <div className="flex gap-8">
            {[
              { id: 1, label: 'Customer Info' },
              { id: 2, label: 'Technical Specs' },
              { id: 3, label: 'Finalization' }
            ].map(step => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-2 transition-colors cursor-pointer",
                  currentStep === step.id ? "text-[#FFFF00]" : "text-slate-500"
                )}
                onClick={() => setCurrentStep(step.id)}
              >
                <span className="text-[10px] font-headline font-bold uppercase tracking-widest">0{step.id}</span>
                <span className="text-xs font-headline font-bold uppercase">{step.label}</span>
              </div>
            ))}
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors">
            <X className="size-6" />
          </button>
        </div>

        {/* Scrollable Form Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-12 no-scrollbar scroll-smooth">

          {/* Section 1: Customer & Invoice */}
          <section id="step-1" className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tighter text-white">Customer & Invoice</h3>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Invoice Name (Display)</label>
                <input
                  value={invoiceName}
                  onChange={e => setInvoiceName(e.target.value)}
                  className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline placeholder:text-slate-800 text-white focus:border-l-2 focus:border-[#FFFF00] transition-all"
                  placeholder="e.g. PT. Global Digital"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Contact Phone (WA)</label>
                <div className="relative">
                  <input
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white"
                    placeholder="628..."
                  />
                  {contactPhone.length > 8 && (
                    <Verified className="absolute right-4 top-1/2 -translate-y-1/2 text-[#cccc63] size-4 fill-[#cccc63]/20" />
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Technical Specs */}
          <section id="step-2" className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tighter text-white">Technical Specs</h3>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Motorcycle Model</label>
                <div className="relative">
                  <select
                    value={motorcycleModel?.model || ""}
                    onChange={e => {
                      const model = MOTOR_DATABASE.find(m => m.model === e.target.value);
                      if (model) setMotorcycleModel(model);
                    }}
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white appearance-none cursor-pointer"
                  >
                    <option value="">Select Model (Triggers Base Price)</option>
                    {MOTOR_DATABASE.map(m => (
                      <option key={m.model} value={m.model}>{m.model}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 size-5" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="flex justify-between items-center text-[10px] font-headline uppercase tracking-widest">
                  <span className="text-slate-500">Plat Nomor</span>
                  <span className="text-[#FFFF00] flex items-center gap-1"><Bolt className="size-3" /> SMART SEARCH</span>
                </label>
                <input
                  value={platNomor}
                  onChange={(e) => {
                    // Matikan tameng saat user dengan sengaja mengetik manual
                    setSkipNextSearch(false);
                    setPlatNomor(e.target.value.toUpperCase());
                  }}
                  className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline placeholder:text-slate-800 text-white uppercase"
                  placeholder="B 1234 XYZ"
                />

                {/* Found Vehicle Card */}
                {foundVehicle && (
                  <div className="mt-2 p-3 bg-[#1c1b1b] border border-[#FFFF00]/20 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#FFFF00]/10 flex items-center justify-center">
                        <Bolt className="size-4 text-[#FFFF00]" />
                      </div>
                      <div>
                        <p className="font-headline text-[10px] font-bold uppercase text-white leading-none mb-1">{foundVehicle.model}</p>
                        <p className="text-[9px] text-slate-500 uppercase tracking-tight">Owner: {foundVehicle.owner}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // FUZZY MATCHING: Cari model yang paling mendekati
                        const model = MOTOR_DATABASE.find(m =>
                          m.model.toLowerCase() === foundVehicle.model.toLowerCase() ||
                          foundVehicle.model.toLowerCase().includes(m.model.toLowerCase())
                        );
                        if (model) setMotorcycleModel(model);

                        // 1-KLIK ISI SEMUA:
                        if (!invoiceName) setInvoiceName(foundVehicle.owner);
                        if (!contactPhone) setContactPhone(foundVehicle.phone);
                        setPlatNomor(foundVehicle.plate); // Plat nomor langsung keisi!

                        // Sembunyikan card setelah digunakan
                        setFoundVehicle(null);
                      }}
                      className="px-3 py-1.5 bg-[#FFFF00] text-[#1D1D00] font-headline text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                    >
                      USE_VEHICLE
                    </button>
                  </div>
                )}
                {isSearching && (
                  <div className="mt-1 flex items-center gap-2 px-1">
                    <div className="size-2 bg-[#FFFF00] rounded-full animate-pulse" />
                    <span className="text-[8px] font-headline text-slate-600 uppercase tracking-widest">Searching records...</span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Service Selection */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tighter text-white">Service Selection</h3>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-3 border border-white/5 bg-[#1c1b1b] p-1 mb-4 rounded-sm">
              {(['repaint', 'detailing', 'coating'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "py-3 font-headline text-[10px] font-black uppercase transition-colors tracking-widest",
                    activeTab === tab ? "bg-[#FFFF00] text-[#1D1D00]" : "text-slate-500 hover:text-white"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Service Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SERVICES.filter(s => s.category === activeTab).map(service => {
                const selected = cart.some(i => i.name === service.name);
                const price = getServicePrice(service, motorcycleModel);

                return (
                  <div
                    key={service.name}
                    onClick={() => addServiceToCart(service)}
                    className={cn(
                      "p-5 bg-[#1c1b1b] flex justify-between items-center group transition-all cursor-pointer border-l-2",
                      selected ? "border-[#FFFF00] bg-[#2a2a2a]" : "border-transparent hover:bg-[#201f1f] hover:border-[#FFFF00]"
                    )}
                  >
                    <div>
                      <p className="font-headline text-sm font-bold uppercase text-white">{service.name}</p>
                      <p className="text-[10px] text-slate-500 font-headline uppercase tracking-tight">Industrial Grade Prep</p>
                    </div>
                    <div className="text-right">
                      <p className="font-headline text-sm font-bold text-white">IDR {price > 0 ? (price / 1000).toFixed(0) + 'K' : 'Manual'}</p>
                      <PlusCircle className={cn(
                        "size-4 text-[#FFFF00] mt-1 transition-opacity",
                        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Service Section */}
            <div className="p-6 bg-[#1c1b1b] border border-white/5 space-y-4 rounded-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-headline font-bold uppercase tracking-widest text-[#FFFF00]">Add Custom Service</h4>
                <span className="text-[9px] font-headline text-slate-500 uppercase">Manual Entry Mode</span>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <input
                  value={customServiceName}
                  onChange={e => setCustomServiceName(e.target.value)}
                  className="flex-1 bg-[#0e0e0e] border-none focus:ring-0 text-xs py-3 px-4 font-headline placeholder:text-slate-800 text-white"
                  placeholder="SERVICE NAME (E.G. CHASSIS CLEANING)"
                />
                <div className="flex gap-2">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-headline text-slate-500">IDR</span>
                    <input
                      type="number"
                      value={customServicePrice || ''}
                      onChange={e => setCustomServicePrice(Number(e.target.value))}
                      className="w-32 bg-[#0e0e0e] border-none focus:ring-0 text-xs py-3 pl-10 pr-4 font-headline text-white text-right"
                      placeholder="0"
                    />
                  </div>
                  <button
                    onClick={addCustomService}
                    className="bg-[#FFFF00] text-[#1D1D00] px-6 text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
                  >
                    ADD_LINE
                  </button>
                </div>
              </div>
            </div>

            {/* Spot Repair Panel - Only show if Spot Repair is selected */}
            {isSpotRepairSelected && (
              <div className="p-5 bg-[#0e0e0e] border border-dashed border-white/10 flex items-center justify-between rounded-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-4">
                  <FileText className="text-slate-500" />
                  <span className="font-headline text-[10px] font-bold uppercase text-slate-500 tracking-widest">Manual Adjust / Spot Repair</span>
                </div>
                <div className="flex gap-4">
                  <input
                    type="number"
                    value={spotCount || ''}
                    onChange={e => setSpotCount(Number(e.target.value))}
                    className="w-24 bg-[#1c1b1b] border-none focus:ring-0 text-[10px] font-headline text-center py-2 text-white"
                    placeholder="Spot Count"
                  />
                  <input
                    type="number"
                    value={spotPrice || ''}
                    onChange={e => setSpotPrice(Number(e.target.value))}
                    className="w-32 bg-[#1c1b1b] border-none focus:ring-0 text-[10px] font-headline text-center py-2 text-[#FFFF00]"
                    placeholder="Custom Price"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Section 4: Discount Settings */}
          <section className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tighter text-white">Discount Settings</h3>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Discount Percentage (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={discountPercent || ''}
                    onChange={e => {
                      setDiscountPercent(Number(e.target.value));
                      setDiscountAmount(0);
                    }}
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white text-right"
                    max="100" min="0"
                    placeholder="0"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-headline text-slate-500">PERCENT</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Discount Amount (Rp)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={discountAmount || ''}
                    onChange={e => {
                      setDiscountAmount(Number(e.target.value));
                      setDiscountPercent(0);
                    }}
                    className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white text-right"
                    placeholder="0"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-headline text-slate-500">IDR_FIXED</span>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Logistics & Billing */}
          <section className="space-y-6 pb-20">
            <div className="flex items-center gap-4 mb-2">
              <h3 className="font-display text-2xl font-bold uppercase tracking-tighter text-white">Logistics & Billing</h3>
              <div className="h-px flex-1 bg-white/5"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Entry Date</label>
                    <input
                      type="date"
                      value={entryDate}
                      onChange={e => setEntryDate(e.target.value)}
                      className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white rounded-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Time Slot</label>
                    <input
                      type="time"
                      value={timeSlot}
                      onChange={e => setTimeSlot(e.target.value)}
                      className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white rounded-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-5 bg-[#1c1b1b] border border-[#FFFF00]/20 rounded-sm">
                  <div className="flex items-center gap-3">
                    <Wrench className="text-[#FFFF00] size-5" />
                    <span className="font-headline text-xs font-bold uppercase text-white">Home Service Mode</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={homeService}
                      onChange={e => setHomeService(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#353534] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-[#FFFF00] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Down Payment (DP)?</label>
                  <div className="flex gap-2">
                    {[
                      { id: true, label: 'YA' },
                      { id: false, label: 'TIDAK' }
                    ].map(opt => (
                      <button
                        key={String(opt.id)}
                        onClick={() => setDpRequired(opt.id)}
                        type="button"
                        className={cn(
                          "flex-1 py-3 text-center font-headline text-[10px] font-black uppercase border transition-all rounded-sm",
                          dpRequired === opt.id
                            ? "bg-[#FFFF00] text-[#1D1D00] border-[#FFFF00]"
                            : "bg-[#1c1b1b] text-slate-500 border-white/5"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {dpRequired && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Nominal DP</label>
                      <input
                        type="number"
                        value={nominalDP || ''}
                        onChange={e => setNominalDP(Number(e.target.value))}
                        className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline font-bold text-[#FFFF00] text-right"
                        placeholder="IDR 0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Metode Pembayaran</label>
                      <div className="relative">
                        <select
                          value={paymentMethod}
                          onChange={e => setPaymentMethod(e.target.value)}
                          className="w-full bg-[#0e0e0e] border-none focus:ring-0 text-sm py-4 px-4 font-headline text-white appearance-none cursor-pointer rounded-sm"
                        >
                          <option>Tunai</option>
                          <option>Transfer BCA</option>
                          <option>QRIS</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 size-4" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1 pt-2 border-t border-white/5">
                  <label className="text-[10px] font-headline text-slate-500 uppercase tracking-widest">Remaining Balance</label>
                  <div className="w-full bg-[#2a2a2a] py-4 px-4 font-headline text-sm text-right text-slate-300 rounded-sm">
                    {formatRupiah(remainingBalance)}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Fixed Footer: Submit Actions */}
        <div className="p-6 bg-[#1c1b1b] border-t border-white/5 flex items-center justify-between min-h-[100px] flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={sendInvoiceWA}
                  onChange={e => setSendInvoiceWA(e.target.checked)}
                  className="peer h-5 w-5 bg-[#0e0e0e] border-white/10 text-[#FFFF00] focus:ring-0 rounded-sm cursor-pointer"
                />
                <Check className="absolute opacity-0 peer-checked:opacity-100 text-[#1D1D00] size-3.5 font-black pointer-events-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <span className="text-[11px] font-headline font-bold text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">
                Kirim invoice ke WhatsApp pelanggan
              </span>
            </label>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <button className="hidden md:block px-6 py-4 font-headline text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
              Save Draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || cart.length === 0}
              className={cn(
                "flex-1 md:flex-none px-12 py-4 bg-[#FFFF00] text-[#1D1D00] font-headline font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 active:scale-95",
                (isSubmitting || cart.length === 0) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full size-4 border-2 border-[#1D1D00] border-t-transparent" />
              ) : (
                <Check className="size-5" />
              )}
              {isSubmitting ? 'PROCESSING...' : isEdit ? '⚡ UPDATE MISSION' : '⚡ BUAT BOOKING'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
