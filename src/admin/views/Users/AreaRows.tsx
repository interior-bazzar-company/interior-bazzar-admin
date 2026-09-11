/* =============================================================================
   AreaRows — target areas as structured rows: a state, then its cities.
   -----------------------------------------------------------------------------
   This replaces two things at once, and the shape is the reason:

     · the old free-text area chips ("Uttam Nagar, Delhi" as one string), which
       could not be aggregated — "Delhi", "delhi ncr" and "Dwarka, Delhi" were
       three spellings of one claim, and no filter could read any of them
     · the registered-location trio (state / city / pincode), which answered a
       question the marketplace never asks. Nobody hires by registered address;
       they hire by "who works HERE".

   One row per state. The STATE is closed — that is what makes rows aggregate,
   every profile claiming Karnataka spells it one way. The CITIES inside a row
   are open with per-state suggestions, because "Uttam Nagar" is a real service
   area and no list holds every locality. Half of each row rigid, half free:
   the same closed/open split the facets use, applied within one field.

   EACH ROW IS A CARD, and its head is the claim in one line: the state's name,
   how much of it is claimed, and the control that takes the row away. That
   head is the reason the composite reads at a glance — five rows of two
   pickers is a wall, five titled cards is a list of five claims. A row with no
   state yet says so in its head rather than looking like a card that failed to
   load. States already claimed by another row leave the state picker's list —
   the duplicate is impossible to express rather than refused after the fact.
   ============================================================================= */
import FacetPicker from "./FacetPicker";
import { Button, Card, EmptyState, IconButton, Pill } from "../../ui";
import { ALL_CITIES, STATES, citySuggestionsOf } from "./store";
import type { ProfileField, TargetArea } from "./store";

/* Synthetic schema entries for the two pickers a row is made of. Local
   constants rather than vocabulary rows: they are HALVES of the one
   `targetAreas` field the schema declares, not fields of their own, and
   putting them in the schema would invite the form to render them twice. */
const ROW_STATE: ProfileField = {
  key: "area-state", label: "State", group: "contact",
  required: true, editable: true, public: true,
  type: "single", vocab: "states", chip: "tag-slate", placeholder: "Choose a state",
};
const ROW_CITIES: ProfileField = {
  key: "area-cities", label: "Cities", group: "contact",
  required: true, editable: true, public: true,
  type: "multi", open: true, max: 8, maxLength: 40, chip: "tag-teal",
  placeholder: "Search or type a city",
};

/** What a row claims, in the words somebody would use for it. */
function claim(row: TargetArea) {
  if (row.cities.indexOf(ALL_CITIES) >= 0) return { text: ALL_CITIES, tone: "ok" };
  if (!row.cities.length) return { text: "No city yet", tone: "warn" };
  return { text: row.cities.length + (row.cities.length === 1 ? " city" : " cities"), tone: "neutral" };
}

export default function AreaRows({ f, value, onChange, disabled }: {
  f: ProfileField;
  value: TargetArea[];
  onChange: (next: TargetArea[]) => void;
  disabled?: boolean;
}) {
  const maxRows = f.maxRows || 5;
  const claimed = value.map((r) => r.state);

  const patchRow = (i: number, patch: Partial<TargetArea>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => onChange(value.filter((_, j) => j !== i));
  const addRow = () => onChange(value.concat([{ state: "", cities: [] }]));

  /* One incomplete row at a time. An Add that works while the last row is
     still stateless manufactures the half-empty rows the validator then
     refuses — the button should not offer what the save will reject. */
  const lastIncomplete = value.length > 0
    && (!value[value.length - 1].state || !value[value.length - 1].cities.length);

  return (
    /* Named as a group: the rows inside carry their own picker labels, but
       the composite itself had no name — and now that the field's label row
       is gone (the legend names it), this is the only name it has. */
    <div className="flex min-w-0 flex-col gap-3" role="group" aria-label={f.label}>
      {value.length === 0 ? (
        <EmptyState flat icon="pin" title="No areas yet"
          body="Add the state they work in, then the cities inside it — that is what the marketplace matches on."
          action={disabled ? null : (
            <Button size="sm" color="secondary" ico="plus" onClick={addRow}>Add state</Button>
          )} />
      ) : null}

      {value.map((row, i) => {
        const named = STATES.filter((s) => s.key === row.state)[0];
        const c = claim(row);
        return (
          <Card
            key={i}
            tight
            title={row.state
              ? (named ? named.label : row.state)
              : <span className="text-tertiary">New area</span>}
            right={
              <>
                {row.state ? <Pill xs tone={c.tone} text={c.text} /> : null}
                {disabled ? null : (
                  <IconButton size="xs" ico="trash"
                    label={"Remove " + (row.state || "this row") + " and its cities"}
                    onClick={() => removeRow(i)} />
                )}
              </>
            }
          >
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="label-mono">State</span>
                <FacetPicker f={ROW_STATE} disabled={disabled}
                  values={row.state ? [row.state] : []}
                  /* States another row already holds leave this list — a duplicate
                     row becomes impossible to express, not refused after. */
                  options={STATES.filter((o) =>
                    o.key === row.state || claimed.indexOf(o.key) < 0)}
                  onChange={(next) => {
                    const state = next[0] || "";
                    /* A NEW state keeps only the cities that could still belong —
                       which is none of them, since city lists are per-state. Kept
                       cities under a changed state are wrong quietly. */
                    patchRow(i, state === row.state ? { state } : { state, cities: [] });
                  }} />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="label-mono">Cities</span>
                {row.state ? (
                  /* Chips under the box, so the city input and the state select
                     share one baseline across the row. */
                  <FacetPicker f={ROW_CITIES} disabled={disabled} chipsBelow
                    values={row.cities}
                    options={citySuggestionsOf(row.state)}
                    onChange={(cities) => {
                      /* "All cities" is exclusive both ways: picking it replaces
                         the list, and picking a specific city afterwards narrows
                         the claim, so the sentinel comes off. The validator
                         refuses the mixed state; this is what makes it
                         unreachable from the UI rather than merely refused. */
                      const hadAll = row.cities.indexOf(ALL_CITIES) >= 0;
                      const hasAll = cities.indexOf(ALL_CITIES) >= 0;
                      patchRow(i, {
                        cities: hasAll && !hadAll ? [ALL_CITIES]
                          : hasAll && cities.length > 1
                            ? cities.filter((c) => c !== ALL_CITIES)
                            : cities,
                      });
                    }} />
                ) : (
                  /* NOT A SKELETON. Nothing is loading — the question simply
                     does not exist until the state does, and a shimmer bar
                     here would promise cities that are never coming. */
                  <p className="flex h-9 items-center rounded-lg bg-secondary px-3 text-sm text-quaternary ring-1 ring-secondary ring-inset">
                    Pick the state first.
                  </p>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {disabled || !value.length ? null : (
        <div className="flex items-center gap-3">
          <Button size="sm" color="secondary" ico="plus" onClick={addRow}
            isDisabled={value.length >= maxRows || lastIncomplete}>
            Add state
          </Button>
          <span className="font-mono text-xs text-tertiary tnum">{value.length}/{maxRows}</span>
        </div>
      )}
    </div>
  );
}
