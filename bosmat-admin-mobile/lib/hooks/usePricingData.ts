import { useState, useEffect } from 'react';
import { api } from '../api';

export interface ServicePrice {
  id: string;
  size: string | null;
  vehicleModelId: string | null;
  price: number;
}

export interface Service {
  id: string;
  name: string;
  category: 'repaint' | 'detailing' | 'coating' | string;
  subcategory: string | null;
  summary: string | null;
  description: string | null;
  estimatedDuration: number;
  usesModelPricing: boolean;
  prices: ServicePrice[];
}

export interface VehicleModel {
  id: string;
  brand: string;
  modelName: string;
  serviceSize: string;
  repaintSize: string;
  aliases: string[];
}

export interface Surcharge {
  id: string;
  name: string;
  amount: number;
  aliases: string[];
}

export function usePricingData() {
  const [services, setServices] = useState<Service[]>([]);
  const [vehicleModels, setVehicleModels] = useState<VehicleModel[]>([]);
  const [surcharges, setSurcharges] = useState<Surcharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [svcRes, modelRes, surRes] = await Promise.all([
        api.getMasterServices(),
        api.getMasterVehicleModels(),
        api.getMasterSurcharges(),
      ]);

      if (svcRes.success) setServices(svcRes.services);
      if (modelRes.success) setVehicleModels(modelRes.models);
      if (surRes.success) setSurcharges(surRes.surcharges);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { 
    services, 
    vehicleModels, 
    surcharges, 
    loading, 
    error, 
    refresh: fetchData 
  };
}

export function calculateServicePrice(
  service: Service,
  motor: VehicleModel | null,
  surcharges: Surcharge[] = [],
  selectedSurchargeNames: string[] = []
): number {
  if (!service) return 0;

  let basePrice = 0;

  if (service.usesModelPricing && motor) {
    const priceEntry = service.prices?.find(p => p.vehicleModelId === motor.id);
    if (priceEntry) basePrice = priceEntry.price;
  }

  if (basePrice === 0 && motor) {
    const size = service.category === 'repaint' ? motor.repaintSize : motor.serviceSize;
    const priceEntry = service.prices?.find(p => p.size === size);
    if (priceEntry) basePrice = priceEntry.price;
  }

  if (basePrice === 0 && service.prices) {
    const priceEntry = service.prices.find(p => !p.size && !p.vehicleModelId);
    if (priceEntry) basePrice = priceEntry.price;
  }

  // Add surcharges
  let totalSurcharge = 0;
  selectedSurchargeNames.forEach(name => {
    const found = surcharges.find(s => s.name === name);
    if (found) totalSurcharge += found.amount;
  });

  return basePrice + totalSurcharge;
}
