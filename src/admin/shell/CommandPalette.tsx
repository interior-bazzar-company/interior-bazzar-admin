/* =============================================================================
   Interior bazzar — Admin · global search  (⌘K)
   -----------------------------------------------------------------------------
   Ported from admin-shell.js §SEARCH. Three sources in one list: the data index
   (deals, quotations, invoices, payments, client deals, users), the nav targets,
   and the small set of global actions. Empty query shows recents, then Jump-to.
   ============================================================================= */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, Pill } from "../ui";
import { IBData } from "../engines";
import { getGroupOf, getItems, getModules } from "./modules";
import { LS, useShell } from "./ShellContext";

type Hit = {
  icon?: string;
  route?: string;
  title: string;
  sub?: string;
  chain?: string | null;
  action?: number;
  hay?: string;
  group?: string;
};
type Group = { name: string; items: Hit[] };

const ACTIONS = [
  { title: "Create a deal", sub: "Sales → Deals", icon: "plus", act: "Create deal", where: "the Deals module", hay: "create deal new" },
  { title: "Create a quotation", sub: "Sales → Quotations", icon: "plus", act: "Create quotation", where: "the Quotation module", hay: "create quotation quote new" },
  { title: "Raise an invoice", sub: "Sales → Invoices", icon: "plus", act: "Raise invoice", where: "the Invoice module", hay: "raise invoice new bill" },
  { title: "Export CSV", sub: "Current list", icon: "download", act: "Export CSV", where: "the current module", hay: "export csv download" },
];

function navTargets(): Hit[] {
  const out: Hit[] = [];
  getModules().forEach((g) => {
    g.items.forEach((it) => {
      out.push({
        icon: it.icon,
        group: "Navigate",
        chain: null,
        route: "#/" + it.route,
        title: it.label,
        sub: (g.group ? g.group + " · " : "") + "#/" + it.route,
        hay: (it.label + " " + it.route + " " + (g.group || "")).toLowerCase(),
      });
    });
  });
  return out;
}

function recents(): Hit[] {
  const list = LS.get<{ route: string; id: string }[]>("ib_admin_recents", []).slice(0, 4);
  return list
    .map((r) => {
      const item = getItems()[r.route];
      if (!item) return null;
      let sub = "";
      if (r.route === "deals") {
        const dl = IBData.dealOf(r.id);
        sub = dl ? dl.who + " · " + IBData.STAGES[dl.stage].label : "";
      } else if (r.route === "invoices") {
        const iv = IBData.invoiceOf(r.id);
        sub = iv ? IBData.inr(iv.amount) + " · " + iv.pay : "";
      } else if (r.route === "quotations") {
        const q = IBData.quoteOf(r.id);
        sub = q ? IBData.inr(q.value) + " · " + q.status : "";
      }
      return {
        icon: item.icon,
        route: "#/" + r.route + "/" + r.id,
        title: r.id,
        sub: item.label + (sub ? " · " + sub : ""),
        chain: null,
        group: getGroupOf()[r.route] || undefined,
      } as Hit;
    })
    .filter(Boolean) as Hit[];
}

let INDEX: Hit[] | null = null;
const index = () => (INDEX ? INDEX : (INDEX = IBData.searchIndex() as Hit[]));

function searchAll(q: string): Group[] {
  q = q.trim().toLowerCase();
  const groups: Group[] = [];
  if (!q) {
    const rec = recents();
    if (rec.length) groups.push({ name: "Recent", items: rec });
    groups.push({ name: "Jump to", items: navTargets().slice(0, 6) });
    return groups;
  }
  const hits = index().filter((x) => (x.hay || "").indexOf(q) >= 0);
  const byGroup: Record<string, Hit[]> = {};
  hits.slice(0, 40).forEach((h) => {
    const g = h.group || "";
    (byGroup[g] = byGroup[g] || []).push(h);
  });
  ["Sales", "Marketplace"].forEach((g) => {
    if (byGroup[g]) groups.push({ name: g, items: byGroup[g].slice(0, 6) });
  });
  const nav = navTargets().filter((x) => (x.hay || "").indexOf(q) >= 0).slice(0, 4);
  if (nav.length) groups.push({ name: "Navigate", items: nav });
  const acts = ACTIONS.filter((a) => a.hay.indexOf(q) >= 0).slice(0, 3);
  if (acts.length)
    groups.push({
      name: "Actions",
      items: acts.map((a) => ({
        icon: a.icon,
        title: a.title,
        sub: a.sub,
        action: ACTIONS.indexOf(a),
        chain: null,
      })),
    });
  return groups;
}

export function CommandPalette({ onClose, go }: { onClose: () => void; go: (h: string) => void }) {
  const shell = useShell();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => searchAll(q), [q]);
  const flat = useMemo(() => groups.reduce<Hit[]>((a, g) => a.concat(g.items), []), [groups]);

  useEffect(() => {
    const t = window.setTimeout(() => input.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (sel >= flat.length) setSel(Math.max(0, flat.length - 1));
  }, [flat.length, sel]);
  useEffect(() => {
    const on = bodyRef.current?.querySelector(".cmdk-i.on");
    if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
  }, [sel, q]);

  const choose = (it: Hit) => {
    onClose();
    if (it.route) go(it.route);
    else if (it.action !== undefined) {
      const a = ACTIONS[it.action];
      shell.stub(a.act, a.where);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = flat[sel];
      if (it) choose(it);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  let n = -1;
  return createPortal(
    <>
      <div className="scrim" data-close="1" onClick={onClose} />
      <div className="cmdk" role="dialog" aria-modal="true">
        <div className="cmdk-q">
          <Icon name="search" size="lg" />
          <input
            ref={input}
            id="cmdkInput"
            placeholder="Search deals, invoices, users, references…"
            autoComplete="off"
            spellCheck={false}
            value={q}
            onChange={(e) => {
              setSel(0);
              setQ(e.target.value);
            }}
            onKeyDown={onKey}
          />
          <span className="kbd">esc</span>
          <button className="btn icon" data-close="1" aria-label="Close search" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>

        <div className="cmdk-b" ref={bodyRef}>
          {!groups.length ? (
            <div style={{ padding: "34px 20px", textAlign: "center" }}>
              <div className="faint" style={{ fontSize: 13.5 }}>
                No match.
              </div>
              <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>
                Try a reference — <span className="mono">DL-</span>,{" "}
                <span className="mono">IB-QT-</span>, <span className="mono">IB-INV-</span>,{" "}
                <span className="mono">PAY-</span>, <span className="mono">IB-CD-</span>.
              </div>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.name}>
                <div className="cmdk-g">{g.name}</div>
                {g.items.map((it) => {
                  n++;
                  const i = n;
                  return (
                    <button
                      key={g.name + i}
                      className={"cmdk-i" + (i === sel ? " on" : "")}
                      data-i={i}
                      data-go={it.route}
                      onMouseEnter={() => setSel(i)}
                      onClick={() => choose(it)}
                    >
                      <Icon name={it.icon || "doc"} />
                      <span className="t">
                        <b>{it.title}</b>
                        <span>{it.sub || ""}</span>
                      </span>
                      <span className="r">
                        {it.chain && (
                          <Pill tone={it.chain === "Marketplace" ? "info" : "brand"}>{it.chain}</Pill>
                        )}
                        {i === sel && <span className="kbd">↵</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="cmdk-f">
          <span>
            <b>↵</b> open
          </span>
          <span>
            <b>↑ ↓</b> navigate
          </span>
          <span className="spacer" />
          <span>
            Out-of-scope references return <b>403</b> — never an empty result
          </span>
        </div>
      </div>
    </>,
    document.body
  );
}
