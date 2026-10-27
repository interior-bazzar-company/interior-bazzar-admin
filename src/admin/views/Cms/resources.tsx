/* =============================================================================
   CMS · what each resource is
   -----------------------------------------------------------------------------
   One row per backend resource (interior_admin/Controllers/Cms RESOURCES) —
   the list columns, the editor fields and the live preview. Field keys are the
   backend's own field names, never renamed; "meta.x" reaches into a JSON field.

   Not here, on purpose:
   · Subscriptions & plans (CMS DOCS 05) — already owned by Plans and Finance.
   · Cities (CMS DOCS 09) — there is no City model; a city is Location.city text.
     Listed in BACKEND_REQUESTS.md.
   ============================================================================= */
import { lazy } from "react";
import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import { Pill, fmtDate } from "../../ui";
import type { CmsRow } from "../../../api/modules/cms";

type Preview = LazyExoticComponent<ComponentType<{ v: Record<string, any> }>>;
const MODS = import.meta.glob<{ default: ComponentType<{ v: Record<string, any> }> }>(
  "../../components/cms-previews/*.tsx");
const P = (name: string): Preview => lazy(MODS[`../../components/cms-previews/${name}.tsx`]);

export type FieldSpec = {
  k: string;
  label: string;
  kind?: "text" | "textarea" | "number" | "bool" | "select" | "fk" | "ids" | "picker" | "date" | "datetime"
    | "image" | "rich" | "lines" | "buttons" | "metrics";
  options?: { v: string; l: string }[];
  /** kind "picker": search records by name instead of typing ids */
  picker?: { kind: "business" | "shop" | "architect"; multiple?: boolean; max?: number };
  /** kind "fk": the CMS resource the id points at, and its label column */
  fk?: { res: string; label: string };
  hint?: string;
  req?: boolean;
  rows?: number;
  max?: number;
  mono?: boolean;
  /** S3 upload intent (UrlGenrator FilePath) for kind "image" */
  purpose?: string;
  /** only on a new row (identity that should not drift once live) */
  createOnly?: boolean;
};

export type Col = { label: string; w?: string; cls?: string; cell: (r: CmsRow) => ReactNode };

export type ResSpec = {
  key: string;
  label: string;
  group: string;
  icon: string;
  desc: string;
  noun: string;
  titleOf: (r: CmsRow) => string;
  cols: Col[];
  fields: FieldSpec[];
  /** `options` fixed; or `facet` = the values the server reports; or `fk` = another resource's rows */
  filters?: { k: string; label: string; options?: { v: string; l: string }[]; facet?: boolean; fk?: { res: string; label: string } }[];
  /** the list offers a From / To day range (the server's date_field) */
  dates?: boolean;
  /** hidden from the landing (a helper resource such as the state picker) */
  hidden?: boolean;
  /** exactly one row, edited in place: no New, no /new route */
  singleton?: boolean;
  defaults?: Record<string, unknown>;
  preview?: Preview;
  /** "toggle" = full-width Edit / Preview (long-form, Quill); default split 50/50 */
  mode?: "split" | "toggle";
  reorder?: boolean;
  /** the filter that splits the list into separately ordered sets (banner page) */
  reorderScope?: string;
  readOnly?: boolean;
};

const YES_NO = [{ v: "true", l: "Yes" }, { v: "false", l: "No" }];
const ACTIVE = { k: "isActive", label: "Status", options: [{ v: "true", l: "Live" }, { v: "false", l: "Hidden" }] };
const live = (r: CmsRow) => (r.isActive === false ? <Pill tone="mute" text="Hidden" /> : <Pill tone="ok" dot text="Live" />);
const thumb = (url?: string) => url
  ? <img src={url} alt="" className="h-10 w-14 rounded-md object-cover ring-1 ring-secondary" />
  : <span className="block h-10 w-14 rounded-md bg-secondary ring-1 ring-secondary" />;
/** Line one is clamped so a 400-character title cannot push the columns off screen. */
const two = (a: ReactNode, b?: ReactNode) => (
  <><span className="line-clamp-2 break-words">{a}</span>{b ? <div className="cell-2 line-clamp-1 break-all">{b}</div> : null}</>
);
/** The LOCAL calendar day of a date or an instant (an instant is UTC on the wire). */
const when = (s?: string) => {
  if (!s) return "—";
  if (s.length <= 10) return fmtDate(s);
  const d = new Date(s);
  return fmtDate(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"));
};
const LOGO_STATE: Record<string, string> = { live: "Live now", scheduled: "Scheduled", ended: "Ended", always: "Always on" };
const LOGO_TONE: Record<string, string> = { live: "ok", scheduled: "warn", ended: "mute" };
const ORDER: FieldSpec = { k: "displayOrder", label: "Display order", kind: "number", hint: "Ascending — or drag in the list." };

const TAXO_FIELDS: FieldSpec[] = [
  { k: "lable", label: "Label", req: true, hint: "What visitors read." },
  { k: "value", label: "Value (slug)", req: true, mono: true, createOnly: true, hint: "Machine key; fixed once live." },
  { k: "shortValue", label: "Short label", hint: "Compact chip text on phones." },
  { k: "imageSQUrl", label: "Square image", kind: "image", purpose: "Banner" },
  { k: "imageRTUrl", label: "Rectangle image", kind: "image", purpose: "Banner" },
  { k: "trending", label: "Trending", kind: "bool" },
];
const taxoCols: Col[] = [
  { label: "", w: "72px", cell: (r) => thumb(r.imageSQUrl || r.imageRTUrl) },
  { label: "Label", cell: (r) => two(r.lable, r.value) },
  { label: "Short", w: "140px", cell: (r) => r.shortValue || "—" },
  { label: "Trending", w: "100px", cell: (r) => (r.trending ? <Pill tone="warn" text="Trending" /> : "—") },
];

export const RESOURCES: ResSpec[] = [
  /* ------------------------------------------------------------ editorial */
  {
    key: "blog", label: "Blog & Articles", group: "Editorial", icon: "doc", noun: "article",
    desc: "Write, publish and feature design articles.",
    titleOf: (r) => r.title || "Untitled article",
    mode: "toggle", preview: P("BlogArticleReaderPreview"),
    defaults: { status: "draft", isFeatured: false, featuredOrder: 0 },
    filters: [
      { k: "status", label: "Status", options: [{ v: "published", l: "Published" }, { v: "draft", l: "Draft" }] },
      { k: "isFeatured", label: "Featured", options: YES_NO },
    ],
    dates: true,
    cols: [
      { label: "", w: "72px", cell: (r) => thumb(r.coverImageUrl) },
      { label: "Title", cell: (r) => two(r.title || "Untitled", "/blog/" + (r.slug || "")) },
      { label: "Author", w: "160px", cell: (r) => r.author || "—" },
      { label: "Status", w: "110px", cell: (r) => (r.status === "published" ? <Pill tone="ok" dot text="Published" /> : <Pill tone="warn" text="Draft" />) },
      { label: "Featured", w: "100px", cell: (r) => (r.isFeatured ? "#" + (r.featuredOrder || 0) : "—") },
      { label: "Updated", w: "120px", cell: (r) => when(r.updatedAt) },
    ],
    fields: [
      { k: "title", label: "Title", req: true },
      { k: "slug", label: "Slug", mono: true, hint: "Blank = made from the title." },
      { k: "author", label: "Author", req: true },
      { k: "authorImageUrl", label: "Author photo", kind: "image", purpose: "BlogCover" },
      { k: "coverImageUrl", label: "Cover image", kind: "image", purpose: "BlogCover" },
      { k: "status", label: "Status", kind: "select", options: [{ v: "draft", l: "Draft" }, { v: "published", l: "Published" }] },
      { k: "isFeatured", label: "Featured", kind: "bool" },
      { k: "featuredOrder", label: "Featured position", kind: "number" },
      { k: "metaTitle", label: "SEO title" },
      { k: "metaDescription", label: "SEO description", kind: "textarea", rows: 2 },
      { k: "focusKeyword", label: "Focus keyword" },
      { k: "description", label: "Article", kind: "rich" },
    ],
  },
  {
    key: "pages", label: "Static & Legal Pages", group: "Editorial", icon: "shield", noun: "page",
    desc: "Terms, privacy, refund and the other policy and info pages.",
    titleOf: (r) => r.title || r.pageName,
    mode: "toggle", preview: P("LegalPageReaderPreview"),
    defaults: { meta: {} },
    cols: [
      { label: "Page", cell: (r) => two(r.title || "Untitled", r.pageName) },
      { label: "Version", w: "100px", cell: (r) => r.meta?.version || "—" },
      { label: "Effective", w: "140px", cell: (r) => r.meta?.effective || "—" },
      { label: "Updated", w: "120px", cell: (r) => when(r.updatedAt) },
    ],
    fields: [
      { k: "title", label: "Title", req: true },
      { k: "pageName", label: "Slug", req: true, mono: true, createOnly: true, hint: "The URL key: lowercase, numbers, hyphens (privacy-policy). Fixed once live." },
      { k: "meta.eyebrow", label: "Eyebrow" },
      { k: "meta.sub", label: "Subtitle" },
      { k: "meta.version", label: "Version" },
      { k: "meta.effective", label: "Effective date", hint: "As printed, e.g. 15 October 2026." },
      { k: "meta.operatedBy", label: "Operated by" },
      { k: "meta.cin", label: "CIN", mono: true },
      { k: "meta.seo.title", label: "SEO title" },
      { k: "meta.seo.description", label: "SEO description", kind: "textarea", rows: 2 },
      { k: "content", label: "Document", kind: "rich" },
    ],
  },
  /* -------------------------------------------------------------- homepage */
  {
    key: "banners", label: "Hero Banners", group: "Homepage & Brand", icon: "image", noun: "slide",
    desc: "Hero carousels on Home, Architects, Shops and the other pages.",
    titleOf: (r) => r.title || r.tag || "Image slide",
    preview: P("HeroBannerPreview"), reorder: true, reorderScope: "page",
    defaults: { page: "home", audience: "all", isActive: true, backgroundGradient: "green", buttons: [], metrics: [] },
    filters: [
      { k: "page", label: "Page", options: ["home", "architects", "shops", "products", "businesses", "catalogues", "about", "blog", "explore", "contact"].map((v) => ({ v, l: v[0].toUpperCase() + v.slice(1) })) },
      { k: "audience", label: "Audience", options: [{ v: "all", l: "Everyone" }, { v: "buyers", l: "Buyers" }, { v: "sellers", l: "Business owners" }] },
      ACTIVE,
    ],
    cols: [
      { label: "#", w: "56px", cls: "n", cell: (r) => r.displayOrder },
      { label: "", w: "72px", cell: (r) => thumb(r.backgroundImageUrl) },
      { label: "Slide", cell: (r) => two(r.title || "Image only", r.tag) },
      { label: "Page", w: "120px", cell: (r) => r.page },
      { label: "Audience", w: "120px", cell: (r) => r.audience },
      { label: "Window", w: "170px", cell: (r) => (r.startsAt || r.endsAt ? when(r.startsAt) + " → " + when(r.endsAt) : "Always") },
      { label: "Status", w: "100px", cell: live },
    ],
    fields: [
      { k: "page", label: "Page", kind: "select", options: ["home", "architects", "shops", "products", "businesses", "catalogues", "about", "blog", "explore", "contact"].map((v) => ({ v, l: v })) },
      { k: "audience", label: "Audience", kind: "select", options: [{ v: "all", l: "Everyone" }, { v: "buyers", l: "Signed-in buyers" }, { v: "sellers", l: "Business owners" }] },
      { k: "tag", label: "Eyebrow tag", max: 100 },
      { k: "title", label: "Headline", hint: "Leave blank when the artwork carries its own copy." },
      { k: "description", label: "Description", kind: "textarea", rows: 3 },
      /* A theme key only: the public carousel recognises these four and paints
         nothing for any other value (HeroCarousel toTheme). */
      { k: "backgroundGradient", label: "Background theme", kind: "select",
        options: [{ v: "", l: "None (image only)" }, { v: "green", l: "Green" }, { v: "amber", l: "Amber" }, { v: "navy", l: "Navy" }, { v: "plum", l: "Plum" }],
        hint: "With no theme and no image the slide has no background on the site." },
      { k: "backgroundImageUrl", label: "Background image", kind: "image", purpose: "Banner" },
      { k: "buttons", label: "Buttons (max 2)", kind: "buttons" },
      { k: "metrics", label: "Metrics (max 3)", kind: "metrics" },
      { k: "businesses", label: "Featured businesses", kind: "picker", picker: { kind: "business", multiple: true, max: 2 },
        hint: "Up to 2 are shown on the slide." },
      { k: "startsAt", label: "Starts", kind: "datetime" },
      { k: "endsAt", label: "Ends", kind: "datetime" },
      ORDER,
      { k: "isActive", label: "Live", kind: "bool" },
    ],
  },
  {
    key: "brand-logos", label: "Brand Logos", group: "Homepage & Brand", icon: "star", noun: "logo",
    desc: "Festive and campaign logos, each live for a date window.",
    titleOf: (r) => r.label || "Logo",
    preview: P("BrandLogoPreview"),
    cols: [
      { label: "", w: "72px", cell: (r) => thumb(r.imageUrl) },
      { label: "Campaign", cell: (r) => two(r.label, r.tagline) },
      { label: "From", w: "130px", cell: (r) => when(r.activeFrom) },
      { label: "To", w: "130px", cell: (r) => when(r.activeTo) },
      { label: "State", w: "120px", cell: (r) => <Pill tone={LOGO_TONE[r.state] || ""} dot={r.state === "live"} text={LOGO_STATE[r.state] || r.state} /> },
    ],
    fields: [
      { k: "label", label: "Campaign label", req: true },
      { k: "imageUrl", label: "Logo image", kind: "image", purpose: "Banner", req: true },
      { k: "tagline", label: "Tagline" },
      { k: "activeFrom", label: "Active from", kind: "date", hint: "Blank = always." },
      { k: "activeTo", label: "Active to", kind: "date", hint: "Blank = open-ended." },
    ],
  },
  {
    key: "brand-asset", label: "Default Logo", group: "Homepage & Brand", icon: "star", noun: "logo", singleton: true,
    desc: "The baseline logo, favicon and tagline — shown whenever no dated campaign logo is live.",
    titleOf: () => "Default logo", preview: P("BrandLogoPreview"),
    cols: [
      { label: "", w: "72px", cell: (r) => thumb(r.logoUrl) },
      { label: "Tagline", cell: (r) => r.tagline || "—" },
      { label: "Updated", w: "120px", cell: (r) => when(r.updatedAt) },
    ],
    fields: [
      { k: "logoUrl", label: "Logo", kind: "image", purpose: "Banner" },
      { k: "faviconUrl", label: "Favicon", kind: "image", purpose: "Banner" },
      { k: "tagline", label: "Tagline", max: 200 },
    ],
  },
  {
    key: "home-ideas", label: "Home Idea Tiles", group: "Homepage & Brand", icon: "image", noun: "tile",
    desc: "The homepage \"Interior Ideas\" tiles and where each one searches.",
    titleOf: (r) => r.label || "Tile", preview: P("HomeIdeaTilePreview"), reorder: true,
    defaults: { isActive: true }, filters: [ACTIVE],
    cols: [
      { label: "#", w: "56px", cls: "n", cell: (r) => r.displayOrder },
      { label: "", w: "72px", cell: (r) => thumb(r.imageUrl) },
      { label: "Label", cell: (r) => two(r.label, "search: " + r.search) },
      { label: "Status", w: "100px", cell: live },
    ],
    fields: [
      { k: "label", label: "Label", req: true },
      { k: "search", label: "Search query", req: true, mono: true, hint: "e.g. modular-kitchen" },
      { k: "imageUrl", label: "Image", kind: "image", purpose: "Banner" },
      ORDER,
      { k: "isActive", label: "Live", kind: "bool" },
    ],
  },
  {
    key: "testimonials", label: "Testimonials", group: "Homepage & Brand", icon: "chat", noun: "testimonial",
    desc: "Members on what Interior Bazzar did for them. Each must link to exactly one member.",
    titleOf: (r) => r.authorName || "Testimonial", preview: P("TestimonialCardPreview"), reorder: true,
    defaults: { rating: 5, isActive: true }, filters: [ACTIVE],
    cols: [
      { label: "#", w: "56px", cls: "n", cell: (r) => r.index },
      { label: "Author", cell: (r) => two(r.authorName, [r.authorRole, r.businessName].filter(Boolean).join(" · ")) },
      { label: "Member", w: "180px", cell: (r) => r.memberName || <Pill tone="bad" text="Unlinked" /> },
      { label: "Rating", w: "90px", cell: (r) => "★".repeat(r.rating || 0) },
      { label: "Status", w: "100px", cell: live },
    ],
    fields: [
      { k: "authorName", label: "Author name", req: true },
      { k: "authorRole", label: "Role" },
      { k: "businessName", label: "Business name" },
      { k: "quote", label: "Quote", kind: "textarea", rows: 4, req: true },
      { k: "rating", label: "Rating", kind: "select", options: ["5", "4", "3", "2", "1"].map((v) => ({ v, l: v + " ★" })) },
      { k: "thumbnailUrl", label: "Photo / video cover", kind: "image", purpose: "Banner" },
      { k: "videoUrl", label: "Video URL" },
      { k: "business", label: "Business", kind: "picker", picker: { kind: "business" }, hint: "Exactly one of business / shop / architect." },
      { k: "shop", label: "Shop", kind: "picker", picker: { kind: "shop" } },
      { k: "architect", label: "Architect", kind: "picker", picker: { kind: "architect" } },
      { k: "index", label: "Position", kind: "number" },
      { k: "isActive", label: "Live", kind: "bool" },
    ],
  },
  {
    key: "team", label: "Team Members", group: "Homepage & Brand", icon: "team", noun: "member",
    desc: "The About page team grid, including the hiring card.",
    titleOf: (r) => r.name || "Member", preview: P("TeamCardPreview"), reorder: true,
    defaults: { isActive: true, isPlaceholder: false }, filters: [ACTIVE],
    cols: [
      { label: "#", w: "56px", cls: "n", cell: (r) => r.displayOrder },
      { label: "", w: "72px", cell: (r) => thumb(r.photoUrl) },
      { label: "Name", cell: (r) => two(r.name, r.role) },
      { label: "Card", w: "120px", cell: (r) => (r.isPlaceholder ? <Pill text="Hiring card" /> : "Person") },
      { label: "Status", w: "100px", cell: live },
    ],
    fields: [
      { k: "name", label: "Name", req: true },
      { k: "role", label: "Role" },
      { k: "photoUrl", label: "Photo", kind: "image", purpose: "Banner" },
      { k: "initials", label: "Initials", max: 6, hint: "Shown when there is no photo." },
      { k: "gradient", label: "Initials background", hint: "CSS gradient." },
      { k: "bio", label: "Bio", kind: "textarea", rows: 3 },
      { k: "isPlaceholder", label: "Hiring / join-us card", kind: "bool" },
      ORDER,
      { k: "isActive", label: "Live", kind: "bool" },
    ],
  },
  /* -------------------------------------------------------------- taxonomy */
  {
    key: "business-categories", label: "Business Categories", group: "Taxonomy", icon: "tag", noun: "category",
    desc: "Industry categories and the Home category board order.",
    titleOf: (r) => r.lable || r.value, preview: P("CategoryCardPreview"), reorder: true,
    defaults: { isActive: true }, filters: [{ k: "trending", label: "Trending", options: YES_NO }, ACTIVE],
    cols: [{ label: "#", w: "56px", cls: "n", cell: (r) => r.index }, ...taxoCols, { label: "Status", w: "100px", cell: live }],
    fields: [...TAXO_FIELDS, { k: "index", label: "Board position", kind: "number" }, { k: "isActive", label: "Live", kind: "bool" }],
  },
  {
    key: "product-categories", label: "Product & Service Categories", group: "Taxonomy", icon: "tag", noun: "category",
    desc: "Product and service categories (service rows start with svc-). Only unused ones can be deleted.",
    titleOf: (r) => r.lable || r.value, preview: P("CategoryCardPreview"), reorder: true,
    filters: [{ k: "trending", label: "Trending", options: YES_NO }],
    cols: [{ label: "#", w: "56px", cls: "n", cell: (r) => r.index }, ...taxoCols],
    fields: [...TAXO_FIELDS, { k: "index", label: "Position", kind: "number" }],
  },
  {
    key: "business-segments", label: "Business Segments", group: "Taxonomy", icon: "tag", noun: "segment",
    desc: "Specialities under a business type and its categories.",
    titleOf: (r) => r.lable || r.value, preview: P("SegmentChipPreview"),
    defaults: { isActive: true },
    filters: [
      { k: "businessType", label: "Type", fk: { res: "business-types", label: "lable" } },
      { k: "businessCategory", label: "Category", fk: { res: "business-categories", label: "lable" } },
      ACTIVE,
    ],
    cols: [...taxoCols,
      { label: "Parent", w: "220px", cell: (r) => two(r.businessTypeLabel || "—", (r.categoryLabels || []).join(", ")) },
      { label: "Status", w: "100px", cell: live }],
    fields: [
      { k: "businessType", label: "Business type", kind: "fk", fk: { res: "business-types", label: "lable" } },
      { k: "businessCategory", label: "Category ids", kind: "ids", hint: "Ids from Business Categories." },
      ...TAXO_FIELDS, { k: "isActive", label: "Live", kind: "bool" },
    ],
  },
  {
    key: "product-subcategories", label: "Product Sub-Categories", group: "Taxonomy", icon: "tag", noun: "sub-category",
    desc: "Sub-categories under a product or service category. Only unused ones can be deleted.",
    titleOf: (r) => r.lable || r.value, preview: P("SegmentChipPreview"), reorder: true, reorderScope: "category",
    filters: [{ k: "category", label: "Parent", fk: { res: "product-categories", label: "lable" } }],
    cols: [{ label: "#", w: "56px", cls: "n", cell: (r) => r.index }, ...taxoCols,
      { label: "Parent", w: "180px", cell: (r) => r.categoryLabel || "—" }],
    fields: [
      { k: "category", label: "Parent category", kind: "fk", fk: { res: "product-categories", label: "lable" }, req: true },
      ...TAXO_FIELDS, { k: "index", label: "Position", kind: "number" },
    ],
  },
  {
    key: "business-types", label: "Business Types", group: "Taxonomy", icon: "deal", noun: "type",
    desc: "Architect, Interior Designer, Shop… Only unused ones can be deleted.",
    titleOf: (r) => r.lable || r.value, preview: P("CategoryCardPreview"),
    cols: taxoCols, fields: TAXO_FIELDS,
  },
  {
    key: "badges", label: "Trust Badges", group: "Taxonomy", icon: "shield", noun: "badge",
    desc: "Badges shown beside a business name.",
    titleOf: (r) => r.type || "Badge", preview: P("TrustBadgePreview"),
    cols: [
      { label: "", w: "72px", cell: (r) => thumb(r.imageUrl) },
      { label: "Badge", cell: (r) => r.type },
      { label: "Default", w: "100px", cell: (r) => (r.isDefault ? "Yes" : "—") },
    ],
    fields: [
      { k: "type", label: "Badge name", req: true },
      { k: "imageUrl", label: "Icon", kind: "image", purpose: "BusinessBadge" },
      { k: "isDefault", label: "Default badge", kind: "bool" },
    ],
  },
  {
    key: "seller-options", label: "Seller Wizard Options", group: "Taxonomy", icon: "list", noun: "option",
    desc: "The choices sellers pick from in onboarding, grouped by key.",
    titleOf: (r) => r.label || r.value, reorder: true, reorderScope: "key",
    defaults: { isActive: true, meta: {} }, filters: [{ k: "key", label: "Group", facet: true }, ACTIVE],
    cols: [
      { label: "Key", w: "180px", cell: (r) => <span className="font-mono text-xs">{r.key}</span> },
      { label: "Option", cell: (r) => two(r.label, r.value) },
      { label: "#", w: "56px", cls: "n", cell: (r) => r.index },
      { label: "Status", w: "100px", cell: live },
    ],
    fields: [
      { k: "key", label: "Group key", req: true, mono: true },
      { k: "value", label: "Value", req: true, mono: true },
      { k: "label", label: "Label", req: true },
      { k: "index", label: "Position", kind: "number" },
      { k: "isActive", label: "Live", kind: "bool" },
    ],
  },
  /* --------------------------------------------------------------- support */
  {
    key: "faqs", label: "Help FAQs", group: "Support", icon: "info", noun: "FAQ",
    desc: "Help Center questions and answers.",
    titleOf: (r) => r.question || "FAQ", preview: P("FaqAccordionPreview"), reorder: true,
    defaults: { isActive: true }, filters: [ACTIVE],
    cols: [
      { label: "#", w: "56px", cls: "n", cell: (r) => r.displayOrder },
      { label: "Question", cell: (r) => two(r.question, String(r.answer || "").replace(/<[^>]+>/g, "").slice(0, 110)) },
      { label: "Status", w: "100px", cell: live },
    ],
    fields: [
      { k: "question", label: "Question", req: true },
      { k: "answer", label: "Answer", kind: "textarea", rows: 6, hint: "Simple HTML links are kept." },
      ORDER,
      { k: "isActive", label: "Live", kind: "bool" },
    ],
  },
  {
    key: "help-topics", label: "Help Topics", group: "Support", icon: "list", noun: "topic",
    desc: "The topic tiles on the Help Center.",
    titleOf: (r) => r.title || "Topic", reorder: true,
    defaults: { isActive: true }, filters: [ACTIVE],
    cols: [
      { label: "#", w: "56px", cls: "n", cell: (r) => r.displayOrder },
      { label: "Topic", cell: (r) => two(r.title, r.icon) },
      { label: "Articles", w: "100px", cls: "n", cell: (r) => r.articleCount },
      { label: "Status", w: "100px", cell: live },
    ],
    fields: [
      { k: "title", label: "Title", req: true },
      { k: "icon", label: "Icon name" },
      { k: "iconBg", label: "Icon background" },
      { k: "iconColor", label: "Icon colour" },
      { k: "articleCount", label: "Article count", kind: "number" },
      ORDER,
      { k: "isActive", label: "Live", kind: "bool" },
    ],
  },
  {
    key: "support-config", label: "Support Channels", group: "Support", icon: "phone", noun: "settings", singleton: true,
    desc: "The support email, phone, WhatsApp and hours the site shows.",
    titleOf: () => "Support channels",
    cols: [
      { label: "Email", cell: (r) => r.supportEmail || "—" },
      { label: "Phone", w: "160px", cell: (r) => r.phone || "—" },
      { label: "WhatsApp", w: "160px", cell: (r) => r.whatsapp || "—" },
      { label: "Hours", w: "220px", cell: (r) => r.hours || "—" },
    ],
    fields: [
      { k: "supportEmail", label: "Support email" },
      { k: "phone", label: "Phone" },
      { k: "whatsapp", label: "WhatsApp" },
      { k: "tollFree", label: "Toll-free" },
      { k: "hours", label: "Hours", hint: "e.g. Mon–Sat 9:30 AM – 7:00 PM IST" },
      { k: "officeAddress", label: "Office address", kind: "textarea", rows: 3 },
      { k: "liveChatAvailable", label: "Live chat available", kind: "bool" },
      { k: "agentCount", label: "Agents online", kind: "number" },
    ],
  },
  /* ------------------------------------------------------------ locations */
  {
    key: "cities", label: "Cities", group: "Locations", icon: "pin", noun: "city",
    desc: "One spelling per city, its aliases, tier, and which cities lead the city picker.",
    titleOf: (r) => r.name || "City", preview: P("CityPillPreview"), reorder: true,
    defaults: { tier: "tier3", isActive: true, isFeatured: false, aliases: [] },
    filters: [
      { k: "tier", label: "Tier", options: [{ v: "tier1", l: "Tier 1 · Metro" }, { v: "tier2", l: "Tier 2" }, { v: "tier3", l: "Tier 3" }] },
      { k: "isFeatured", label: "Featured", options: YES_NO },
      ACTIVE,
    ],
    cols: [
      { label: "#", w: "56px", cls: "n", cell: (r) => r.displayOrder },
      { label: "City", cell: (r) => two(r.name, (r.aliases || []).join(", ")) },
      { label: "State", w: "150px", cell: (r) => r.stateLabel || "—" },
      { label: "Tier", w: "90px", cell: (r) => (r.tier || "").replace("tier", "T") },
      { label: "Sellers", w: "90px", cls: "n", cell: (r) => r.sellerCount },
      { label: "Featured", w: "100px", cell: (r) => (r.isFeatured ? <Pill tone="ok" text="Featured" /> : "—") },
      { label: "Status", w: "100px", cell: live },
    ],
    fields: [
      { k: "name", label: "Canonical name", req: true, createOnly: true, hint: "The one stored spelling. Fixed once made — add a new spelling as an alias." },
      { k: "state", label: "State", kind: "fk", fk: { res: "states", label: "name" } },
      { k: "tier", label: "Tier", kind: "select", options: [{ v: "tier1", l: "Tier 1 · Metro" }, { v: "tier2", l: "Tier 2 · Growth hub" }, { v: "tier3", l: "Tier 3" }] },
      { k: "lat", label: "Latitude", kind: "number" },
      { k: "lng", label: "Longitude", kind: "number" },
      { k: "aliases", label: "Other spellings (one per line)", kind: "lines", hint: "Typed spellings that resolve to this city, e.g. gurgaon." },
      { k: "isFeatured", label: "Featured in the city picker", kind: "bool", hint: "Shown publicly only once the city has at least one seller." },
      ORDER,
      { k: "isActive", label: "Live", kind: "bool" },
    ],
  },
  {
    key: "states", label: "States", group: "Locations", icon: "pin", noun: "state", hidden: true, readOnly: true,
    desc: "", titleOf: (r) => r.name, cols: [{ label: "State", cell: (r) => r.name }], fields: [],
  },
  /* -------------------------------------------------------------- audience */
  {
    key: "subscribers", label: "Newsletter Subscribers", group: "Audience & Trust", icon: "mail", noun: "subscriber",
    desc: "Everyone who signed up for the newsletter. Export as CSV.",
    titleOf: (r) => r.email, readOnly: true, dates: true,
    filters: [
      { k: "source", label: "Source", facet: true },
      { k: "isActive", label: "Status", options: [{ v: "true", l: "Subscribed" }, { v: "false", l: "Unsubscribed" }] },
      { k: "isConfirmed", label: "Confirmed", options: YES_NO },
    ],
    cols: [
      { label: "Email", cell: (r) => r.email },
      { label: "Source", w: "150px", cell: (r) => r.source },
      { label: "Confirmed", w: "110px", cell: (r) => (r.isConfirmed ? <Pill tone="ok" text="Confirmed" /> : <Pill tone="warn" text="Pending" />) },
      { label: "Status", w: "130px", cell: (r) => (r.isActive ? <Pill tone="ok" dot text="Subscribed" /> : <Pill tone="mute" text="Unsubscribed" />) },
      { label: "Joined", w: "120px", cell: (r) => when(r.timestamp) },
    ],
    fields: [{ k: "isActive", label: "Subscribed", kind: "bool" }],
  },
  {
    key: "kyc", label: "Business Verification", group: "Audience & Trust", icon: "shield", noun: "document",
    desc: "Review storefront photos and legal papers; verify or reject each one.",
    titleOf: (r) => r.businessName + " · " + r.docType, readOnly: true,
    filters: [
      { k: "status", label: "Status", options: [{ v: "submitted", l: "Waiting" }, { v: "verified", l: "Verified" }, { v: "rejected", l: "Rejected" }] },
      { k: "docType", label: "Document", facet: true },
    ],
    dates: true,
    cols: [
      { label: "Business", cell: (r) => two(r.businessName, r.businessVerified ? "Business verified" : "") },
      { label: "Document", w: "170px", cell: (r) => two(r.docType, r.fileName) },
      { label: "Status", w: "200px", cell: (r) => two(
        r.isCurrent ? <Pill tone={r.status === "verified" ? "ok" : r.status === "rejected" ? "bad" : "warn"} text={r.status} /> : <Pill tone="mute" text="Superseded" />,
        [r.rejectReason, r.reviewedByName ? "by " + r.reviewedByName : ""].filter(Boolean).join(" · ")) },
      { label: "Uploaded", w: "120px", cell: (r) => when(r.uploadedAt) },
    ],
    fields: [],
  },
];

export const RES_OF: Record<string, ResSpec> = Object.fromEntries(RESOURCES.map((r) => [r.key, r]));
