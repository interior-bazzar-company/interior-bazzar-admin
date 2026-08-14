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
import { ITEMS } from "../shell/modules";
import type { ModuleItem } from "../shell/modules";
import { can, useNav } from "../shell/AdminShell";
import { useParams, useLocation } from "react-router-dom";

import Audit from "./Audit";
import Design from "./Design";
import Plans from "./Plans";
import Team from "./Team";
import Roles from "./Roles";

/** route key → the component that owns that workspace. */
export const VIEWS: Record<string, ComponentType> = {
  audit: Audit,
  design: Design,
  plans: Plans,
  team: Team,
  roles: Roles,
};

export function ViewHost() {
  const params = useParams();
  const location = useLocation();
  const route = (location.pathname.split("/").filter(Boolean)[0] || "deals").toLowerCase();
  const item = ITEMS[route];

  if (!item) return <NotFound route={route} />;
  if (!can(item.key)) return <Denied item={item} />;

  const View = VIEWS[route];
  if (!View) return <ComingSoon item={item} />;
  return <View key={route + "/" + (params.id || "")} />;
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

function ComingSoon({ item }: { item: ModuleItem }) {
  return (
    <div className="page">
      <div className="ph">
        <div className="ph-t">
          <h1>{item.label}</h1>
          <div className="scope">
            This surface has no module in <span className="mono">modules/</span> yet.
          </div>
        </div>
      </div>
      <Notice tone="warn">
        <b>Inherited from the previous panel, not yet rebuilt.</b> {item.label} existed only inside{" "}
        <span className="mono">dashboard-admin.html</span>, which was deleted in commit{" "}
        <span className="mono">02d5ff3</span>. The nav slot is reserved so the route never dies; the
        surface is scheduled at step 9 of the integration sequence.
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
