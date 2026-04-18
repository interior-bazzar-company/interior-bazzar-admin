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
