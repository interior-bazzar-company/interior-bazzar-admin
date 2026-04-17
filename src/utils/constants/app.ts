export const AUTH_VARS = {
  ACCESS: "accessToken",
  REFRESH: "refreshToken",
  SESSION: "sessionKey",
};

export const RESEND_COOLDOWN = 30; //seconds

export const PAGES = {
  HOME: "/",
  SELLER_BUYER: "/seller-buyer",
  BLOGS: "/blog",
  BLOGDETAIL: "/blog/:slug",
  PLANS: "/plan",
  FAQ: "/faqs",
  DISCLAIMER: "/disclaimer",
  RETURNANDREFUND: "/return-and-refund-policy",
  TERMSANDCONDITION: "/terms-and-conditions",
  PRIVACYPOLICY: "/privacy-policy",
  SIGN_UP: "/sign-up",
  SIGN_IN: "/sign-in",
  CONTACTUS: "/contact-us",
  FORGOT_PASSWORD: "/forgot-password",
  // Dashboard pages here..
  DASHBOARD: "/dashboard",
  ADMIN_LEADS: "/admin/leads",
  ADMIN_BUSINESS: "/admin/business",
  ADMIN_BUSINESS_DASHBOARD: "/admin/business-dashboard", // NEW PAGE
  ADMIN_USER_MANAGE: "/admin/manage-users", // NEW PAGE
  ADMIN_ANALYTICS: "/admin/analytics",
  ADMIN_IMAGE_UPLOAD: "/admin/image-upload",
  ADMIN_FUNNEL_LEADS: "/admin/funnel-leads",
  ADMIN_GMB_LEADS: "/admin/gmb-leads",
};

export const EMPLOYEE_ROLES = {
  WORKER: "worker",
  TEAMLEADER: "teamleader",
};

export const LEADSTATUS = {
  DONE: "done",
  DENY: "deny",
  TODAY: "today",
  CRACK: "crack",
  PENDING: "pending",
  FOLLOWUP: "followup",
  HOTPROSPECT: "hotprospect",
} as const;

export const LEADPRIORITY = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  TODAY: "today",
} as const;

// interior bazzar
export const USER_TYPES = {
  USER: "user",
  BUSINESS: "business",
} as const;

export const SERVICES = [
  { id: 1, service: "Manufacturer " },
  { id: 2, service: "Dealer" },
  { id: 3, service: "Distributor" },
  { id: 4, service: "Retailer" },
  { id: 5, service: "Firm" },
];

export const BUDGET_OPTIONS = [
  { id: 1, budget: "10-35 Thousand" },
  { id: 2, budget: "1-2 Lakh" },
  { id: 3, budget: "6 Lakh +" },
];
export type UserRoleValue = (typeof USER_TYPES)[keyof typeof USER_TYPES];

export const IMAGE_PURPOSE = {
  BANNER_IMAGE: "Banner",
  PAYMENT_IMAGE: "PaymentQR",
  BLOG_COVER_IMAGE: "BlogCover",
  PROFILE_IMAGE: "ProfileImage",
  CONTACT_IMAGE: "ContactAttachment",
  SUBSCRIPTION_PDF: "SubscriptionPDF",
  SUBSCRIPTION_VIDEO: "SubscriptionVideo",
  LEAD_QUERY_IMAGE: "LeadQueryAttachment",
  SUBSCRIPTION_IMAGE: "SubscriptionCover",
  BUSINESS_PRIMARY_IMAGE: "BusinessPrimaryImage",
  PAYMENTSCREENSHOT: "PaymentScreenshot",
  BUSINESS_SECONDRY_IMAGE: "BusinessSecondaryImages",
} as const;

// ----- Arrays with label/value -----
export const TAGS = [
  { id: 1, label: "Default", value: "default" },
  { id: 2, label: "Query", value: "query" },
  { id: 3, label: "AI Filtered", value: "aifiltered" },
  { id: 4, label: "Manual Filtered", value: "manualfiltered" },
];
export const STATUS = [
  { id: 1, label: "Default", value: "default" },
  { id: 2, label: "Prospect", value: "prospect" },
  { id: 3, label: "Follow Up", value: "followup" },
  { id: 4, label: "Hot Prospect", value: "hotprospect" },
  { id: 5, label: "Crack", value: "crack" },
  { id: 6, label: "Deny", value: "deny" },
];

export const PRIORITIES = [
  { id: 1, label: "Default", value: "default" },
  { id: 2, label: "Low", value: "low" },
  { id: 3, label: "Medium", value: "medium" },
  { id: 4, label: "High", value: "high" },
];
// make a array of values of tags, stautes and priorities

export const tagsOptions = TAGS.map((item) => item.value);
export const statusOptions = STATUS.map((item) => item.value);
export const priorityOptions = PRIORITIES.map((item) => item.value);

export type TagValueType = (typeof TAGS)[number]["value"];
export type StatusValueType = (typeof STATUS)[number]["value"];
export type PriorityValueType = (typeof PRIORITIES)[number]["value"];
