export type Language = 'en' | 'hi';
export type UserRole = 'household' | 'collector' | null;

export interface MaterialRate {
  material: string;
  label_en: string;
  label_hi: string;
  rate_low: number;
  rate_high: number;
  unit: string;
  hazardous: boolean;
  authorised_channel_only: boolean;
  co2e_factor?: number;
}

export interface DetectedItem {
  id: string; // unique local ID for UI manipulation
  material: string;
  weight_kg_low: number;
  weight_kg_high: number;
  weight_kg_user: number; // edited by slider
  confidence: number;
  note?: string;
  isManual?: boolean;
}

export interface VisionAnalysisResponse {
  photo_quality_ok: boolean;
  retake_reason: string | null;
  items: Array<{
    material: string;
    weight_kg_low: number;
    weight_kg_high: number;
    confidence: number;
    note?: string;
  }>;
  hazards: string[];
  fallback: boolean;
  cached?: boolean;
  fallback_message?: string;
}

export interface UploadResponse {
  uploadUrl: string;
  imageKey: string;
  maxSizeBytes: number;
  contentType: string;
}
