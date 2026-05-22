export interface Hotel {
  id: string;
  name: string;
  url: string;
  pricePerNight: number;
  totalPrice: number;
  nights: number;
  rating: number;
  reviewCount: number;
  location: string;
  stars?: number;
  imageUrl?: string;
  reviewAnalysis?: ReviewAnalysis;
  valueScore?: number;
  currency?: string;
  dealRating?: 'excellent' | 'good' | 'fair' | 'expensive';
  dealNote?: string;
  platformAlternatives?: Hotel[]; // same hotel on other OTAs
  priceUnavailable?: boolean;
}

export interface ReviewAnalysis {
  pros: string[];
  cons: string[];
  authenticityScore: number;
  authenticityReason: string;
  bestFor: string;
  summary: string;
}

export interface StaySegment {
  hotel: Hotel;
  checkin: string;
  checkout: string;
  nights: number;
  totalCost: number;
}

export interface SplitOption {
  segments: StaySegment[];
  totalCost: number;
  avgRating: number;
  splitLabel: string;
}

export interface OptimizationResult {
  singleBest: Hotel | null;
  splitOptions: SplitOption[];
  bestSplit: SplitOption | null;
  recommendation: 'single' | 'split';
  savings: number;
  topHotels: Hotel[];
  city: string;
  checkin: string;
  checkout: string;
  totalNights: number;
}

export interface ProgressEvent {
  type: 'progress' | 'hotel_found' | 'review_done' | 'complete' | 'error';
  message?: string;
  step?: number;
  totalSteps?: number;
  data?: Partial<OptimizationResult>;
  hotelName?: string;
  error?: string;
}

export interface SearchParams {
  urls: string[];
  checkin: string;
  checkout: string;
  guests?: number;
}
