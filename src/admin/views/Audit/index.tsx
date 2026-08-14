/* =============================================================================
   Admin Access · Audit log
   -----------------------------------------------------------------------------
   Ported 1:1 from prototype/admin-panel/admin-access/assets/views-settings.js
   (`V.audit`). Only that view came across: the same file also defines
   V.content, V.marketing, V.reviews and V.support, none of which has a row in
   the module inventory, so the router never reaches them.

   Same list shell every other module's list page uses now (Deals, Quotations,
   Invoices, Team): a .dls-cmd command row, one clickable StatStrip instead of a
   paragraph of prose, then a viewport-bounded table body. Audit keeps its own
   data — When/Type/Action/Actor/Module, nothing invented — this only changes
   the chrome around it.

   READ SURFACE. The log is append-only (`ib_admin_audit`): there is no edit, no
   delete and no "clear log" here, and there was none in the prototype either.
   ============================================================================= */
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterChips, Icon, Pill, SearchField, Select, StatStrip, Table, qs, richText } from "../../ui";
import type { StatCell } from "../../ui";
import { useNav } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { IBData, IBTeam } from "../../engines";

type AuditRow = {
  at: string;
  type: string;
  tone?: string;
  actor: string;
  role: string;
  module: string;
  text: string;
  ref?: string | null;
  route: string;
};

/* `richText` lives in ui/ because the shell's Activity popover reads the same
   log and must render the references the same way. Team-written events (see
   IBTeam.record) carry no markup at all and pass through untouched. */
export default function Audit() {
  const [sp, setSp] = useSearchParams();
  const { go } = useNav();
  const shell = useShell();

  /* Filters live in the URL, exactly as `?tone=bad&module=Finance` did in the
     hash: a filtered log is linkable and survives a refresh. */
  const p: Record<string, string> = {
    q: sp.get("q") || "",
    module: sp.get("module") || "",
    tone: sp.get("tone") || "",
  };

  /* Same 220ms the shell's delegated `input` handler used, so typing does not
     push a history entry per keystroke. The field is uncontrolled, so the
     caret stays put across the re-render without the prototype's pendingFocus
     dance. */
  const typing = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(typing.current), []);

  const setParam = (name: string, value: string) => {
    const next: Record<string, string> = { ...p, [name]: value };
    const out: Record<string, string> = {};
    for (const k in next) if (next[k]) out[k] = next[k];
    setSp(out);
  };
  const onFilter = (name: string, value: string) => {
    if (name !== "q") return setParam(name, value);
    window.clearTimeout(typing.current);
    typing.current = window.setTimeout(() => setParam("q", value), 220);
  };
  const onUnfilter = (k: string) => (k === "*" ? setSp({}) : setParam(k, ""));

  /* Reads through IBTeam so member, role and permission events appear
     beside the seeded ones. Same store shape, one reader. */
  const src: AuditRow[] = (IBTeam ? IBTeam.audit() : IBData.audit) as AuditRow[];
  let list = src.slice();
  if (p.module) list = list.filter((a) => a.module === p.module);
  /* The strip's axis: `tone` is already on every record, closed to a
     handful of values (unlike `module`, which already has its own select
     and would just be a worse copy of it here), and — unlike `type` — it
     has an actual severity a Sales/Admin user scans for first. */
  if (p.tone === "bad" || p.tone === "warn") list = list.filter((a) => a.tone === p.tone);
  else if (p.tone === "normal") list = list.filter((a) => a.tone !== "bad" && a.tone !== "warn");
  if (p.q) {
    const s = p.q.toLowerCase();
    list = list.filter(
      (a) => (a.text + " " + a.actor + " " + a.module + " " + (a.ref || "")).toLowerCase().indexOf(s) >= 0
    );
  }

  const mods: Record<string, number> = {};
  src.forEach((a) => {
    mods[a.module] = (mods[a.module] || 0) + 1;
  });
  const counts: { bad: number; warn: number } = { bad: 0, warn: 0 };
  src.forEach((a) => {
    if (a.tone === "bad" || a.tone === "warn") counts[a.tone as "bad" | "warn"]++;
  });

  const filtered = !!(p.q || p.module || p.tone);
  const hasChips = !!(p.q || p.module || p.tone);
  const toneRoute = (v: string) => "#/audit" + qs({ ...p, tone: p.tone === v ? "" : v });

  const cells: (StatCell | "sep")[] = [
    { k: "total", v: src.length, to: toneRoute(""), on: !p.tone },
    "sep",
    {
      k: "critical", v: counts.bad, dot: counts.bad ? "bad" : "", tone: counts.bad ? "bad" : "",
      to: toneRoute("bad"), on: p.tone === "bad", title: "Entries flagged critical",
    },
    {
      k: "warning", v: counts.warn, dot: counts.warn ? "warn" : "", tone: counts.warn ? "warn" : "",
      to: toneRoute("warn"), on: p.tone === "warn", title: "Entries flagged warning",
    },
    {
      k: "normal", v: src.length - counts.bad - counts.warn, dot: "ok",
      to: toneRoute("normal"), on: p.tone === "normal",
    },
  ];

  return (
    <div className="dls">
      <div className="dls-cmd">
        <SearchField ph="Search actor, action or reference…" val={p.q} onFilter={onFilter} />
        <Select
          name="module"
          label="Module"
          options={Object.keys(mods).map((m) => ({ v: m, l: m + " (" + mods[m] + ")" }))}
          value={p.module}
          onFilter={onFilter}
        />
        <span className="spacer"></span>
        <button
          className="btn"
          data-act="stub"
          data-what="Export audit log"
          data-where="the Team module"
          onClick={() => shell.stub("Export audit log", "the Team module")}
        >
          <Icon name="download" />Export
        </button>
      </div>

      <StatStrip cells={cells} />

      {hasChips ? (
        <div className="dls-chips">
          <FilterChips
            params={p}
            labels={{ q: "Search", module: "Module", tone: "Severity" }}
            onUnfilter={onUnfilter}
          />
        </div>
      ) : null}

      <div className="dls-body">
        <Table
          scroll
          min="900px"
          cols={[{ label: "When" }, { label: "Type" }, { label: "Action" }, { label: "Actor" }, { label: "Module" }]}
          empty={{
            icon: "history",
            title: filtered ? "No entries match" : "Nothing recorded yet",
            body: filtered ? "Nothing in the log matches. Clear a filter to widen the search." : "",
            action: filtered ? (
              <button className="btn" data-unfilter="*" onClick={() => onUnfilter("*")}>
                Clear all filters
              </button>
            ) : (
              ""
            ),
          }}
          rows={list.map((a, i) => (
            <tr key={i} className="clickable" data-go={a.route} onClick={() => go(a.route)}>
              <td className="mono nowrap" style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>
                {a.at}
              </td>
              <td>
                <span className={"tag " + (a.tone || "")}>{a.type}</span>
              </td>
              <td>{richText(a.text)}</td>
              <td>
                {a.actor}
                <div className="cell-2">{a.role}</div>
              </td>
              <td>
                <Pill text={a.module} tone="line" />
              </td>
            </tr>
          ))}
        />
      </div>
    </div>
  );
}
