import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ScrollView, 
  StyleSheet, Alert, Switch, ActivityIndicator, Modal, FlatList, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { Colors, Spacing, FontSize } from '@/lib/theme';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { usePricingData, calculateServicePrice, Service, VehicleModel } from '@/lib/hooks/usePricingData';

interface CartItem {
  id: string;
  name: string;
  price: number;
  surcharges: string[];
  itemNotes?: string;
  discountType?: 'nominal' | 'percentage';
  discountValue?: number;
  isCustom?: boolean; // For custom services added manually
}

const SIZE_OPTIONS: Array<'S' | 'M' | 'L' | 'XL'> = ['S', 'M', 'L', 'XL'];

export default function BookingFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEdit = !!params.id;

  const { services, vehicleModels, surcharges, loading: pricingLoading } = usePricingData();

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Walk-In Toggle (HP 1)
  const [isWalkIn, setIsWalkIn] = useState(false);

  // Modal States
  const [showChatModal, setShowChatModal] = useState(false);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [chatSearch, setChatSearch] = useState('');

  const [showModelModal, setShowModelModal] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  // Form State - Step 1
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [internalPhone, setInternalPhone] = useState(''); 
  const [platNomor, setPlatNomor] = useState('');
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // HP 5: Custom Model Support
  const [customModelName, setCustomModelName] = useState('');
  const [customModelSize, setCustomModelSize] = useState<'S' | 'M' | 'L' | 'XL'>('M');
  const isCustomModel = customModelName.trim().length > 0 && !selectedModel;
  const effectiveModel: VehicleModel | null = useMemo(() => {
    if (isCustomModel) {
      return {
        id: '__custom__',
        brand: 'Custom',
        modelName: customModelName.trim(),
        serviceSize: customModelSize,
        repaintSize: customModelSize,
        aliases: [],
      };
    }
    return selectedModel;
  }, [isCustomModel, customModelName, customModelSize, selectedModel]);

  // Form State - Step 2
  const [activeTab, setActiveTab] = useState<'repaint' | 'detailing' | 'coating'>('repaint');
  const [cart, setCart] = useState<CartItem[]>([]);

  // HP 2: Spot Repair
  const [spotCount, setSpotCount] = useState(0);
  const [spotPricePerUnit, setSpotPricePerUnit] = useState(100000);

  // HP 3: Custom Service
  const [showCustomServiceModal, setShowCustomServiceModal] = useState(false);
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');

  // Form State - Step 3
  const [bookingDate, setBookingDate] = useState(new Date());
  const [bookingTime, setBookingTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [discount, setDiscount] = useState('0');
  const [dpAmount, setDpAmount] = useState('0');
  const [homeService, setHomeService] = useState(false);
  const [sendInvoiceWA, setSendInvoiceWA] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('PENDING');

  // --- Populate Edit Data ---
  useEffect(() => {
    if (isEdit && params.data) {
      try {
        const decodedData = decodeURIComponent(params.data as string);
        const data = JSON.parse(decodedData);
        setCustomerName(data.customerName || '');
        setCustomerPhone(data.customerPhone || '');
        
        // Extract plateNumber and motorModel from vehicleInfo
        const vehicleInfo = data.vehicleInfo || '';
        let extractedModel = vehicleInfo;
        let extractedPlate = '';
        if (vehicleInfo.includes('(') && vehicleInfo.endsWith(')')) {
          const parts = vehicleInfo.split(' (');
          extractedModel = parts[0];
          extractedPlate = parts[1].replace(')', '');
        }
        
        setPlatNomor(extractedPlate || data.plateNumber || '');
        
        const targetModel = extractedModel || data.motorModel;
        if (targetModel && vehicleModels.length > 0) {
          const foundModel = vehicleModels.find(m => 
            m.modelName.toLowerCase() === targetModel.toLowerCase()
          );
          if (foundModel) setSelectedModel(foundModel);
          else setCustomModelName(targetModel); // Fallback to custom if not found
        }

        if (data.bookingDate) setBookingDate(new Date(data.bookingDate));
        if (data.bookingTime) setBookingTime(new Date(`2000-01-01T${data.bookingTime}:00`));
        if (data.discount) setDiscount(data.discount.toString());
        if (data.downPayment) setDpAmount(data.downPayment.toString());
        setHomeService(data.homeService || false);
        setStatus(data.status ? data.status.toUpperCase() : 'PENDING');
        setNotes(data.notes || '');

        if (data.services && Array.isArray(data.services)) {
          const initialCart = data.services.map((s: string) => ({
            id: Math.random().toString(),
            name: s, price: 0, surcharges: []
          }));
          setCart(initialCart);
        }
      } catch (e) {
        console.error('Failed to parse booking data', e);
      }
    }
  }, [isEdit, params.data, vehicleModels.length, services.length]);

  // Smart Search Logic (Plat Nomor)
  useEffect(() => {
    if (!platNomor || platNomor.trim().length < 2) return;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const cleanPlate = platNomor.replace(/\s+/g, '');
        const res = await api.searchVehicles(cleanPlate);
        if (res.success && res.vehicles.length > 0) {
          const v = res.vehicles[0];
          setCustomerName(v.customer?.name || '');
          setCustomerPhone(v.customer?.phone || '');
          const foundModel = vehicleModels.find(m => m.modelName === v.modelName);
          if (foundModel) { setSelectedModel(foundModel); setCustomModelName(''); }
        }
      } catch (e) {
        console.log('Smart search error', e);
      } finally {
        setSearchLoading(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [platNomor, vehicleModels]);

  // Recalculate Cart when Model Changes
  useEffect(() => {
    setCart(prev => prev.map(item => {
      if (item.isCustom) return item; // Don't recalculate custom services
      const serviceMaster = services.find(s => s.name === item.name);
      if (serviceMaster) {
        const newPrice = calculateServicePrice(serviceMaster, effectiveModel, surcharges, item.surcharges);
        return { ...item, price: newPrice };
      }
      return item;
    }));
  }, [effectiveModel, services, surcharges]);

  // HP 2: Sync Spot Repair in cart when count/price changes
  useEffect(() => {
    if (spotCount > 0) {
      const totalSpotPrice = spotCount * spotPricePerUnit;
      setCart(prev => {
        const exists = prev.find(i => i.name === `Spot Repair (${spotCount} titik)`);
        const filtered = prev.filter(i => !i.name.startsWith('Spot Repair'));
        if (exists) {
          return [...filtered, { ...exists, name: `Spot Repair (${spotCount} titik)`, price: totalSpotPrice }];
        }
        return [...filtered, { id: 'spot-repair', name: `Spot Repair (${spotCount} titik)`, price: totalSpotPrice, surcharges: [], isCustom: true }];
      });
    } else {
      setCart(prev => prev.filter(i => !i.name.startsWith('Spot Repair')));
    }
  }, [spotCount, spotPricePerUnit]);

  const [chatError, setChatError] = useState<string | null>(null);

  // --- Actions ---
  const handleOpenChats = async () => {
    setShowChatModal(true);
    setLoadingChats(true);
    setChatError(null);
    try {
      const res = await api.getCustomers(500);
      if (res.success) {
        const list = res.customers || [];
        const formatted = list.map((c: any) => ({
          id: c.id,
          name: c.name,
          customerPhone: c.phone,
          lastMessage: c.lastMessage || c.status
        }));
        setRecentChats(formatted);
      } else {
        setChatError('API returned success: false');
      }
    } catch (e: any) {
      console.log('Error handleOpenChats:', e.message);
      setChatError(e.message || 'Gagal mengambil daftar pelanggan');
    } finally {
      setLoadingChats(false);
    }
  };

  const filteredChats = useMemo(() => {
    if (!chatSearch.trim()) return recentChats;
    const lower = chatSearch.toLowerCase();
    return recentChats.filter(c => 
      (c.name && c.name.toLowerCase().includes(lower)) || 
      (c.customerPhone && c.customerPhone.includes(lower))
    );
  }, [recentChats, chatSearch]);

  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return vehicleModels;
    const lower = modelSearch.toLowerCase();
    return vehicleModels.filter(m => 
      m.modelName.toLowerCase().includes(lower) || 
      (m.brand && m.brand.toLowerCase().includes(lower))
    );
  }, [vehicleModels, modelSearch]);

  const handleSelectChat = async (chat: any) => {
    setCustomerName(chat.name || chat.customerPhone || '');
    setCustomerPhone(chat.customerPhone || '');
    setInternalPhone(chat.customerPhone || '');
    setShowChatModal(false);
    setChatSearch('');
    
    if (chat.customerPhone) {
      try {
        const cleanPhone = chat.customerPhone.replace(/[^0-9]/g, '');
        const res = await api.searchVehicles(cleanPhone);
        if (res.success && res.vehicles.length > 0) {
          const v = res.vehicles[0];
          if (v.plateNumber) setPlatNomor(v.plateNumber);
          const foundModel = vehicleModels.find(m => m.modelName === v.modelName);
          if (foundModel) { setSelectedModel(foundModel); setCustomModelName(''); }
        }
      } catch (e) {
        console.log('Error auto-fetching vehicle for chat', e);
      }
    }
  };

  const toggleService = (service: Service) => {
    const price = calculateServicePrice(service, effectiveModel, surcharges, []);
    setCart(prev => {
      const exists = prev.find(i => i.name === service.name);
      if (exists) return prev.filter(i => i.name !== service.name);
      return [...prev, { id: Math.random().toString(), name: service.name, price, surcharges: [] }];
    });
  };

  const toggleSurcharge = (itemId: string, surchargeName: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const has = item.surcharges.includes(surchargeName);
        const newSurcharges = has ? item.surcharges.filter(s => s !== surchargeName) : [...item.surcharges, surchargeName];
        const serviceMaster = services.find(s => s.name === item.name);
        const newPrice = serviceMaster ? calculateServicePrice(serviceMaster, effectiveModel, surcharges, newSurcharges) : item.price;
        return { ...item, surcharges: newSurcharges, price: newPrice };
      }
      return item;
    }));
  };

  const setItemNotes = (itemId: string, val: string) => {
    setCart(prev => prev.map(item => item.id === itemId ? { ...item, itemNotes: val } : item));
  };

  const setItemDiscount = (itemId: string, type: 'nominal' | 'percentage', value: number) => {
    setCart(prev => prev.map(item => item.id === itemId ? { ...item, discountType: type, discountValue: value } : item));
  };

  // HP 3: Add Custom Service
  const handleAddCustomService = () => {
    if (!customServiceName.trim()) {
      Alert.alert('Error', 'Nama layanan wajib diisi');
      return;
    }
    const price = parseInt(customServicePrice) || 0;
    setCart(prev => [...prev, {
      id: Math.random().toString(),
      name: customServiceName.trim(),
      price,
      surcharges: [],
      isCustom: true
    }]);
    setCustomServiceName('');
    setCustomServicePrice('');
    setShowCustomServiceModal(false);
  };

  // Computations
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price, 0), [cart]);
  
  const computedDiscount = useMemo(() => {
    const itemDiscounts = cart.reduce((sum, item) => {
      if (!item.discountValue) return sum;
      if (item.discountType === 'percentage') {
        return sum + Math.round(item.price * (item.discountValue / 100));
      }
      return sum + item.discountValue;
    }, 0);
    const globalDisc = parseInt(discount) || 0;
    return itemDiscounts + globalDisc;
  }, [cart, discount]);

  const finalTotal = Math.max(0, subtotal - computedDiscount);

  const handleSave = async () => {
    const modelToUse = effectiveModel;
    if (!customerName || (!isWalkIn && !customerPhone) || !modelToUse || cart.length === 0) {
      Alert.alert('Error', 'Nama, Model Motor, dan minimal 1 Layanan wajib diisi');
      return;
    }

    setLoading(true);
    try {
      const serviceSummary = cart.map(i => {
        let name = i.name;
        if (i.surcharges.length > 0) name += ` [+${i.surcharges.join(', ')}]`;
        const desc = i.itemNotes ? `Catatan Warna: ${i.itemNotes}` : '';
        return `${name}||${i.price}||${desc}`;
      }).join(' § ');

      const walkinPhone = isWalkIn ? (customerPhone || `WALKIN_${Date.now()}`) : customerPhone;

      const payload = {
        customerName,
        customerPhone: internalPhone || walkinPhone,
        realPhone: internalPhone && internalPhone !== walkinPhone ? walkinPhone : undefined,
        serviceName: serviceSummary,
        vehicleInfo: `${modelToUse.modelName} (${platNomor || '-'})`,
        motorModel: modelToUse.modelName,
        plateNumber: platNomor,
        bookingDate: format(bookingDate, 'yyyy-MM-dd'),
        bookingTime: format(bookingTime, 'HH:mm'),
        subtotal,
        discount: computedDiscount,
        totalAmount: finalTotal,
        dpAmount: parseInt(dpAmount) || 0,
        downPayment: parseInt(dpAmount) || 0,
        homeService,
        status,
        notes,
      };

      let bookingId = params.id as string;

      if (isEdit) {
        await api.updateBooking(bookingId, payload);
      } else {
        const res = await api.createBooking(payload);
        bookingId = (res as any)?.data?.id; 
      }

      // Generate Invoice if checked
      if (sendInvoiceWA && bookingId) {
        const invoicePayload = {
           documentType: 'invoice',
           customerName,
           customerPhone: payload.customerPhone,
           motorDetails: payload.vehicleInfo,
           items: cart.map(i => {
             const desc = i.itemNotes ? `Catatan Warna: ${i.itemNotes}` : '';
             return `${i.name}||${i.price}||${desc}`;
           }).join('\n'),
           subtotal,
           totalAmount: finalTotal,
           discount: computedDiscount,
           downPayment: parseInt(dpAmount) || 0,
           paymentMethod: 'Transfer',
           notes: payload.notes,
           bookingDate: payload.bookingDate,
           docNumber: bookingId
        };
        const token = await require('@/lib/firebase').getIdToken();
        await fetch(`${require('@/lib/env').ENV.API_BASE_URL}/bookings/invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify(invoicePayload)
        }).catch(e => console.log('Invoice err', e));
      }

      if (Platform.OS === 'web') {
        window.alert(`Booking berhasil ${isEdit ? 'diperbarui' : 'dibuat'}`);
      } else {
        Alert.alert('Sukses', `Booking berhasil ${isEdit ? 'diperbarui' : 'dibuat'}`);
      }

      router.replace('/bookings');
    } catch (err: any) {
      if (Platform.OS === 'web') {
        window.alert(err.message || 'Gagal menyimpan booking');
      } else {
        Alert.alert('Gagal', err.message || 'Gagal menyimpan booking');
      }
    } finally {
      setLoading(false);
    }
  };

  if (pricingLoading) {
    return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color={Colors.accent} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Stepper Header */}
      <View style={styles.stepperContainer}>
        {[1, 2, 3].map(step => (
          <TouchableOpacity key={step} onPress={() => setCurrentStep(step)} style={styles.stepItem}>
            <View style={[styles.stepCircle, currentStep === step && styles.stepCircleActive]}>
              <Text style={[styles.stepText, currentStep === step && styles.stepTextActive]}>{step}</Text>
            </View>
            <Text style={[styles.stepLabel, currentStep === step && styles.stepLabelActive]}>
              {step === 1 ? 'Info' : step === 2 ? 'Layanan' : 'Checkout'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* STEP 1: CUSTOMER INFO */}
        {currentStep === 1 && (
          <View>
            {/* HP 1: Walk-In Toggle */}
            <View style={[styles.walkInBox]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.walkInTitle}>Mode Walk-In</Text>
                <Text style={styles.walkInDesc}>Aktifkan jika pelanggan tidak punya WhatsApp</Text>
              </View>
              <Switch
                value={isWalkIn}
                onValueChange={(val) => {
                  setIsWalkIn(val);
                  if (val) {
                    setInternalPhone('');
                    setRecentChats([]);
                  }
                }}
                trackColor={{ false: Colors.border, true: Colors.accent }}
              />
            </View>

            <View style={styles.row}>
              <Text style={styles.title}>Data Pelanggan</Text>
              {!isWalkIn && (
                <TouchableOpacity style={styles.chatBtn} onPress={handleOpenChats}>
                  <Text style={styles.chatBtnText}>Pilih dari Chat</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>Plat Nomor {searchLoading && '(Mencari...)'}</Text>
            <TextInput style={styles.input} placeholder="B 1234 CD" placeholderTextColor={Colors.textDimmed} value={platNomor} onChangeText={setPlatNomor} autoCapitalize="characters" />

            <Text style={styles.label}>Nama Customer</Text>
            <TextInput style={styles.input} placeholder="Nama Lengkap" placeholderTextColor={Colors.textDimmed} value={customerName} onChangeText={setCustomerName} />

            {!isWalkIn && (
              <>
                <Text style={styles.label}>No HP (WhatsApp)</Text>
                <TextInput style={styles.input} placeholder="0812xxxxxx" placeholderTextColor={Colors.textDimmed} keyboardType="phone-pad" value={customerPhone} onChangeText={setCustomerPhone} />
              </>
            )}

            {isWalkIn && (
              <>
                <Text style={styles.label}>No HP (Opsional)</Text>
                <TextInput style={styles.input} placeholder="Bisa dikosongkan untuk walk-in" placeholderTextColor={Colors.textDimmed} keyboardType="phone-pad" value={customerPhone} onChangeText={setCustomerPhone} />
              </>
            )}

            {/* HP 5: Custom Model Motor */}
            <Text style={styles.label}>Model Motor</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowModelModal(true)}>
              <Text style={styles.inputText}>
                {selectedModel ? selectedModel.modelName : (customModelName.trim() ? `✏️ ${customModelName}` : 'Pilih Model Motor')}
              </Text>
            </TouchableOpacity>

            {/* Custom model text input (shown when nothing selected from list) */}
            {!selectedModel && (
              <View>
                <Text style={[styles.label, { color: Colors.textDimmed }]}>— atau ketik nama motor manual —</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Contoh: Honda CB150R Streetfire"
                  placeholderTextColor={Colors.textDimmed}
                  value={customModelName}
                  onChangeText={(t) => { setCustomModelName(t); }}
                />
                {isCustomModel && (
                  <View>
                    <Text style={styles.label}>Ukuran Motor</Text>
                    <View style={styles.sizeRow}>
                      {SIZE_OPTIONS.map(s => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.sizeBtn, customModelSize === s && styles.sizeBtnActive]}
                          onPress={() => setCustomModelSize(s)}
                        >
                          <Text style={[styles.sizeBtnText, customModelSize === s && styles.sizeBtnTextActive]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Clear Model Selection */}
            {selectedModel && (
              <TouchableOpacity onPress={() => { setSelectedModel(null); setCustomModelName(''); }} style={styles.clearModelBtn}>
                <Text style={styles.clearModelText}>✕ Ganti / Ketik Manual</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.nextBtn} onPress={() => setCurrentStep(2)}>
              <Text style={styles.nextBtnText}>LANJUT KE LAYANAN</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: SERVICES */}
        {currentStep === 2 && (
          <View>
            <Text style={styles.title}>Pilih Layanan</Text>
            
            <View style={styles.tabsRow}>
              {['repaint', 'detailing', 'coating'].map(tab => (
                <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]} onPress={() => setActiveTab(tab as any)}>
                  <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>{tab.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {services.filter(s => s.category === activeTab).map(srv => {
              const inCart = cart.find(c => c.name === srv.name);
              return (
                <View key={srv.id} style={[styles.serviceCard, inCart && styles.serviceCardActive]}>
                  <TouchableOpacity style={styles.serviceHeader} onPress={() => toggleService(srv)}>
                    <Text style={[styles.serviceName, inCart && styles.serviceNameActive]}>{srv.name}</Text>
                    {inCart && <Text style={styles.servicePrice}>Rp {inCart.price.toLocaleString('id-ID')}</Text>}
                  </TouchableOpacity>
                  
                  {inCart && (
                    <View style={styles.surchargeContainer}>
                      {activeTab === 'repaint' && (
                        <>
                          <Text style={styles.surchargeLabel}>Opsi Tambahan:</Text>
                          <View style={styles.surchargeRow}>
                            {surcharges.map(sur => {
                              const hasSur = inCart.surcharges.includes(sur.name);
                              return (
                                <TouchableOpacity key={sur.id} style={[styles.surchargeChip, hasSur && styles.surchargeChipActive]} onPress={() => toggleSurcharge(inCart.id, sur.name)}>
                                  <Text style={[styles.surchargeText, hasSur && styles.surchargeTextActive]}>+ {sur.name}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          
                          <Text style={[styles.surchargeLabel, { marginTop: Spacing.md }]}>Catatan / Warna:</Text>
                          <TextInput 
                            style={[styles.input, { height: 40, paddingVertical: 5, fontSize: FontSize.sm }]} 
                            placeholder="Contoh: Merah Doff..." 
                            placeholderTextColor={Colors.textDimmed} 
                            value={inCart.itemNotes || ''} 
                            onChangeText={(txt) => setItemNotes(inCart.id, txt)} 
                          />
                        </>
                      )}
                      
                      <Text style={[styles.surchargeLabel, { marginTop: activeTab === 'repaint' ? Spacing.md : 0 }]}>Diskon Item:</Text>
                      <View style={[styles.row, { alignItems: 'center' }]}>
                        <View style={{ flexDirection: 'row', marginRight: Spacing.md, backgroundColor: Colors.bg, borderRadius: 4, padding: 2 }}>
                          <TouchableOpacity 
                            style={[styles.discBtn, (!inCart.discountType || inCart.discountType === 'nominal') && styles.discBtnActive]} 
                            onPress={() => setItemDiscount(inCart.id, 'nominal', inCart.discountValue || 0)}
                          >
                            <Text style={[styles.discBtnText, (!inCart.discountType || inCart.discountType === 'nominal') && styles.discBtnTextActive]}>Rp</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.discBtn, inCart.discountType === 'percentage' && styles.discBtnActive]} 
                            onPress={() => setItemDiscount(inCart.id, 'percentage', inCart.discountValue || 0)}
                          >
                            <Text style={[styles.discBtnText, inCart.discountType === 'percentage' && styles.discBtnTextActive]}>%</Text>
                          </TouchableOpacity>
                        </View>
                        <TextInput 
                          style={[styles.input, { flex: 1, height: 40, paddingVertical: 5, fontSize: FontSize.sm }]} 
                          placeholder="0" 
                          keyboardType="numeric"
                          placeholderTextColor={Colors.textDimmed} 
                          value={inCart.discountValue ? inCart.discountValue.toString() : ''} 
                          onChangeText={(txt) => setItemDiscount(inCart.id, inCart.discountType || 'nominal', parseInt(txt) || 0)} 
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* HP 2: Spot Repair Section (only in repaint tab) */}
            {activeTab === 'repaint' && (
              <View style={styles.spotRepairCard}>
                <Text style={styles.spotRepairTitle}>⚡ Spot Repair</Text>
                <Text style={styles.spotRepairDesc}>Perbaikan titik per area kecil</Text>
                <View style={[styles.row, { marginTop: Spacing.md }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.surchargeLabel}>Jumlah Titik</Text>
                    <View style={styles.counterRow}>
                      <TouchableOpacity style={styles.counterBtn} onPress={() => setSpotCount(Math.max(0, spotCount - 1))}>
                        <Text style={styles.counterBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.counterVal}>{spotCount}</Text>
                      <TouchableOpacity style={styles.counterBtn} onPress={() => setSpotCount(spotCount + 1)}>
                        <Text style={styles.counterBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.surchargeLabel}>Harga / Titik (Rp)</Text>
                    <TextInput
                      style={[styles.input, { height: 40, paddingVertical: 5 }]}
                      keyboardType="numeric"
                      value={spotPricePerUnit.toString()}
                      onChangeText={(t) => setSpotPricePerUnit(parseInt(t) || 0)}
                      placeholderTextColor={Colors.textDimmed}
                    />
                  </View>
                </View>
                {spotCount > 0 && (
                  <Text style={styles.spotTotal}>Total: Rp {(spotCount * spotPricePerUnit).toLocaleString('id-ID')}</Text>
                )}
              </View>
            )}

            {/* HP 3: Custom Service + Cart Items */}
            <TouchableOpacity style={styles.addCustomBtn} onPress={() => setShowCustomServiceModal(true)}>
              <Text style={styles.addCustomBtnText}>+ Tambah Layanan Kustom</Text>
            </TouchableOpacity>

            {/* Show custom services already in cart */}
            {cart.filter(i => i.isCustom && !i.name.startsWith('Spot Repair')).map(item => (
              <View key={item.id} style={[styles.serviceCard, styles.serviceCardActive, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.serviceName, styles.serviceNameActive]}>✏️ {item.name}</Text>
                  <Text style={styles.servicePrice}>Rp {item.price.toLocaleString('id-ID')}</Text>
                </View>
                <TouchableOpacity onPress={() => setCart(prev => prev.filter(i => i.id !== item.id))}>
                  <Text style={{ color: Colors.statusCancelled, fontWeight: '800', fontSize: FontSize.lg }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.nextBtn} onPress={() => setCurrentStep(3)}>
              <Text style={styles.nextBtnText}>LANJUT KE CHECKOUT (Rp {subtotal.toLocaleString('id-ID')})</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: CHECKOUT */}
        {currentStep === 3 && (
          <View>
            <Text style={styles.title}>Checkout & Finalisasi</Text>

            <View style={styles.summaryCard}>
              <View style={styles.row}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>Rp {subtotal.toLocaleString('id-ID')}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.summaryLabel}>Total Diskon (Global + Item)</Text>
                <Text style={styles.summaryValue}>- Rp {computedDiscount.toLocaleString('id-ID')}</Text>
              </View>
              <View style={[styles.row, { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.sm, paddingTop: Spacing.sm }]}>
                <Text style={[styles.summaryLabel, { fontWeight: '900', color: Colors.textPrimary }]}>Total Akhir</Text>
                <Text style={[styles.summaryValue, { fontWeight: '900', color: Colors.accent }]}>Rp {finalTotal.toLocaleString('id-ID')}</Text>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Tanggal Booking</Text>
                <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.inputText}>{format(bookingDate, 'dd MMM yyyy')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Waktu</Text>
                <TouchableOpacity style={styles.input} onPress={() => setShowTimePicker(true)}>
                  <Text style={styles.inputText}>{format(bookingTime, 'HH:mm')}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.label}>Diskon Global (Rp)</Text>
            <TextInput style={styles.input} placeholder="0" placeholderTextColor={Colors.textDimmed} keyboardType="numeric" value={discount} onChangeText={setDiscount} />

            <Text style={styles.label}>Down Payment / DP (Rp)</Text>
            <TextInput style={styles.input} placeholder="0" placeholderTextColor={Colors.textDimmed} keyboardType="numeric" value={dpAmount} onChangeText={setDpAmount} />

            <View style={[styles.row, { alignItems: 'center', marginVertical: Spacing.md }]}>
              <Text style={styles.label}>Home Service?</Text>
              <Switch value={homeService} onValueChange={setHomeService} trackColor={{ false: Colors.border, true: Colors.accent }} />
            </View>

            <View style={[styles.row, { alignItems: 'center', marginBottom: Spacing.md }]}>
              <Text style={styles.label}>Kirim Invoice WA?</Text>
              <Switch value={sendInvoiceWA} onValueChange={setSendInvoiceWA} trackColor={{ false: Colors.border, true: Colors.accent }} />
            </View>

            <Text style={styles.label}>Catatan</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Catatan..." placeholderTextColor={Colors.textDimmed} multiline value={notes} onChangeText={setNotes} />

            <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.saveBtnText}>SIMPAN BOOKING</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Date/Time Pickers */}
      {showDatePicker && (
        <DateTimePicker value={bookingDate} mode="date" onChange={(e, d) => { setShowDatePicker(false); if(d) setBookingDate(d); }} />
      )}
      {showTimePicker && (
        <DateTimePicker value={bookingTime} mode="time" onChange={(e, d) => { setShowTimePicker(false); if(d) setBookingTime(d); }} />
      )}

      {/* Chat Modal */}
      <Modal visible={showChatModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <Text style={styles.modalTitle}>Pilih Customer / Chat</Text>
            <TextInput 
              style={[styles.input, { marginBottom: Spacing.md }]} 
              placeholder="Cari nama atau nomor..." 
              placeholderTextColor={Colors.textDimmed}
              value={chatSearch}
              onChangeText={setChatSearch}
            />

            {chatError && (
              <Text style={{ color: 'red', textAlign: 'center', marginBottom: 10 }}>Error: {chatError}</Text>
            )}

            {loadingChats ? (
              <ActivityIndicator size="large" color={Colors.accent} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={filteredChats.slice(0, 50)}
                keyExtractor={(i) => i.id || i.customerPhone}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectChat(item)}>
                    <Text style={styles.modalItemTitle}>{item.name || 'Tanpa Nama'}</Text>
                    <Text style={styles.modalItemDesc}>{item.customerPhone}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{ color: Colors.textMuted, textAlign: 'center', marginTop: 20 }}>Tidak ada hasil</Text>}
              />
            )}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowChatModal(false)}>
              <Text style={styles.modalCloseText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Model Modal */}
      <Modal visible={showModelModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <Text style={styles.modalTitle}>Pilih Model Motor</Text>
            <TextInput 
              style={[styles.input, { marginBottom: Spacing.md }]} 
              placeholder="Cari model atau merek..." 
              placeholderTextColor={Colors.textDimmed}
              value={modelSearch}
              onChangeText={setModelSearch}
            />
            <FlatList
              data={filteredModels}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalItem} onPress={() => { setSelectedModel(item); setCustomModelName(''); setShowModelModal(false); setModelSearch(''); }}>
                  <Text style={styles.modalItemTitle}>{item.modelName}</Text>
                  <Text style={styles.modalItemDesc}>{item.brand} (Size: {item.serviceSize})</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ color: Colors.textMuted, textAlign: 'center', marginTop: 20 }}>Tidak ada model</Text>}
            />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShowModelModal(false); setModelSearch(''); }}>
              <Text style={styles.modalCloseText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Service Modal */}
      <Modal visible={showCustomServiceModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: 'auto' }]}>
            <Text style={styles.modalTitle}>Tambah Layanan Kustom</Text>
            <Text style={styles.label}>Nama Layanan</Text>
            <TextInput
              style={[styles.input, { marginBottom: Spacing.md }]}
              placeholder="Contoh: Poles Kaca, Anti Karat..."
              placeholderTextColor={Colors.textDimmed}
              value={customServiceName}
              onChangeText={setCustomServiceName}
            />
            <Text style={styles.label}>Harga (Rp)</Text>
            <TextInput
              style={[styles.input, { marginBottom: Spacing.xl }]}
              placeholder="0"
              placeholderTextColor={Colors.textDimmed}
              keyboardType="numeric"
              value={customServicePrice}
              onChangeText={setCustomServicePrice}
            />
            <View style={[styles.row, { gap: Spacing.md }]}>
              <TouchableOpacity style={[styles.modalCloseBtn, { flex: 1 }]} onPress={() => setShowCustomServiceModal(false)}>
                <Text style={styles.modalCloseText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1, marginTop: 0 }]} onPress={handleAddCustomService}>
                <Text style={styles.saveBtnText}>TAMBAH</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  stepperContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: Spacing.md, backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderColor: Colors.border },
  stepItem: { alignItems: 'center', marginHorizontal: Spacing.lg },
  stepCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stepCircleActive: { backgroundColor: Colors.accent },
  stepText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '800' },
  stepTextActive: { color: Colors.bg },
  stepLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '800' },
  stepLabelActive: { color: Colors.accent },
  
  content: { padding: Spacing.xl, paddingBottom: 80 },
  title: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.textPrimary, marginBottom: Spacing.xl, letterSpacing: 1 },
  label: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textMuted, marginBottom: 8, letterSpacing: 1, marginTop: Spacing.md },
  
  input: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, borderRadius: 4, color: Colors.textPrimary, fontSize: FontSize.md },
  inputText: { color: Colors.textPrimary, fontSize: FontSize.md },
  
  // Walk-In
  walkInBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.md },
  walkInTitle: { color: Colors.textPrimary, fontWeight: '800', fontSize: FontSize.sm },
  walkInDesc: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  // Custom Model
  sizeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  sizeBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: 4, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  sizeBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  sizeBtnText: { color: Colors.textMuted, fontWeight: '800', fontSize: FontSize.sm },
  sizeBtnTextActive: { color: Colors.bg },
  clearModelBtn: { marginTop: Spacing.sm, paddingVertical: 8, alignItems: 'center' },
  clearModelText: { color: Colors.statusCancelled, fontSize: FontSize.xs, fontWeight: '700' },

  discBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  discBtnActive: { backgroundColor: Colors.border },
  discBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '800' },
  discBtnTextActive: { color: Colors.textPrimary },
  
  row: { flexDirection: 'row', gap: Spacing.md, justifyContent: 'space-between', alignItems: 'center' },
  col: { flex: 1 },
  
  chatBtn: { backgroundColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 20 },
  chatBtnText: { color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: '800' },

  nextBtn: { backgroundColor: Colors.border, padding: Spacing.lg, borderRadius: 4, alignItems: 'center', marginTop: Spacing.xl },
  nextBtnText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '800', letterSpacing: 1 },
  saveBtn: { backgroundColor: Colors.accent, padding: Spacing.lg, borderRadius: 4, alignItems: 'center', marginTop: Spacing.xl },
  saveBtnText: { color: Colors.bg, fontSize: FontSize.md, fontWeight: '900', letterSpacing: 2 },

  tabsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tabBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderBottomWidth: 2, borderColor: Colors.border },
  tabBtnActive: { borderColor: Colors.accent },
  tabBtnText: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '800' },
  tabBtnTextActive: { color: Colors.accent },

  serviceCard: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, marginBottom: Spacing.md, overflow: 'hidden' },
  serviceCardActive: { borderColor: Colors.accent },
  serviceHeader: { padding: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  serviceName: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '700' },
  serviceNameActive: { color: Colors.textPrimary, fontWeight: '900' },
  servicePrice: { color: Colors.accent, fontSize: FontSize.sm, fontWeight: '800' },
  
  surchargeContainer: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: 'rgba(255,255,255,0.02)' },
  surchargeLabel: { color: Colors.textMuted, fontSize: 10, marginBottom: 8, fontWeight: '800' },
  surchargeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  surchargeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  surchargeChipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  surchargeText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700' },
  surchargeTextActive: { color: Colors.bg },

  // Spot Repair
  spotRepairCard: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: '#4a4a00', borderRadius: 8, padding: Spacing.md, marginBottom: Spacing.md },
  spotRepairTitle: { color: Colors.accent, fontSize: FontSize.md, fontWeight: '900' },
  spotRepairDesc: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: 8 },
  counterBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '900', lineHeight: 36 },
  counterVal: { color: Colors.accent, fontSize: FontSize.xl, fontWeight: '900', minWidth: 30, textAlign: 'center' },
  spotTotal: { color: Colors.accent, fontSize: FontSize.sm, fontWeight: '800', marginTop: Spacing.sm },

  // Custom Service
  addCustomBtn: { borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: 8, padding: Spacing.md, alignItems: 'center', marginBottom: Spacing.md },
  addCustomBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '700' },

  summaryCard: { backgroundColor: Colors.bgCard, padding: Spacing.lg, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg },
  summaryLabel: { color: Colors.textSecondary, fontSize: FontSize.md },
  summaryValue: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: Spacing.xl },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textPrimary, marginBottom: Spacing.lg },
  modalItem: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalItemTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  modalItemDesc: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 4 },
  modalCloseBtn: { marginTop: Spacing.xl, padding: Spacing.md, alignItems: 'center', backgroundColor: Colors.border, borderRadius: 8 },
  modalCloseText: { color: Colors.textPrimary, fontWeight: '800' },
});
