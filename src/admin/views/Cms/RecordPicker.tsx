/* Search-as-you-type picker for a business / shop / architect id (or several). */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "../../ui";
import appUrl from "../../../api/endpoints";
import apiService from "../../../api/apiService";
import { call } from "../../../api/modules/adminOps";

type Kind = "business" | "shop" | "architect";
type Hit = { id: number; name: string; city?: string };

export async function lookup(kind: Kind, q: string, ids?: number[]): Promise<Hit[]> {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (ids?.length) p.set("ids", ids.join(","));
  const s = p.toString();
  const d = await call(apiService.getGetApiResponse<{ rows: Hit[] }>(`${appUrl.admin}/cms/lookup/${kind}/${s ? "?" + s : ""}`));
  return d?.rows ?? [];
}

export function RecordPicker({ kind, value, onChange, multiple, max, placeholder }: {
  kind: Kind; value: number | number[] | null; onChange: (v: number | number[] | null) => void;
  multiple?: boolean; max?: number; placeholder?: string;
}) {
  const id = useId();
  const ids = value == null ? [] : Array.isArray(value) ? value : [value];
  const [names, setNames] = useState<Record<number, string>>({});
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(0);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);
  const full = multiple && max != null && ids.length >= max;

  // names for ids we have not seen (initial value, or set from outside)
  const missing = ids.filter((i) => !(i in names));
  const missingKey = missing.join(",");
  useEffect(() => {
    if (!missing.length) return;
    lookup(kind, "", missing)
      .then((rows) => setNames((n) => ({ ...n, ...Object.fromEntries(rows.map((r) => [r.id, r.name])) })))
      .catch(() => setNames((n) => ({ ...n, ...Object.fromEntries(missing.map((i) => [i, `#${i}`])) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the id list
  }, [kind, missingKey]);

  useEffect(() => {
    if (!open || full) return;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      lookup(kind, q.trim())
        .then((rows) => { if (mine === seq.current) { setHits(rows); setFailed(false); setCur(0); } })
        .catch(() => { if (mine === seq.current) { setHits([]); setFailed(true); } });
    }, 250);
    return () => clearTimeout(t);
  }, [kind, q, open, full]);

  const pick = (h: Hit) => {
    setNames((n) => ({ ...n, [h.id]: h.name }));
    onChange(multiple ? [...ids.filter((i) => i !== h.id), h.id] : h.id);
    setQ("");
    setOpen(false);
  };
  const drop = (i: number) => onChange(multiple ? ids.filter((x) => x !== i) : null);
  const list = hits.filter((h) => !ids.includes(h.id));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setCur((c) => Math.min(c + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCur((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter" && open && list[cur]) { e.preventDefault(); pick(list[cur]); }
    else if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); }
  };

  const chip = "inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-sm text-primary";
  const x = "text-tertiary hover:text-primary";
  const single = !multiple && ids.length === 1;

  return (
    <div className="relative flex flex-col gap-2" onKeyDown={onKey} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((i) => (
            <span key={i} className={chip}>
              {names[i] ?? `#${i}`}
              <button type="button" className={x} aria-label={`Remove ${names[i] ?? i}`} onClick={() => drop(i)}>×</button>
            </span>
          ))}
        </div>
      )}
      {!single && (
        <>
          <Input id={id} value={q} ph={full ? `max ${max}` : placeholder ?? `Search ${kind}…`} disabled={full} autoComplete="off"
            onChange={(v) => { setQ(v); setOpen(true); }} />
          {multiple && max != null && <span className="text-xs text-tertiary">{ids.length}/{max}{full ? " · max " + max : ""}</span>}
        </>
      )}
      {open && !full && !single && (
        <ul role="listbox" className="absolute top-full z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-secondary bg-primary py-1 shadow-lg">
          {failed ? <li className="px-3 py-2 text-sm text-error-primary">Could not search</li>
            : list.length === 0 ? <li className="px-3 py-2 text-sm text-tertiary">No matches</li>
            : list.map((h, n) => (
              <li key={h.id} role="option" aria-selected={n === cur}
                className={`cursor-pointer px-3 py-2 text-sm ${n === cur ? "bg-secondary" : ""}`}
                onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>
                <div className="font-medium text-primary">{h.name}</div>
                {h.city ? <div className="text-xs text-tertiary">{h.city}</div> : null}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
