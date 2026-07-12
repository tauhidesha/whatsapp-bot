import { ENV } from './env';
import { getIdToken } from './firebase';

/**
 * API Client for BosMat Admin Mobile.
 * Calls the existing Next.js API routes on Vercel.
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await getIdToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMessage = text;
      try {
        const parsed = JSON.parse(text);
        errorMessage = parsed.error || parsed.message || text;
      } catch {
        // Use raw text
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Conversations
  async getConversations(limit = 30) {
    return this.request<{ success: boolean; data: any[] }>(
      `/conversations?limit=${limit}&t=${Date.now()}`
    );
  }

  async getConversationHistory(phone: string, limit = 100) {
    const cleanPhone = phone.replace(/@c\.us$|@lid$/, '').replace(/\D/g, '');
    return this.request<{ success: boolean; data: any[] }>(
      `/conversation-history/${cleanPhone}?limit=${limit}&t=${Date.now()}`
    );
  }

  // Messages
  async sendMessage(params: {
    number: string;
    message: string;
    channel: string;
    platformId?: string;
  }) {
    return this.request('/send-message', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Bookings
  async getBookings() {
    return this.request<{ success: boolean; data: any[] }>(`/bookings?t=${Date.now()}`);
  }

  async updateBookingStatus(id: string, status: string) {
    return this.request<{success: boolean; data: any}>(`/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async createBooking(params: {
    customerName: string;
    customerPhone: string;
    serviceName: string;
    bookingDate: string;
    bookingTime: string;
    vehicleInfo: string;
    notes?: string;
    subtotal?: number;
  }) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async payBooking(id: string, params: {
    paymentMethod: string;
    amountPaid?: number;
    sendInvoice: boolean;
    status?: string;
  }) {
    return this.request(`/bookings/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async updateBooking(id: string, params: any) {
    return this.request('/bookings', {
      method: 'PUT',
      body: JSON.stringify({ id, ...params }),
    });
  }

  async deleteBooking(id: string) {
    return this.request<{ success: boolean }>(`/bookings?id=${id}`, {
      method: 'DELETE',
    });
  }

  async generateInvoice(id: string, documentType: string = 'invoice') {
    return this.request(`/bookings/${id}/invoice`, {
      method: 'POST',
      body: JSON.stringify({ documentType }),
    });
  }

  // Finance
  async getFinanceData(timeframe: string = 'all') {
    return this.request<{ success: boolean; data: any }>(
      `/finance?timeframe=${timeframe}&t=${Date.now()}`
    );
  }

  // AI State
  async toggleAiState(number: string, enabled: boolean, reason?: string) {
    return this.request(`/conversation/${number}/ai-state`, {
      method: 'POST',
      body: JSON.stringify({ enabled, reason }),
    });
  }

  // Playground
  async testAI(params: {
    message: string;
    history?: Array<{ role: string; content: string }>;
  }) {
    return this.request<{ success: boolean; response?: string }>('/test-ai', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async clearTestAI() {
    return this.request('/test-ai/clear', {
      method: 'DELETE',
    });
  }

  // Master Data
  async getMasterServices() {
    return this.request<{ success: boolean; services: any[] }>('/master-data/services');
  }

  async getMasterVehicleModels() {
    return this.request<{ success: boolean; models: any[] }>('/master-data/vehicle-models?limit=1000');
  }

  async getMasterSurcharges() {
    return this.request<{ success: boolean; surcharges: any[] }>('/master-data/surcharges');
  }

  // Vehicles
  async searchVehicles(query: string) {
    return this.request<{ success: boolean; vehicles: any[] }>(
      `/vehicles?q=${encodeURIComponent(query)}`
    );
  }

  async searchCustomers(query: string) {
    return this.request<{ success: boolean; data: any[] }>(
      `/crm/customers?search=${encodeURIComponent(query)}&limit=20`
    );
  }

  async getCustomers(limit = 500) {
    return this.request<{ success: boolean; customers: any[] }>(
      `/crm/customers?limit=${limit}`
    );
  }
}

export const api = new ApiClient(ENV.API_BASE_URL);
