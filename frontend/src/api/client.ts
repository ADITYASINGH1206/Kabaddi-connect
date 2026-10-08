import type { MaterialRate, UploadResponse, VisionAnalysisResponse } from '../types';

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
      try {
        const errJson = await response.json();
        if (errJson.error) errorMsg = errJson.error;
      } catch {
        // ignore JSON parse error on non-json error responses
      }
      throw new Error(errorMsg);
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
      // Fallback default indicative rates for offline or local preview
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
}
