/* =============================================================================
   ui/select — THE panel's filter dropdown.
   -----------------------------------------------------------------------------
   A listbox — a button and a panel of options, both ours, Untitled UI's
   Select on React Aria underneath: keyboard-complete, portalled so no
   scrolling table body can clip it, announced properly.

   IT IS THE FILTER SELECT, NOT THE FORM SELECT. A filter narrows a list and
   must look ACTIVE when it is narrowing anything — the trigger wears the
   brand on its edge while a value is chosen, and the first row of the list
   is always the way to clear it. A form select is an answer to a question
   and is `SelectInput` in ./fields.

   An option can carry a MARK the rows carry too: a `dot` (an identity or
   status colour), a `badge` (one or two characters), or render as the row's
   own `chip`.
   ========================================================================== */
import type { ReactNode } from "react";
import { Select as UISelect } from "@/components/base/select/select";
import { cx } from "@/utils/cx";
import { Tag } from "./status";

export type SelectOption = {
    v: string;
    l: string;
    /** A colour word for a small dot — `ok`, `warn`, `bad`, `info`, `brand`,
     *  or one of the tag hues. A legacy class name renders neutral. */
    dot?: string;
    /** One or two characters in a small square. */
    badge?: string;
    /** Render the label as the row's own tag chip. */
    chip?: { tone?: string; auto?: boolean };
};
export type SelectOptionLike = string | SelectOption;

const norm = (o: SelectOptionLike): SelectOption => (typeof o === "string" ? { v: o, l: o } : o);

const DOT: Record<string, string> = {
    ok: "bg-utility-green-500",
    success: "bg-utility-green-500",
    warn: "bg-utility-yellow-500",
    warning: "bg-utility-yellow-500",
    bad: "bg-utility-red-500",
    error: "bg-utility-red-500",
    info: "bg-utility-blue-500",
    brand: "bg-brand-solid",
    live: "bg-utility-sky-500",
    sys: "bg-utility-indigo-500",
    system: "bg-utility-indigo-500",
    neutral: "bg-utility-neutral-400",
};

function Mark({ o }: { o: SelectOption }) {
    if (o.badge)
        return (
            <span data-icon className="flex size-5 items-center justify-center rounded-[5px] bg-secondary text-2xs font-semibold text-secondary ring-1 ring-secondary ring-inset">
                {o.badge}
            </span>
        );
    if (o.dot) {
        /* a bare word maps to a tone; a legacy class name (`s-qualified`) has
           no colour here and renders neutral, never nothing */
        const key = o.dot.replace(/^(s|u|t)-/, "");
        return <span data-icon className={cx("mx-1 size-2 rounded-full", DOT[key] || DOT[o.dot] || "bg-utility-neutral-400")} />;
    }
    return null;
}

const ANY = "__any__";

export function Select({
    name,
    label,
    value,
    options,
    onFilter,
    sm,
    allLabel,
    className,
}: {
    name: string;
    label?: string;
    value?: string | number;
    options: SelectOptionLike[];
    onFilter?: (name: string, value: string) => void;
    sm?: boolean;
    allLabel?: string;
    className?: string;
}) {
    void sm;
    const opts = options.map(norm);
    const cur = value === undefined || value === null || value === "" ? ANY : String(value);
    const title = label || name;
    const chosen = cur !== ANY;
    const items = [{ id: ANY, label: allLabel || title + " — any", opt: null as SelectOption | null }, ...opts.map((o) => ({ id: o.v, label: o.l, opt: o }))];

    return (
        <UISelect
            aria-label={title}
            size="sm"
            placeholder={title}
            items={items}
            selectedKey={chosen ? cur : null}
            onSelectionChange={(k) => onFilter && onFilter(name, k === null || k === ANY ? "" : String(k))}
            popoverClassName="min-w-52 w-max max-w-80"
            data-filter={name}
            data-options={opts.map((o) => o.l).join("|")}
            className={cx(
                "w-max min-w-0 max-w-full",
                /* the trigger, when a value narrows the list: the brand on its EDGE */
                chosen && "[&>button]:ring-brand [&>button]:bg-brand-primary [&>button_p]:text-brand-secondary",
                className,
            )}
        >
            {(item) => {
                const o = (item as { opt?: SelectOption | null }).opt;
                const isAny = item.id === ANY;
                return (
                    <UISelect.Item
                        id={item.id}
                        label={o?.chip ? undefined : item.label}
                        textValue={item.label}
                        icon={o ? <Mark o={o} /> : undefined}
                        className={cx(isAny && "[&_span]:text-tertiary")}
                    >
                        {o?.chip ? <Tag label={o.l} tone={o.chip.tone} auto={o.chip.auto} /> : undefined}
                    </UISelect.Item>
                );
            }}
        </UISelect>
    );
}

/** A convenience for the sort control: the same drawing with a named default. */
export function SortSelect(props: Omit<Parameters<typeof Select>[0], "allLabel"> & { defaultLabel?: ReactNode }) {
    return <Select {...props} allLabel={typeof props.defaultLabel === "string" ? props.defaultLabel : "Default order"} />;
}
