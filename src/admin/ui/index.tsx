/* =============================================================================
   Interior bazzar — Admin · the composition layer
   -----------------------------------------------------------------------------
   Every shared part a screen renders, in one import: `from "../../ui"`.
   Underneath is Untitled UI React (React Aria + Tailwind); what this layer
   adds is the panel's own vocabulary — the prop shapes a hundred and fifty
   views already write — and the handful of parts an operations product needs
   that a component library does not ship (the stat strip, the filter bar,
   the exception rail, the status maps).

   THE RULES EVERY PART KEEPS
     · It reads TOKENS through utilities, never a value. Not one colour, radius,
       shadow or font size literal appears in this directory.
     · It is correct in both themes because it never names a theme.
     · It is reachable and operable from the keyboard, and says what it is to a
       screen reader.
     · It has ONE drawing. A variant is a prop on that drawing, never a second
       component with a similar name.
   A module may not add a shared part; it composes these.
   ========================================================================== */
export { BRAND_MARK, BrandLogo } from "./brand";
export { Icon, ICONS, iconOf } from "./icon";
export type { IconName, IconComponent } from "./icon";
export { avatarTone, initials, qs, cap, titleise, shareOrCopy, copyToClipboard, publicDocUrl, printHtml, AVATAR_TONES } from "./helpers";
export type { AvatarTone } from "./helpers";

export { Button, IconButton, Segmented } from "./buttons";
export type { ButtonProps } from "./buttons";

export { FormField, FormSection, FieldRow, Input, Textarea, SelectInput, InputGroup, Checkbox, Radio, Toggle, DateInput, DateRange, MultiSelect, FileUpload, ChipInput, SearchField, Field } from "./fields";
export type { InputProps, FieldProps } from "./fields";

export { Select, SortSelect } from "./select";
export type { SelectOption, SelectOptionLike } from "./select";

export { MoreMenu, MenuRow, MenuSection, MenuDivider, useMenuPlacement, POP_CLASS } from "./menu";
export type { MenuItem } from "./menu";

export { Pill, Tag, Tags, tagClasses, LeadStatus, DealStatus, Priority, Assignee, Pipeline, Meter, Delta, TONE, TAG_TONE } from "./status";

export { Table, ListTable, SortHead, Rail, StatStrip, FilterBar, Toolbar, FilterChips, Pagination, Tabs, LinkChip, EmptyState, PaneLoading, Skeleton, ListSkeleton, Legend, ChartFrame } from "./data";
export type { TableProps, StatCell, EmptyStateProps } from "./data";

export { PageHeader, SectionHead, Card, Eyebrow, Tile, Tiles, Breadcrumbs, TbTitle, KvList } from "./page";
export type { TileProps } from "./page";

export { ModalHead, ModalShell, ConfirmModal, DrawerHead, DrawerShell, Popover, ReasonModal, Tooltip, InfoDot, Alert, Notice, ShareLine } from "./overlays";

export { Avatar, Person } from "./people";
export { Timeline, ActivityFeed } from "./feed";

export { inr, inrWords, fmtDate } from "./format";

/* The seeded audit log stores references inside its `text` as `<b>PAY-4503</b>`.
   Both readers of that log go through this, so neither shows the raw tags. */
import type { ReactNode } from "react";
export function richText(s: string): ReactNode[] {
    return String(s)
        .split(/(<b>[\s\S]*?<\/b>)/g)
        .map((part, i) => (part.slice(0, 3) === "<b>" ? <b key={i}>{part.slice(3, -4)}</b> : part));
}
