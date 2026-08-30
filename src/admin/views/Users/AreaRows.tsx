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

   Each row is a tile. Add state appends one; a row's remove control takes the
   whole row and its cities with it, and says so in its label. States already
   claimed by another row leave the state picker's list — the duplicate is
   impossible to express rather than refused after the fact.
   ============================================================================= */
import FacetPicker from "./FacetPicker";
import { Icon } from "../../ui";
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
    <div className="um-areas" role="group" aria-label={f.label}>
      {value.length === 0 ? (
        <p className="um-areas-none">No areas yet — add the state they work in.</p>
      ) : null}

      {value.map((row, i) => (
        <div className="um-area" key={i}>
          <div className="um-area-state">
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
          <div className="um-area-cities">
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
              <p className="um-area-wait">Pick the state first.</p>
            )}
          </div>
          {disabled ? null : (
            <button type="button" className="um-area-x"
              aria-label={"Remove " + (row.state || "this row") + " and its cities"}
              onClick={() => removeRow(i)}>
              <Icon name="x" size="sm" />
            </button>
          )}
        </div>
      ))}

      {disabled ? null : (
        <div className="um-areas-foot">
          <button type="button" className="btn sm" onClick={addRow}
            disabled={value.length >= maxRows || lastIncomplete}>
            <Icon name="plus" size="sm" />Add state
          </button>
          <span className="um-areas-count tnum">{value.length}/{maxRows}</span>
        </div>
      )}
    </div>
  );
}
