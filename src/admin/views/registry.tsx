/* =============================================================================
   Interior bazzar — Admin · view registry
   -----------------------------------------------------------------------------
   The prototype's `Views[route]` lookup, as a React map. The shell renders
   whatever is registered here for the current route; a registered MODULES entry
   with no view here is "coming soon", an unregistered route is a 404, and a
   route the signed-in member cannot see is refused.

   Adding a surface is one line here plus one row in shell/modules.ts. There is
   no third place.
   ============================================================================= */
import type { ComponentType } from "react";
import { EmptyState, Notice } from "../ui";
import { getItems } from "../shell/modules";
import type { ModuleItem } from "../shell/modules";
import { can, useNav } from "../shell/AdminShell";
import { useLocation } from "react-router-dom";

import Audit from "./Audit";
import Plans from "./Plans";
import Team from "./Team";
import Roles from "./Roles";
import Deals from "./Deals";
import Quotations from "./Quotations";
import Invoices from "./Invoices";

/** route key → the component that owns that workspace. */
export const VIEWS: Record<string, ComponentType> = {
  audit: Audit,
  plans: Plans,
  team: Team,
  roles: Roles,
  deals: Deals,
  quotations: Quotations,
  invoices: Invoices,
};

export function ViewHost() {
  const location = useLocation();
  const route = (location.pathname.split("/").filter(Boolean)[0] || "deals").toLowerCase();
  const item = getItems()[route];

  if (!item) return <NotFound route={route} />;
  if (!can(item.key)) return <Denied item={item} />;

  const View = VIEWS[route];
  if (!View) return <ComingSoon item={item} />;
  /* KEYED ON THE ROUTE ONLY, never on the record id.
     It used to be `route + "/" + id`, which made React unmount and remount the
     whole module every time you opened a different record — so picking another
     deal in the chat list threw away the list fetch, the vocabularies and the
     open detail, and the module came back from zero behind a full-page loader.
     A record change is a change of what a module is SHOWING, not a change of
     module; every view here already reads `useParams().id` and reacts to it. */
  return <View key={route} />;
}

function NotFound({ route }: { route: string }) {
  const { go } = useNav();
  return (
    <div className="page">
      <EmptyState
        icon="search"
        title="Nothing at this address"
        body={
          <>
            There is no module at <span className="mono">#/{route}</span>. It may have been renamed,
            or the link is stale.
          </>
        }
        action={
          <button className="btn pri" data-go="#/deals" onClick={() => go("#/deals")}>
            Back to Deals
          </button>
        }
      />
    </div>
  );
}

/* A module the signed-in member HOLDS, that this panel has no surface for.
   Two things land here now: modules that were never built, and Quotations /
   Invoices — which were built, but read and wrote a browser-side store with
   no server behind it. Rendering seeded records that only existed in this
   tab was worse than rendering nothing, so the screens went and the route
   stayed. */
function ComingSoon({ item }: { item: ModuleItem }) {
  return (
    <div className="page">
      <div className="ph">
        <div className="ph-t">
          <h1>{item.label}</h1>
          <div className="scope">Nothing to show here yet.</div>
        </div>
      </div>
      <Notice tone="warn">
        <b>{item.label} is in your access, but this panel has no surface for it yet.</b> Every screen
        here reads live records from the server, and there is no {item.label.toLowerCase()} API to
        read. The nav slot stays so the route never dies — the screen comes back when the data behind
        it is real.
      </Notice>
    </div>
  );
}

function Denied({ item }: { item: ModuleItem }) {
  return (
    <div className="page">
      <EmptyState
        icon="shield"
        title="You do not have access to this module"
        body={
          <>
            {item.label} is not in your effective access for this session. Access is granted by
            role, not requested per page — ask an Admin to review your role in Settings → Team.
          </>
        }
      />
    </div>
  );
}
