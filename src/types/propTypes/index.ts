import type { SVGProps } from "react";
import type { ComponentType } from "react";
type IconType = ComponentType<{ className?: string }>;

export type SvgIconProps = SVGProps<SVGSVGElement>;

export interface SidebarSubItem {
  label: string;
  url: string;
}

export interface SidebarItem {
  label: string;
  url?: string;
  icon: IconType;
  submenuKey?: string;
  children?: SidebarSubItem[];
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export interface ToastPropType {
  greeting: string;
  booldMessage: string;
  normalMessage: string;
  type: "success" | "error" | "info" | "warning";
}

export interface QueryFormType {
  id: number;
  leadType: string;
  phoneNumber: string;
  businessType: string;
  budget: string;
  name: string;
  email: string;
  noOfEmp: string;
  companyName: string;
  query: string;
  city: string;
  state: string;
}
