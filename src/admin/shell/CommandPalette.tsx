/* =============================================================================
   Interior bazzar — Admin · global search  (⌘K)
   -----------------------------------------------------------------------------
   Two sources: the DEALS the server can find, and the nav targets. Empty query
   shows recents, then Jump-to.

   What it used to search was `IBData.searchIndex()` — a browser-side index of
   demo deals, quotations, invoices, payments and client deals. Typing a real
   deal reference found nothing and typing a demo one opened a record that does
   not exist, which is the worst pair of behaviours a search box can have.

   Only deals are searched because deals are what the panel can search: the
   endpoint takes a `search` param over name, business, email, phone and ref.
   Quotations and invoices join this list when their own search does.
   ============================================================================= */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../ui";
import AdminOpsService, { call } from "../../api/modules/adminOps";
import { can } from "../auth/session";
import { getGroupOf, getItems, getModules } from "./modules";
import { LS } from "./ShellContext";

type Hit = {
  icon?: string;
  route?: string;
  title: string;
  sub?: string;
  hay?: string;
  group?: string;
};
type Group = { name: string; items: Hit[] };

function navTargets(): Hit[] {
  const out: Hit[] = [];
  getModules().forEach((g) => {
    g.items.forEach((it) => {
      out.push({
        icon: it.icon,
        group: "Navigate",
        route: "#/" + it.route,
        title: it.label,
        sub: (g.group ? g.group + " · " : "") + "#/" + it.route,
        hay: (it.label + " " + it.route + " " + (g.group || "")).toLowerCase(),
      });
    });
  });
  return out;
}

/* The last few records opened, from localStorage. The subtitle is the module
   name and nothing else: it used to carry a stage or an amount looked up in the
   local stores, which for a real reference was simply blank and for a demo one
   was a figure from nowhere. */
function recents(): Hit[] {
  const list = LS.get<{ route: string; id: string }[]>("ib_admin_recents", []).slice(0, 4);
  return list
    .map((r) => {
      const item = getItems()[r.route];
      if (!item) return null;
      return {
        icon: item.icon,
        route: "#/" + r.route + "/" + r.id,
        title: r.id,
        sub: item.label,
        group: getGroupOf()[r.route] || undefined,
      } as Hit;
    })
    .filter(Boolean) as Hit[];
}

/** Deals matching `q`, from the server. Debounced by the caller; capped at
 *  eight, because a palette is a jump list and not a list view. */
function useDealHits(q: string): { hits: Hit[]; searching: boolean } {
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const term = q.trim();

  useEffect(() => {
    if (term.length < 2 || !can("deals")) { setHits([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(() => {
      call(AdminOpsService.deals({ search: term, pageSize: 8 }))
        .then((d) => {
          if (cancelled) return;
          setHits(d.deals.map((row) => ({
            icon: "deal",
            group: "Deals",
            route: "#/deals/" + row.ref,
            title: row.contactName + (row.businessName ? " · " + row.businessName : ""),
            sub: row.ref + " · " + row.stageLabel + (row.city ? " · " + row.city : ""),
          })));
          setSearching(false);
        })
        .catch(() => { if (!cancelled) { setHits([]); setSearching(false); } });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [term]);

  return { hits, searching };
}

function staticGroups(q: string): Group[] {
  const term = q.trim().toLowerCase();
  const groups: Group[] = [];
  if (!term) {
    const rec = recents();
    if (rec.length) groups.push({ name: "Recent", items: rec });
    groups.push({ name: "Jump to", items: navTargets().slice(0, 6) });
    return groups;
  }
  const nav = navTargets().filter((x) => (x.hay || "").indexOf(term) >= 0).slice(0, 4);
  if (nav.length) groups.push({ name: "Navigate", items: nav });
  return groups;
}

export function CommandPalette({ onClose, go }: { onClose: () => void; go: (h: string) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { hits, searching } = useDealHits(q);

  const groups = useMemo(() => {
    const out = hits.length ? [{ name: "Deals", items: hits }] : [];
    return out.concat(staticGroups(q));
  }, [q, hits]);
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
            placeholder="Search deals by name, business, phone or ref…"
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
                {searching ? "Searching…" : "No match."}
              </div>
              <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>
                Deals are searched by name, business, email, phone or reference —{" "}
                <span className="mono">DL-2501</span>.
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
            Deals are searched on the server — you see what you have access to
          </span>
        </div>
      </div>
    </>,
    document.body
  );
}
