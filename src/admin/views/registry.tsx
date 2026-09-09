/* =============================================================================
   Interior bazzar — Admin · view registry
   -----------------------------------------------------------------------------
   The prototype's `Views[route]` lookup, as a React map. The shell renders
   whatever is registered here for the current route; a registered MODULES entry
   with no view here is "coming soon", an unregistered route is a 404, and a
   route the signed-in member cannot see is refused.

   EVERY VIEW IS LAZY. The registry is the single place that knows every route,
   so it is the single place code-splitting happens: a module's code arrives
   when its route is first opened, and the entry chunk carries the shell, the
   library and nothing else. A module that fails to load renders the panel's
   error state, not a blank page.

   Adding a surface is one line here plus one row in shell/modules.ts. There is
   no third place.
   ========================================================================== */
import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { useLocation } from "react-router-dom";
import { Button, EmptyState, Notice, PageHeader, PaneLoading } from "../ui";
import { getItems, HOME_ROUTE } from "../shell/modules";
import type { ModuleItem } from "../shell/modules";
import { can, useNav } from "../shell/AdminShell";

const Overview = lazy(() => import("./Overview"));
const Audit = lazy(() => import("./Audit"));
const Plans = lazy(() => import("./Plans"));
const Team = lazy(() => import("./Team"));
const Roles = lazy(() => import("./Roles"));
const Deals = lazy(() => import("./Deals"));
const Quotations = lazy(() => import("./Quotations"));
const Invoices = lazy(() => import("./Invoices"));
const BusinessEnquiries = lazy(() => import("./BusinessEnquiries"));
const Users = lazy(() => import("./Users"));
const Finance = lazy(() => import("./Finance"));
const Resources = lazy(() => import("./Resources"));
const Agreements = lazy(() => import("./Agreements"));
const Attendance = lazy(() => import("./Team/Attendance"));
const Work = lazy(() => import("./Team/Work"));
const TeamReports = lazy(() => import("./Team/Reports"));

/** route key → the component that owns that workspace. */
export const VIEWS: Record<string, ComponentType> = {
  /* The landing page. Frontend-only by nature — it reads the other modules'
     stores and API hooks and owns no records. */
  overview: Overview,
  audit: Audit,
  plans: Plans,
  team: Team,
  roles: Roles,
  deals: Deals,
  quotations: Quotations,
  invoices: Invoices,
  "business-enquiries": BusinessEnquiries,
  users: Users,
  finance: Finance,
  /* The same component five times over, on purpose: Finance is ONE module
     reading ONE store, and the five keys exist so the sidebar can name what
     is inside it and the server can grant the sections separately. */
  "finance-salaries": Finance,
  "finance-transactions": Finance,
  "finance-refunds": Finance,
  "finance-analytics": Finance,
  attendance: Attendance,
  work: Work,
  reports: TeamReports,
  resources: Resources,
  agreements: Agreements,
};

export function ViewHost() {
  const location = useLocation();
  const route = (location.pathname.split("/").filter(Boolean)[0] || HOME_ROUTE).toLowerCase();
  const item = getItems()[route];

  if (!item) return <NotFound route={route} />;
  if (!can(item.key)) return <Denied item={item} />;

  const View = VIEWS[route];
  if (!View) return <ComingSoon item={item} />;
  /* KEYED ON THE ROUTE ONLY, never on the record id: a record change is a
     change of what a module is SHOWING, not a change of module. */
  return (
    <Suspense fallback={<PaneLoading />}>
      <View key={route} />
    </Suspense>
  );
}

function NotFound({ route }: { route: string }) {
  const { go } = useNav();
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        icon="search"
        title="Nothing at this address"
        body={
          <>
            There is no module at <span className="font-mono">/{route}</span>. It may have been renamed, or the link is stale.
          </>
        }
        action={
          <Button color="primary" data-go={"#/" + HOME_ROUTE} onClick={() => go("#/" + HOME_ROUTE)}>
            Back to Overview
          </Button>
        }
      />
    </div>
  );
}

/* A module the signed-in member HOLDS, that this panel has no surface for. */
function ComingSoon({ item }: { item: ModuleItem }) {
  return (
    <div>
      <PageHeader title={item.label} meta="Nothing to show here yet." />
      <Notice tone="warn">
        <b>{item.label} is in your access, but this panel has no surface for it yet.</b> Every screen here reads live records from the server, and there is no{" "}
        {item.label.toLowerCase()} API to read. The nav slot stays so the route never dies — the screen comes back when the data behind it is real.
      </Notice>
    </div>
  );
}

function Denied({ item }: { item: ModuleItem }) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState
        icon="shield"
        title="You do not have access to this module"
        body={
          <>
            {item.label} is not in your effective access for this session. Access is granted by role, not requested per page — ask an Admin to review your role in
            Settings → Team.
          </>
        }
      />
    </div>
  );
}
