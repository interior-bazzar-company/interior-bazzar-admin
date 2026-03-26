export interface BusinessFilterType {
  sortBy: string;
  searchText: string;
  plan?: string;
}
export interface LeadFilterType {
  sortBy: string;
  searchText: string;
  category: string;
  leadStatus: string;
  filterStatus: string;
}
export interface TableFilterType {
  sortBy: string;
  searchText: string;
}

/*###########    A N A L Y T I C S    ####################################################################*/
export type DashboardStatsType = {
  totalBusinesses: number;
  weeklySignups: number;
  totalActiveBusinesses: number;
  totalInactiveBusinesses: number;
  plan_metrics: Record<string, number>;
};
export interface MetricCardType {
  title: string;
  value: number;
  colorHex?: string;
}

export interface LeadsDashboardStatsType {
  unassignedLeads: number;
  assignedLeads: number;
  platformLeads: number;
  totalLeads: number;
  todayLeads: number;
  statusMetrics: Record<string, number>;
  adminStatusMetrics: Record<string, number>;
  stageMetrics: Record<string, number>;
  categoryMetrics: Record<string, number>;
}

export interface SignupData {
  date: string;
  clients: number;
  businesses: number;
  users: number;
}

export interface DashboardV2Type {
  totalBusinesses: number;
  weeklySignups: number;
  totalActiveBusinesses: number;
  totalInactiveBusinesses: number;
  plan_metrics: Record<string, number>;
}

/*###########    E      N      D    ####################################################################*/

export interface PlanType {
  id: number;
  name: string;
  features: string[];
  price: number;
  type: "listing" | "filter";
  description: string;
  video: string;
  fallback: string;
  plan_pdf: string;
}

export interface BusinessCardProps {
  id: number;
  since: string;
  rating: string;
  timeAgo: string;
  location: string;
  category: string;
  badge?: string;
  ratingValue: number;
  companyName: string;
  membershipId: string;
  businessName: string;
  businessImage: string;
}

export interface AdsQueryForm {
  id?: number;
  phone: string;
  interested: string;
  name: string;
  email: string;
  query: string;
  city: string;
  country: string;
}

export interface AdminLeadType {
  id: number;
  date: string;
  updatedAt: string;
  name: string;
  phone: string;
  email: string;
  interested: string | null;
  query: string | null;
  country: string;
  city: string;
  assigned: string | null;
  leadStatus?: string;
  category?: string|null;
  stage?: string;
  state?: string;
  type?: 'product' | 'service' | 'catalogue';
  itemId?: number;
  status?: string;
  tag?: string;
  priority?: string;
  remark?: string;
  logs?: Array<{
    event: string;
    timestamp: string;
  }>;
  clientLogs?: Array<{
    by: string;
    message: string;
  }>;
}

export interface FunnelLeadType {
  id: number;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  planType: string;
  plan: string;
  intrest: string;
}
export interface AdminBusinessPlanType {
  id: number;
  name: string;
  expiryDate: string;
  isActive: boolean;
  amount: string;
}

export interface AdminBusinessListType {
  id: number;
  name: string;
  plan: string; // ✅ FIXED
  joinAt: string;
  lastPurchase: string;
  expireAt: string;
  date: string;
  totalLeads: number;
  assignedLeads: number;
  platformLeads: number;
}
export interface AdminBusinessListTypeV2 {
  id: number;
  name: string;
  plan: string;
  joinAt: string;
  lastPurchase: string;
  expireAt: string;
  date: string;
  totalLeads: number;
  assignedLead: number;
  platformLead: number;
}


export type AdminLeadFormType = Omit<AdminLeadType, "id"> & { id?: number };

export interface BusinessType {
  id: number;
  badge: string;
  bio: string;
  businessName: string;
  category: string;
  city: string;
  country: string;
  coverImageUrl: string;
  gst: string;
  location_link: string;
  pin_code: string;
  segment: string;
  since: string;
  state: string;
  updated_at: string;
  whatsapp: string;
}
