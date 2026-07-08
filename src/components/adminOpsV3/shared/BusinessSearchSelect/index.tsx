// ── BusinessSearchSelect ── reusable async typeahead multiselect over real
// Businesses. Reuses the existing admin search endpoint (AdminOpsService
// .businesses({search}) → /api/v1/admin/businesses/?search=). Capped at `max`
// selections (default 2, for the hero "floating cards"). Reusable across admin
// (banner editor now; assign-business flows later).
import { useEffect, useRef, useState } from "react";
import AdminOpsService, { type BannerBusinessRef } from "../../../../api/modules/adminOps";
import styles from "./BusinessSearchSelect.module.css";

interface Props {
  value: BannerBusinessRef[];
  onChange: (next: BannerBusinessRef[]) => void;
  max?: number;
}

const BusinessSearchSelect = ({ value, onChange, max = 2 }: Props) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BannerBusinessRef[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      const res = await AdminOpsService.businesses({ search: query.trim(), pageSize: 8 }).catch(() => null);
      setLoading(false);
      const rows = res?.data?.businesses ?? [];
      setResults(rows.map((b: any) => ({ id: b.id, name: b.businessName })));
      setOpen(true);
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const atMax = value.length >= max;
  const add = (b: BannerBusinessRef) => {
    if (atMax || value.some((x) => x.id === b.id)) return;
    onChange([...value, b]);
    setQuery(""); setResults([]); setOpen(false);
  };
  const remove = (id: number) => onChange(value.filter((x) => x.id !== id));

  return (
    <div className={styles.wrap}>
      <div className={styles.chips}>
        {value.map((b) => (
          <span key={b.id} className={styles.chip}>
            {b.name}
            <button type="button" aria-label={`Remove ${b.name}`} onClick={() => remove(b.id)}>×</button>
          </span>
        ))}
      </div>
      {!atMax && (
        <div className={styles.field}>
          <input
            value={query}
            placeholder="Search businesses by name…"
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
          />
          {open && (results.length > 0 || loading) && (
            <ul className={styles.menu}>
              {loading && <li className={styles.hint}>Searching…</li>}
              {!loading && results.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => add(b)} disabled={value.some((x) => x.id === b.id)}>
                    {b.name}
                  </button>
                </li>
              ))}
              {!loading && results.length === 0 && <li className={styles.hint}>No matches</li>}
            </ul>
          )}
        </div>
      )}
      <div className={styles.meta}>{value.length}/{max} selected</div>
    </div>
  );
};

export default BusinessSearchSelect;
