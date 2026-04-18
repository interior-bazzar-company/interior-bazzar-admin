import type { IconType } from "react-icons";
import type { AUTH_VARS, UserRoleValue } from "../../utils/constants/app";
export type AlertType = "success" | "info" | "warning" | "error";

export interface ShowAlertProps {
  setHandler: React.Dispatch<
    React.SetStateAction<{ message: string; type: AlertType } | null>
  >;
  state: AlertType;
  message?: string;
}

export interface AlertContextType {
  showAlert: (message: string, type: AlertType) => void;
}

export interface AuthState {
  [AUTH_VARS.ACCESS]: string;
  [AUTH_VARS.REFRESH]: string;
  isAuthenticated?: boolean;
}

export interface Merchant {
  id: number;
  businesses: Business[];
}

export interface Business {
  id: number;
  city?: string;
  isActive: boolean;
  isDeleted: boolean;
  businessName: string;
  isSubscribed: boolean;
  completePercentage: number;
}

export interface BusinessContact {
  businessPhone: string;
  businessEmail: string;
}
export interface BusinessPaymentType {
  id: number;
  upiId: string;
  qrCode: string;
  bankName: string;
  ifscCode: string;
  accountNumber: string;
  accountHolderName: string;
}

// export interface BusinessInfo {
//   logo: string;
//   uniqueId: string;
//   popularFor: string;
//   description: string;
//   uniqueIdType: string;
//   establishYear: string;
// }
export interface BusinessCategory {
  id: number;
  name: string;
}
export interface BusinessSubCategory {
  id: number;
  name: string;
}
export interface BusinessDetail {
  coverImage: string;
  businessUsername?: string;
  businessType?: string;
  businessName: string;
  businessCategory: BusinessCategory;
  businessSubCategory: BusinessSubCategory[];
}

export interface BusinessSocialMediaOptions {
  id: number;
  label: string;
  placeholder?: string;
  name: keyof BusinessSocialMedia;
  icon?: string;
  link?: string;
}
export interface BusinessSocialMedia {
  youtube: string;
  twitter: string;
  facebook: string;
  linkedin: string;
  website: string;
  whatsapp: string;
  instagram: string;
  googleReview: string;
}

export interface BusinessBanner {
  index: number;
  image: string;
}

export interface BusinessBannerResponse {
  bannerImage: BusinessBanner[];
}
export interface ProductTType {
  id: number;
  name: string;
}
export interface ProductType {
  id: number;
  name: string;
  price: string;
  index: number;
  pdfLink: string;
  type: ProductTType;
  description: string;
  productTags: string[];
  image: MultipleImageType[];
}

export interface ProductListType extends ProductType {
  connectLink?: string;
}
export interface MultipleImageType {
  index: number;
  image: string;
}

export type ProductFormInput = Omit<ProductType, "id"> & { id?: number };

export interface NavlinkItem {
  url: string;
  label: string;
  icon?: IconType;
}

export interface Sidebarlink extends NavlinkItem {
  subLinks: NavlinkItem[];
}

export interface TableRowType {
  id: number;
  [key: string]: string | number | boolean;
  status: string;
  remark: string;
}

export interface Qna {
  id?: number;
  index: number;
  question: string;
  answer: string;
}

export interface QnaFormProps {
  data?: Qna;
  onSubmit: (data: Qna) => void;
}

// custom lead gen form

export interface FormInput {
  name: string;
  label: string;
  type:
    | "text"
    | "date"
    | "time"
    | "select"
    | "radio"
    | "textarea"
    | "range"
    | "number"
    | "progress";
  required?: boolean;
  placeholder?: string;
  pattern?: string;
  errorMessage?: string;
  options?: string[]; // for radio and select
  min?: number;
  max?: number;
  step?: number;
  value?: number; // only used in progress
}

export interface ClientForm {
  title: string;
  active: boolean;
  submitButtonText: string;
  formJson: FormInput[];
}

export interface ProgressBarProps {
  icon?: string; // PNG image URL
  label: string;
  value: number; // 0 - 100
  maxValue?: number;
  color: "orange" | "green" | "red";
}

export interface ProgressCardProps {
  heading: string;
  progressData: ProgressBarProps[];
}

export interface EmployeePerfomanceCardProps {
  heading: string;
  image: string;
  name: string;
  progressData: ProgressBarProps[];
}

export interface PieChartProps {
  label: string;
  color: string;
  percentage: number;
}

export interface OverviewData {
  label: string;
  icon: string;
  no: number;
}

export interface OverviewCardProps {
  heading: string;
  data: OverviewData[];
}

export interface PieChartData {
  color: string;
  label: string;
  percentage: number;
}

export interface PieChartCardProps {
  heading: string;
  data: PieChartData[];
}
// Business Detail page
export interface TopstripConfig {
  text: string;
  speed?: number;
  show?: boolean;
  link?: string;
}

export interface TopstripProps {
  config: TopstripConfig;
}
// business banner
export interface BannerConfig {
  businessName: string;
  bannerImage: BusinessBanner[];
  merchantImage: string;
  logo: string;
}

export interface BannerProps {
  config: BannerConfig;
}

// business Info

export interface BusinessInfoConfig {
  coverImage: string;
  socialMedia: BusinessSocialMedia;
  businessInfo: {
    businessName: string;
    businessTags: BusinessSubCategory[];
  };
  businessContact: {
    businessPhone: string;
    businessEmail: string;
  };
  businessLocation: {
    streetAddress: string;
    website: string;
    googleMapLink: string;
  };
  paymentInfo: BusinessPaymentType;
}

export interface BusinessInfoProps {
  config: BusinessInfoConfig;
}

export interface GMBReview {
  cta: string;
  qrCode: string;
  reviewLink: string;
  reviewMessage: string;
  socialMedia: BusinessSocialMediaOptions[];
}

export interface OfferPopupType {
  id: number;
  cta: string;
  link: string;
  title: string;
  image: string;
  openDelay: number;
  closeDelay: number;
  isActive: Boolean;
}

export interface VideoResType {
  fallback: string; // Fallback image path
  src: string; // Video path
}

// payment calculator
export const MAX_USERS = 100;
export interface SelectedAgent {
  id: string; // Unique ID for each selected agent instance
  name: string;
  users: number;
}

export interface AgentCardProps {
  agent: SelectedAgent;
  onUsersChange: (id: string, newUsers: number) => void;
  onRemove: (id: string) => void;
  agentPrice: number; // Price passed as prop for clarity
}

export interface AgentSelectorProps {
  onAddAgent: (agentName: string) => void;
  availableAgents: string[];
}

interface Pricing {
  [key: string]: number;
}

export const AGENT_PRICING: Pricing = {
  "Sales AI Agent": 200,
  "Lead Generate Agent": 250,
  "Customer Support AI": 180,
  "Data Analysis AI": 300,
};

// Home Page

export interface AIAgentCardType {
  id: number;
  image: string;
  title: string;
  subTitle: string;
  tags: string[];
  buttons: string[];
  link: string;
  isLaunched: boolean;
}

export interface HomeCarouselType {
  id: number;
  index: number;
  image: string;
}

export interface HomeVideoType extends HomeCarouselType {
  video: string;
}

export type VideoType = "video" | "reel" | "square";
export interface VideoPlayerProps {
  video: string;
  fallback: string;
  videoId: string;
  isPlaying: boolean;
  onPlay: () => void;
  type?: VideoType;
  isOverlay?: boolean;
  radius?: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<any>>;
}

export interface VideoTypeTemp {
  id: number;
  type: VideoType;
  fallback: string;
  video: string;
}

export interface VideoDataType {
  type: VideoType;
  fallback: string;
  video: string;
  isOverlay: boolean;
  radius: boolean;
}

export interface AgentTabContent {
  heading: string;
  about: string[];
}

export interface AgentTabs {
  Features: AgentTabContent[];
  Pricing: AgentTabContent[];
  Value: AgentTabContent[];
}

export interface AgentPrice {
  original: number;
  discounted: number;
  discountPercent: number;
  note: string;
}

export interface Agent {
  id: number;
  isLaunched: boolean;
  image: string; // You can replace with a more specific type if needed (e.g., StaticImage type)
  title: string;
  subTitle: string;
  tags: string[];
  buttons: string[];
  link: string;
  badges: string[];
  price: AgentPrice;
  highlights: string[];
  summary: string;
  description: string;
  categoryTags: string[];
  videoThumbnail: string;
  video: string;
  tabs: AgentTabs;
}
//ib blogs

export interface GetBlogResponseType {
  blog: BlogType;
  relatedBlogs: BlogType[];
}
export interface BlogType {
  id: number;
  title: string;
  cover_image_url: string;
  content: string;
  author_name: string;
  author_image: string;
  publish_date: string;
  read_time: string;
}

// Here are new for interior Bazzar......

// auth here..
export interface SignupForm {
  type: string;
  username: string;
  password: string;
  confirmPassword: string;
}
export interface SignupFormResponse {
  type: UserRoleValue;
  user_id: number;
  username: string;
  unique_id: string;
  is_active: boolean;
  is_delete: boolean;
  [AUTH_VARS.ACCESS]: string;
  [AUTH_VARS.REFRESH]: string;
}
export interface PlanInfo {
  id: number;
  planId: string;
  planName: string;
  isActive: boolean;
  expireDate?: string;
}

export interface UserProfileResponse extends BaseUser {
  plan?: PlanInfo;
}

export interface LoginFormResponse extends UserProfileResponse {
  [AUTH_VARS.ACCESS]: string;
  [AUTH_VARS.REFRESH]: string;
}

export interface BaseUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  username: string;
  role: UserRoleValue;
  profile_image_url?: string;
  isSuperAdmin: boolean;
  is_superuser?: boolean;
}

export interface LoginForm {
  username: string;
  password: string;
}

export interface ForgetPasswordForm {
  username: string;
}

export interface ForgetPasswordFormResponse {
  hash: string;
}

export interface ChangePasswordForm {
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordFormResponse {
  hash: string;
  password: string;
  confirmPassword: string;
}

export interface ResetPassword {
  password: string;
  oldPassword: string;
}
export interface ResetPasswordResponse {
  password: string;
  oldPassword: string;
}
// for handling login of user

export interface BaseUserState {
  user: BaseUser | null;
}

//user
export interface ProfileForm {
  name: string;
  email: string;
  phone: string;
  profile_image_url: string;
}
export interface ProfileFormResponse {
  name: string;
  email: string;
  phone: string;
  profile_image_url: string;
}

//business
export interface BusinessInfo {
  business_name: string;
  category: string;
  segment: string;
}
export interface BusinessLocation {
  city: string;
  state: string;
  pin_code: string;
  country: string;
  location_link: string;
}
