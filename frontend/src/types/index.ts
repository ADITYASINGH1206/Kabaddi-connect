export type Language = 'en' | 'hi';
export type UserRole = 'household' | 'collector' | 'impact' | null;

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

export interface MatchedCollector {
  collectorId: string;
  name: string;
  phone?: string;
  areaName: string;
  distanceKm: number;
  etaMin: number;
  score: number;
  accepts_ewaste?: boolean;
}

export interface DropOffPoint {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  accepts: string[];
  verified: boolean;
  note?: string;
}

export interface BatchHint {
  nearby_open_count: number;
  radius_km: number;
  message_en: string;
  message_hi: string;
}

export interface ListingPriceEstimate {
  price_low: number;
  price_high: number;
  currency: string;
  materials_count: number;
  indicative_notice?: string;
}

export interface CreateListingRequest {
  sellerName: string;
  sellerPhone: string;
  address: string;
  lat: number;
  lng: number;
  pickupWindow: {
    preferredDate: string;
    slot: string; // 'morning' | 'afternoon' | 'evening'
  };
  items: Array<{
    material: string;
    weight_kg_low: number;
    weight_kg_high: number;
    weight_kg_user?: number;
  }>;
  photoKey?: string;
}

export interface CreateListingResponse {
  listingId: string;
  status: 'OPEN' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  estimate: ListingPriceEstimate;
  matches: MatchedCollector[];
  matchedCollectorIds: string[];
  dropOff?: DropOffPoint[];
  batchHint?: BatchHint;
}

export interface ListingDetailsResponse {
  listingId: string;
  status: 'OPEN' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  estimate: ListingPriceEstimate;
  items: Array<{
    material: string;
    weight_kg_low: number;
    weight_kg_high: number;
    weight_kg_user?: number;
  }>;
  address: string;
  pickupWindow?: {
    preferredDate: string;
    slot: string;
  };
  matchedCollectorIds: string[];
  createdAt: string;
  acceptedCollector?: {
    collectorId: string;
    name: string;
    phone: string;
    areaName: string;
    distanceKm?: number;
    etaMin?: number;
  };
}

export interface Collector {
  collectorId: string;
  name: string;
  areaName: string;
  lat: number;
  lng: number;
  accepts_ewaste: boolean;
  phone?: string;
}

export interface CollectorRequestItem {
  listingId: string;
  sellerName: string;
  sellerPhone?: string;
  address: string;
  lat: number;
  lng: number;
  items: Array<{
    material: string;
    weight_kg_low: number;
    weight_kg_high: number;
    weight_kg_user?: number;
  }>;
  materials: string[];
  total_kg_range: {
    low: number;
    high: number;
  };
  estimated_value_mid: number;
  distanceKm: number;
  worthIt: boolean;
  score: number;
  createdAt?: string;
}

export interface RouteStop {
  stopIndex: number;
  listingId: string;
  sellerName: string;
  sellerPhone: string;
  address: string;
  lat: number;
  lng: number;
  distanceFromPrevKm: number;
  cumulativeKm: number;
  etaMin: number;
  items: Array<{
    material: string;
    weight_kg_low?: number;
    weight_kg_high?: number;
  }>;
}

export interface RouteResponse {
  collectorId: string;
  stopsCount: number;
  totalKm: number;
  totalMin: number;
  naiveKm: number;
  kmSaved: number;
  usedFallback: boolean;
  polyline: {
    type: string;
    coordinates: number[][];
  };
  stops: RouteStop[];
}

export interface ActualItemInput {
  material: string;
  actual_kg: number;
}

export interface PickupRecord {
  pickupId: string;
  listingId: string;
  collectorId: string;
  status: 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
  acceptedAt: string;
  sellerName: string;
  sellerPhone: string;
  address: string;
  lat: number;
  lng: number;
  items: Array<{
    material: string;
    weight_kg_low: number;
    weight_kg_high: number;
  }>;
  actualItems?: ActualItemInput[];
  payout?: number;
  estimateErrorPct?: number;
  completedAt?: string;
}

export interface ImpactStats {
  total_kg_diverted: number;
  diverted_by_material: Record<string, number>;
  collector_income_facilitated_inr: number;
  pickups_completed: number;
  live_pickups_count: number;
  seeded_pickups_count: number;
  km_saved: number;
  ewaste_items_redirected: number;
  weight_estimation_mape_pct: number | null;
  weight_estimation_sample_size?: number;
  km_saved_is_demo_baseline?: boolean;
  co2e_avoided_kg: number;
  emissionSource: string;
  is_stub: boolean;
}
