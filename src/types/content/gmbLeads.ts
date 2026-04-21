export interface GMBLogType {
  event: string;
  timestamp: string;
  triggered_by?: string;
}

export interface GMBLeadType {
  id: number;
  businessName: string;
  rating?: string;
  ratingValue?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  website?: string;
  mapLink?: string;
  gmbLink?: string;
  socialLinks?: string[];
  waMessage?: string;
  assignedUser?: any;
  assignedUserId?: number | null;
  rankingRate?: number;
  tier?: string;
  platform?: string;
  remark?: string;
  category?: string;
  city?: string;
  state?: string;
  status?: string;
  logs?: GMBLogType[];
  createdAt?: string;
  updatedAt?: string;
}

export interface GMBLeadResponse {
  leads: GMBLeadType[];
  currentPage: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
}

export interface GMBKPIType {
  label: string;
  value: string;
  count: number;
}

export interface GMBKPIDataType {
  state: GMBKPIType[];
  city: GMBKPIType[];
  status: GMBKPIType[];
  platform: GMBKPIType[];
  rating: GMBKPIType[];
}
