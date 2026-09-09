/* =============================================================================
   Interior bazzar — Admin · global search  (⌘K)
   -----------------------------------------------------------------------------
   Two sources: the DEALS the server can find, and the nav targets. Empty query
   shows recents, then Jump-to. Only deals are searched because deals are what
   the panel can search; quotations and invoices join this list when their own
   search does.
   ========================================================================== */
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog as AriaDialog, Modal as AriaModal, ModalOverlay as AriaModalOverlay } from "react-aria-components";
import { cx } from "@/utils/cx";
import { Icon } from "../ui";
import AdminOpsService, { call } from "../../api/modules/adminOps";
import { can } from "../auth/session";
import { getGroupOf, getItems, getModules } from "./modules";
import { LS } from "./ShellContext";

type Hit = { icon?: string; route?: string; title: string; sub?: string; hay?: string; group?: string };
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
        sub: (g.group ? g.group + " · " : "") + "/" + it.route,
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
      return { icon: item.icon, route: "#/" + r.route + "/" + r.id, title: r.id, sub: item.label, group: getGroupOf()[r.route] || undefined } as Hit;
    })
    .filter(Boolean) as Hit[];
}

function useDealHits(q: string): { hits: Hit[]; searching: boolean } {
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const term = q.trim();
  useEffect(() => {
    if (term.length < 2 || !can("deals")) {
      setHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(() => {
      call(AdminOpsService.deals({ search: term, pageSize: 8 }))
        .then((d) => {
          if (cancelled) return;
          setHits(
            d.deals.map((row) => ({
              icon: "deal",
              group: "Deals",
              route: "#/deals/" + row.ref,
              title: row.contactName + (row.businessName ? " · " + row.businessName : ""),
              sub: row.ref + " · " + row.stageLabel + (row.city ? " · " + row.city : ""),
            })),
          );
          setSearching(false);
        })
        .catch(() => {
          if (!cancelled) {
            setHits([]);
            setSearching(false);
          }
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
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
  const nav = navTargets()
    .filter((x) => (x.hay || "").indexOf(term) >= 0)
    .slice(0, 4);
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
    const on = bodyRef.current?.querySelector('[aria-selected="true"]');
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
  return (
    <AriaModalOverlay
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
      className={({ isEntering, isExiting }) =>
        cx(
          "fixed inset-0 z-[55] flex items-start justify-center bg-overlay/50 px-3 pt-[12vh] backdrop-blur-[3px]",
          isEntering && "duration-150 ease-out animate-in fade-in",
          isExiting && "duration-100 ease-in animate-out fade-out",
        )
      }
    >
      <AriaModal
        className={({ isEntering, isExiting }) =>
          cx("w-full max-w-xl outline-hidden", isEntering && "duration-150 ease-out animate-in fade-in zoom-in-[0.98]", isExiting && "duration-100 ease-in animate-out fade-out zoom-out-[0.98]")
        }
      >
        <AriaDialog aria-label="Search" className="flex max-h-[70vh] flex-col overflow-hidden rounded-2xl bg-primary shadow-xl ring-1 ring-secondary_alt outline-hidden sheen">
          <div className="flex items-center gap-3 border-b border-secondary px-4">
            <Icon name="search" size="md" className="shrink-0 text-fg-quaternary" />
            <input
              ref={input}
              id="cmdkInput"
              role="combobox"
              aria-expanded
              aria-controls="cmdkList"
              aria-autocomplete="list"
              placeholder="Search deals by name, business, phone or ref…"
              autoComplete="off"
              spellCheck={false}
              value={q}
              className="h-14 min-w-0 flex-1 bg-transparent text-md text-primary outline-hidden placeholder:text-placeholder"
              onChange={(e) => {
                setSel(0);
                setQ(e.target.value);
              }}
              onKeyDown={onKey}
            />
            <kbd className="rounded px-1.5 py-0.5 font-mono text-2xs font-medium text-quaternary ring-1 ring-secondary ring-inset">esc</kbd>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-2" ref={bodyRef} id="cmdkList" role="listbox">
            {!groups.length ? (
              <div className="px-5 py-8 text-center">
                <div className="text-sm text-secondary">{searching ? "Searching…" : "No match."}</div>
                <div className="mt-1.5 text-xs text-tertiary">
                  Deals are searched by name, business, email, phone or reference — <span className="font-mono">DL-2501</span>.
                </div>
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.name}>
                  <div className="label-mono px-4 pt-2 pb-1">{g.name}</div>
                  {g.items.map((it) => {
                    n++;
                    const i = n;
                    const on = i === sel;
                    return (
                      <button
                        key={g.name + i}
                        type="button"
                        role="option"
                        aria-selected={on}
                        className={cx("mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-hidden", on && "bg-primary_hover")}
                        data-i={i}
                        data-go={it.route}
                        onMouseEnter={() => setSel(i)}
                        onClick={() => choose(it)}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-fg-quaternary ring-1 ring-secondary ring-inset">
                          <Icon name={it.icon || "doc"} size="sm" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <b className="truncate text-sm font-medium text-primary">{it.title}</b>
                          <span className="truncate text-xs text-tertiary">{it.sub || ""}</span>
                        </span>
                        {on && <kbd className="rounded px-1.5 py-0.5 font-mono text-2xs text-quaternary ring-1 ring-secondary ring-inset">↵</kbd>}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-secondary px-4 py-2 text-xs text-tertiary">
            <span>
              <b className="font-semibold text-secondary">↵</b> open
            </span>
            <span>
              <b className="font-semibold text-secondary">↑ ↓</b> navigate
            </span>
            <span className="flex-1" />
            <span className="hidden sm:inline">Deals are searched on the server — you see what you have access to</span>
          </div>
        </AriaDialog>
      </AriaModal>
    </AriaModalOverlay>
  );
}
