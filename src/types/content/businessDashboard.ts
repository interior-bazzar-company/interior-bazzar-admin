// Business Dashboard specific types
// Kept separate from content/index.ts for full versioning — swap this file to revert.

export interface AdminBusinessDashboardRowType {
  id: number;
  name: string;          // username / business name
  plan: string;          // current active plan label
  joinAt: string;        // created date
  lastPurchase: string;  // last purchase date
  expire: string;        // plan expiry date
  leadsKota: number;     // lead quota
  assignedLeads: number;
  platformLeads: number;
  totalLeads: number;
  feedback?: string;     // e.g. "Ask" | feedback status
  logs?: number;         // count of logs
  logsDate?: string;     // date of most recent log
  buyPlan?: string;      // e.g. "Sales" — plan for buy recommendation
  remark?: string;       // free-text remark saved by admin
}

export interface BusinessDashboardStatsType {
  totalBusiness: number;
  registered: number;
  planPurchased: number;
  networkLeader: number;
  plan_metrics: Record<string, number>;
  totalBusinesses?: number;        // From Analytics V2 backend
  totalActiveBusinesses?: number;  // From Analytics V2 backend
}
