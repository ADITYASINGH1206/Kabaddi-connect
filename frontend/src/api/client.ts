import type {
  ActualItemInput,
  Collector,
  CollectorRequestItem,
  CreateListingRequest,
  CreateListingResponse,
  ImpactStats,
  ListingDetailsResponse,
  MaterialRate,
  PickupRecord,
  RouteResponse,
  UploadResponse,
  VisionAnalysisResponse,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiClient {
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      let errorCode = 'UNKNOWN_ERROR';
      try {
        const errJson = await response.json();
        if (errJson.error) errorMsg = errJson.error;
        if (errJson.code) errorCode = errJson.code;
      } catch {
        // ignore JSON parse error on non-json error responses
      }
      const err = new Error(errorMsg) as Error & { code?: string; status?: number };
      err.code = errorCode;
      err.status = response.status;
      throw err;
    }

    return response.json();
  }

  static async getHealth(): Promise<{ status: string; service: string }> {
    return this.request<{ status: string; service: string }>('/health');
  }

  static async getRates(): Promise<MaterialRate[]> {
    try {
      return await this.request<MaterialRate[]>('/rates');
    } catch (err) {
      console.warn('API rates fetch failed, using local fallback rates:', err);
      return [
        { material: 'newspaper_paper', label_en: 'Newspaper & Paper', label_hi: 'अखबार और रद्दी कागज', rate_low: 12, rate_high: 16, unit: 'kg', hazardous: false, authorised_channel_only: false },
        { material: 'cardboard', label_en: 'Cardboard / Boxes', label_hi: 'गत्ता / कार्टन', rate_low: 8, rate_high: 12, unit: 'kg', hazardous: false, authorised_channel_only: false },
        { material: 'books_notebooks', label_en: 'Books & Notebooks', label_hi: 'किताबें और कॉपियां', rate_low: 10, rate_high: 14, unit: 'kg', hazardous: false, authorised_channel_only: false },
        { material: 'pet_bottles', label_en: 'PET Bottles', label_hi: 'PET बोतलें', rate_low: 15, rate_high: 22, unit: 'kg', hazardous: false, authorised_channel_only: false },
        { material: 'hdpe_plastic', label_en: 'HDPE Plastic', label_hi: 'मजबूत प्लास्टिक (HDPE)', rate_low: 18, rate_high: 26, unit: 'kg', hazardous: false, authorised_channel_only: false },
        { material: 'iron_steel', label_en: 'Iron & Steel', label_hi: 'लोहा और स्टील', rate_low: 24, rate_high: 32, unit: 'kg', hazardous: false, authorised_channel_only: false },
        { material: 'aluminium', label_en: 'Aluminium', label_hi: 'एल्युमिनियम', rate_low: 95, rate_high: 130, unit: 'kg', hazardous: false, authorised_channel_only: false },
        { material: 'copper', label_en: 'Copper', label_hi: 'तांबा', rate_low: 420, rate_high: 520, unit: 'kg', hazardous: false, authorised_channel_only: false },
        { material: 'brass', label_en: 'Brass', label_hi: 'पीतल', rate_low: 300, rate_high: 380, unit: 'kg', hazardous: false, authorised_channel_only: false },
        { material: 'glass_bottles', label_en: 'Glass Bottles', label_hi: 'कांच की बोतलें', rate_low: 2, rate_high: 5, unit: 'kg', hazardous: false, authorised_channel_only: false },
        { material: 'ewaste_phone', label_en: 'Old Phones & Tablets', label_hi: 'पुराने मोबाइल और टैबलेट', rate_low: 40, rate_high: 100, unit: 'kg', hazardous: false, authorised_channel_only: false },
        { material: 'ewaste_battery_or_crt', label_en: 'Lead Batteries & CRT Displays', label_hi: 'बैटरी व सीआरटी मॉनिटर', rate_low: 15, rate_high: 40, unit: 'kg', hazardous: true, authorised_channel_only: true },
      ];
    }
  }

  static async getUploadUrl(contentType: string = 'image/jpeg'): Promise<UploadResponse> {
    return this.request<UploadResponse>('/uploads', {
      method: 'POST',
      body: JSON.stringify({ contentType }),
    });
  }

  static async uploadImageToS3(uploadUrl: string, blob: Blob): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
      },
      body: blob,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload photo to S3: ${response.statusText}`);
    }
  }

  static async analyzeImage(imageKey: string, lang: string = 'en'): Promise<VisionAnalysisResponse> {
    return this.request<VisionAnalysisResponse>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ imageKey, lang }),
    });
  }

  // ─── Phase 1: Listings ────────────────────────────────────────────────────────
  static async createListing(data: CreateListingRequest): Promise<CreateListingResponse> {
    return this.request<CreateListingResponse>('/listings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getListing(id: string): Promise<ListingDetailsResponse> {
    return this.request<ListingDetailsResponse>(`/listings/${id}`);
  }

  // ─── Phase 2: Collectors & Requests ──────────────────────────────────────────
  static async getCollectors(): Promise<Collector[]> {
    return this.request<Collector[]>('/collectors');
  }

  static async getCollectorRequests(collectorId: string): Promise<CollectorRequestItem[]> {
    return this.request<CollectorRequestItem[]>(`/collectors/${collectorId}/requests`);
  }

  static async acceptListing(listingId: string, collectorId: string): Promise<{
    listingId: string;
    status: string;
    acceptedCollectorId: string;
    pickupId: string;
    acceptedAt: string;
  }> {
    return this.request(`/listings/${listingId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ collectorId }),
    });
  }

  // ─── Phase 2: Pickups ────────────────────────────────────────────────────────
  static async getPickups(collectorId: string): Promise<PickupRecord[]> {
    return this.request<PickupRecord[]>(`/pickups?collectorId=${encodeURIComponent(collectorId)}`);
  }

  static async getPickup(pickupId: string): Promise<PickupRecord> {
    return this.request<PickupRecord>(`/pickups/${pickupId}`);
  }

  static async completePickup(
    pickupId: string,
    actualItems: ActualItemInput[]
  ): Promise<{
    pickupId: string;
    status: string;
    payout: number;
    estimateErrorPct: number;
    actualItems: ActualItemInput[];
    completedAt: string;
  }> {
    return this.request(`/pickups/${pickupId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ actualItems }),
    });
  }

  static async getCollectorRoute(
    collectorId: string,
    start?: { lat: number; lng: number }
  ): Promise<RouteResponse> {
    return this.request<RouteResponse>(`/collectors/${collectorId}/route`, {
      method: 'POST',
      body: JSON.stringify({ start: start || { lat: 28.7501, lng: 77.1177 } }),
    });
  }

  // ─── Phase 3: Impact ─────────────────────────────────────────────────────────
  static async getImpact(): Promise<ImpactStats> {
    return this.request<ImpactStats>('/impact');
  }
}
