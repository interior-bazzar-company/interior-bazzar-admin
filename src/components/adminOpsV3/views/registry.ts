// ── Admin ops view registry ──
// Maps a module key → its built React view. AdminOpsLayout renders the registered
// view for the active section, or a PlaceholderView for keys not yet ported.
// Each promptsadmin port task (13-40) adds ONE line here + its view folder.
import type { ComponentType } from "react";
import OverviewView from "./OverviewView";
import PlansView from "./PlansView";
import BannersHouseView from "./BannersHouseView";
import BannersAdView from "./BannersAdView";
import TemplatesView from "./TemplatesView";
import BuyersView from "./BuyersView";
import BusinessesView from "./BusinessesView";

export interface AdminViewProps {
  goSection: (key: string) => void;
}

export const VIEW_REGISTRY: Record<string, ComponentType<AdminViewProps>> = {
  overview: OverviewView,
  plans: PlansView,
  "banners-house": BannersHouseView,
  "banners-ad": BannersAdView,
  templates: TemplatesView,
  buyers: BuyersView,
  businesses: BusinessesView,
};
