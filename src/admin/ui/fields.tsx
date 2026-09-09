/* =============================================================================
   ui/fields — every form control, once.
   -----------------------------------------------------------------------------
   THE LABEL IS ALWAYS A REAL <label>. Placeholder-as-label is the most common
   accessibility defect in an admin panel and it fails at the exact moment it
   matters: the question disappears the instant somebody starts typing.

   The controls are Untitled UI's (React Aria underneath); what this file adds
   is the panel's own prop shapes — `ph`, `err`, `sm`, `onChange(value)` — that
   a hundred and fifty views already write, so nothing at a call site moved.
   ========================================================================== */
import { useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, Ref } from "react";
import type { Selection } from "react-aria-components";
import { SearchLg, UploadCloud02 } from "@untitledui/icons";
import { Checkbox as UICheckbox } from "@/components/base/checkbox/checkbox";
import { RadioButtonBase } from "@/components/base/radio-buttons/radio-buttons";
import { Toggle as UIToggle } from "@/components/base/toggle/toggle";
import { InputBase } from "@/components/base/input/input";
import { InputGroup as UIInputGroup } from "@/components/base/input/input-group";
import { TextAreaBase } from "@/components/base/textarea/textarea";
import { NativeSelect } from "@/components/base/select/select-native";
import { MultiSelect as UIMultiSelect } from "@/components/base/select/multi-select";
import { FileTrigger } from "@/components/base/file-upload-trigger/file-upload-trigger";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { cx } from "@/utils/cx";
import { Icon } from "./icon";
import { Tag } from "./status";

/* ------------------------------------------------------------- the group */
/* THE WRAPPER EVERY CONTROL SHARES: the label, the control, and then EITHER an
   error or a hint — never both. */
export function FormField({
    id,
    label,
    req,
    hint,
    err,
    children,
    cls,
    className,
    tip,
}: {
    id?: string;
    label?: ReactNode;
    req?: boolean;
    hint?: ReactNode;
    err?: ReactNode;
    children: ReactNode;
    cls?: string;
    className?: string;
    /** a short explanation on the label, behind a help icon */
    tip?: ReactNode;
}) {
    return (
        <div className={cx("flex w-full min-w-0 flex-col gap-1.5", cls, className)}>
            {label ? (
                <label htmlFor={id} className="flex items-center gap-1 text-sm font-medium text-secondary">
                    {label}
                    {req ? (
                        <span className="text-brand-tertiary" title="Required">
                            *
                        </span>
                    ) : null}
                    {tip ? <span className="ml-1 text-xs font-normal text-quaternary">{tip}</span> : null}
                </label>
            ) : null}
            {children}
            {err ? (
                <span className="flex items-center gap-1 text-sm text-error-primary" role="alert">
                    <Icon name="alert" size="xs" />
                    {err}
                </span>
            ) : hint ? (
                <span className="text-sm text-tertiary">{hint}</span>
            ) : null}
        </div>
    );
}

/* A FORM SECTION — a titled group of fields. Progressive disclosure is a
   section with `open={false}`. */
export function FormSection({ title, desc, children, className }: { title?: ReactNode; desc?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <fieldset className={cx("flex min-w-0 flex-col gap-4", className)}>
            {title ? (
                <legend className="mb-1 flex flex-col">
                    <span className="text-sm font-semibold text-primary">{title}</span>
                    {desc ? <span className="mt-0.5 text-sm text-tertiary">{desc}</span> : null}
                </legend>
            ) : null}
            {children}
        </fieldset>
    );
}

/* Two or three fields on one line, stacking on a phone. */
export function FieldRow({ children, cols = 2, className }: { children: ReactNode; cols?: 2 | 3; className?: string }) {
    return <div className={cx("grid grid-cols-1 gap-4", cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2", className)}>{children}</div>;
}

/* ----------------------------------------------------------------- input */
export interface InputProps {
    id?: string;
    name?: string;
    type?: string;
    value?: string;
    defaultValue?: string;
    ph?: string;
    err?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    sm?: boolean;
    required?: boolean;
    ariaLabel?: string;
    autoFocus?: boolean;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    maxLength?: number;
    mono?: boolean;
    icon?: string;
    /** the id of a `<datalist>` — a field with SUGGESTIONS that is still free
     *  text (a controlled vocabulary somebody may extend). Not a Select: a
     *  Select is a closed list, this one takes an answer that is not on it. */
    list?: string;
    className?: string;
    inputClassName?: string;
    onChange?: (v: string) => void;
    onEnter?: () => void;
    onBlur?: () => void;
    "data-filter"?: string;
}

export function Input(p: InputProps) {
    return (
        <InputBase
            id={p.id}
            name={p.name}
            type={p.type || "text"}
            size="sm"
            value={p.value}
            defaultValue={p.defaultValue}
            placeholder={p.ph}
            isDisabled={p.disabled}
            isInvalid={p.err}
            isRequired={p.required}
            readOnly={p.readOnly}
            aria-label={p.ariaLabel}
            autoFocus={p.autoFocus}
            min={p.min}
            max={p.max}
            step={p.step}
            maxLength={p.maxLength}
            list={p.list}
            icon={p.icon ? ((props) => <Icon name={p.icon as string} {...props} />) : undefined}
            wrapperClassName={cx(p.readOnly && "bg-secondary", p.className)}
            inputClassName={cx(p.mono && "font-mono tnum", p.readOnly && "text-secondary", p.inputClassName)}
            data-filter={p["data-filter"]}
            onChange={(e) => p.onChange && p.onChange(e.target.value)}
            onBlur={p.onBlur}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter" && p.onEnter) p.onEnter();
            }}
        />
    );
}

export function Textarea(p: InputProps & { rows?: number; ref?: Ref<HTMLTextAreaElement> }) {
    return (
        <TextAreaBase
            ref={p.ref}
            id={p.id}
            name={p.name}
            rows={p.rows || 4}
            size="sm"
            value={p.value}
            defaultValue={p.defaultValue}
            placeholder={p.ph}
            disabled={p.disabled}
            required={p.required}
            readOnly={p.readOnly}
            aria-label={p.ariaLabel}
            aria-invalid={p.err || undefined}
            autoFocus={p.autoFocus}
            maxLength={p.maxLength}
            className={cx("field-sizing-content min-h-20", p.err && "ring-error_subtle focus:ring-error", p.readOnly && "bg-secondary text-secondary", p.className)}
            onChange={(e) => p.onChange && p.onChange(e.target.value)}
            onBlur={p.onBlur}
        />
    );
}

/* A FORM select — an ANSWER, native on purpose: the platform's own list is
   right on a phone and with a screen reader. The FILTER select is ./select. */
export function SelectInput({
    id,
    name,
    options,
    value,
    defaultValue,
    ph,
    err,
    sm,
    disabled,
    ariaLabel,
    onChange,
    className,
}: {
    id?: string;
    name?: string;
    options: (string | { v: string; l: string })[];
    value?: string;
    defaultValue?: string;
    ph?: string;
    err?: boolean;
    sm?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    onChange?: (v: string) => void;
    className?: string;
}) {
    void sm;
    const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : { value: o.v, label: o.l }));
    if (ph !== undefined) opts.unshift({ value: "", label: ph });
    return (
        <NativeSelect
            id={id}
            name={name}
            size="sm"
            options={opts}
            value={value}
            defaultValue={defaultValue}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-invalid={err || undefined}
            className={className}
            selectClassName={cx("w-full", err && "ring-error_subtle focus-visible:ring-error")}
            onChange={(e) => onChange && onChange(e.target.value)}
        />
    );
}

/* INPUT GROUP — a field with a fixed prefix or suffix welded to it: ₹, %, /mo.
   ONE control with one border, not a field beside a label. */
export function InputGroup({ pre, post, children, action, className }: { pre?: ReactNode; post?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
    return (
        <UIInputGroup
            size="sm"
            className={className}
            leadingAddon={pre ? <UIInputGroup.Prefix>{pre}</UIInputGroup.Prefix> : undefined}
            trailingAddon={post ? <UIInputGroup.Prefix position="trailing">{post}</UIInputGroup.Prefix> : action}
        >
            {children}
        </UIInputGroup>
    );
}

/* -------------------------------------------------------------- choices */
export function Checkbox({
    id,
    checked,
    indeterminate,
    disabled,
    label,
    hint,
    onChange,
    ariaLabel,
    className,
}: {
    id?: string;
    checked?: boolean;
    indeterminate?: boolean;
    disabled?: boolean;
    label?: ReactNode;
    hint?: ReactNode;
    ariaLabel?: string;
    onChange?: (v: boolean) => void;
    className?: string;
}) {
    return (
        <UICheckbox
            id={id}
            isSelected={!!checked}
            isIndeterminate={indeterminate}
            isDisabled={disabled}
            aria-label={ariaLabel}
            label={label}
            hint={hint}
            className={className}
            onChange={(v) => onChange && onChange(v)}
        />
    );
}

/* RADIO — one of a set that shares a `name`. Native underneath so a set spread
   across a form still behaves as a group for the keyboard and the reader. */
export function Radio({
    id,
    name,
    value,
    checked,
    disabled,
    label,
    hint,
    onChange,
}: {
    id?: string;
    name: string;
    value: string;
    checked?: boolean;
    disabled?: boolean;
    label?: ReactNode;
    hint?: ReactNode;
    onChange?: (v: string) => void;
}) {
    const [focus, setFocus] = useState(false);
    return (
        <label htmlFor={id} className={cx("flex items-start gap-2", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
            <span className="relative mt-0.5 flex">
                <input
                    type="radio"
                    id={id}
                    name={name}
                    value={value}
                    checked={checked}
                    disabled={disabled}
                    className="peer sr-only"
                    onFocus={() => setFocus(true)}
                    onBlur={() => setFocus(false)}
                    onChange={() => onChange && onChange(value)}
                />
                <RadioButtonBase isSelected={!!checked} isDisabled={disabled} isFocusVisible={focus} />
            </span>
            {label || hint ? (
                <span className="inline-flex flex-col">
                    {label ? <span className="text-sm font-medium text-secondary select-none">{label}</span> : null}
                    {hint ? <span className="text-sm text-tertiary">{hint}</span> : null}
                </span>
            ) : null}
        </label>
    );
}

/* TOGGLE — an IMMEDIATE switch, not a form answer. */
export function Toggle({
    id,
    on,
    disabled,
    label,
    hint,
    onChange,
    ariaLabel,
    className,
}: {
    id?: string;
    on: boolean;
    disabled?: boolean;
    label?: ReactNode;
    hint?: ReactNode;
    ariaLabel?: string;
    onChange: (v: boolean) => void;
    className?: string;
}) {
    return (
        <UIToggle
            id={id}
            size="sm"
            isSelected={on}
            isDisabled={disabled}
            aria-label={ariaLabel}
            label={typeof label === "string" ? label : undefined}
            hint={hint}
            className={className}
            onChange={onChange}
        >
            {typeof label !== "string" && label ? <span className="text-sm font-medium text-secondary">{label}</span> : null}
        </UIToggle>
    );
}

/* ----------------------------------------------------------------- dates */
/* DATE — a real <input type="date">, so it gets the platform's own picker and
   keyboard entry that already works everywhere. */
export function DateInput({
    id,
    value,
    defaultValue,
    min,
    max,
    sm,
    disabled,
    ariaLabel,
    onChange,
    className,
}: {
    id?: string;
    value?: string;
    defaultValue?: string;
    min?: string;
    max?: string;
    sm?: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    onChange?: (v: string) => void;
    className?: string;
}) {
    void sm;
    return (
        <InputBase
            id={id}
            type="date"
            size="sm"
            value={value}
            defaultValue={defaultValue}
            min={min}
            max={max}
            isDisabled={disabled}
            aria-label={ariaLabel}
            wrapperClassName={cx("w-max", className)}
            inputClassName="tnum"
            onChange={(e) => onChange && onChange(e.target.value)}
        />
    );
}

/* DATE RANGE — two dates that constrain each other. */
export function DateRange({
    from,
    to,
    sm,
    onChange,
    labelFrom,
    labelTo,
    className,
}: {
    from?: string;
    to?: string;
    sm?: boolean;
    labelFrom?: string;
    labelTo?: string;
    onChange: (from: string, to: string) => void;
    className?: string;
}) {
    return (
        <span className={cx("inline-flex items-center gap-1.5", className)}>
            <DateInput value={from || ""} max={to || undefined} sm={sm} ariaLabel={labelFrom || "From"} onChange={(v) => onChange(v, to || "")} />
            <span className="text-quaternary">–</span>
            <DateInput value={to || ""} min={from || undefined} sm={sm} ariaLabel={labelTo || "To"} onChange={(v) => onChange(from || "", v)} />
        </span>
    );
}

/* ------------------------------------------------------------ multi-select */
/* MULTI-SELECT — several values from a KNOWN list. The closed control says HOW
   MANY are on, which is the only thing you need from it while reading the
   table underneath. */
export function MultiSelect({
    options,
    value,
    onChange,
    label,
    sm,
    max,
    className,
}: {
    options: { v: string; l: ReactNode }[];
    value: string[];
    onChange: (v: string[]) => void;
    label?: string;
    sm?: boolean;
    max?: number;
    className?: string;
}) {
    void sm;
    const items = options.map((o) => ({ id: o.v, label: typeof o.l === "string" ? o.l : o.v, node: o.l }));
    const pick = (keys: Selection) => {
        let next = keys === "all" ? options.map((o) => o.v) : [...keys].map(String);
        if (max && next.length > max) next = next.slice(0, max);
        onChange(next);
    };
    return (
        <UIMultiSelect
            size="sm"
            placeholder={label || "Select"}
            items={items}
            selectedKeys={new Set(value)}
            onSelectionChange={pick}
            onReset={() => onChange([])}
            onSelectAll={() => pick("all")}
            selectedCountFormatter={(n) => `${label ? label + " · " : ""}${n} selected`}
            supportingText={max ? `of ${max}` : undefined}
            className={cx("w-max min-w-40", className)}
        >
            {(item) => (
                <UIMultiSelect.Item id={item.id} label={item.label} selectionIndicator="checkbox" selectionIndicatorAlign="left">
                    {(item as { node?: ReactNode }).node}
                </UIMultiSelect.Item>
            )}
        </UIMultiSelect>
    );
}

/* ---------------------------------------------------------------- upload */
/* FILE UPLOAD — a drop zone that is ALSO a button. It names what it accepts
   and how big before anything is chosen. */
export function FileUpload({
    id,
    accept,
    multiple,
    hint,
    disabled,
    onFiles,
    className,
}: {
    id?: string;
    accept?: string;
    multiple?: boolean;
    hint?: ReactNode;
    disabled?: boolean;
    onFiles: (files: File[]) => void;
    className?: string;
}) {
    const [over, setOver] = useState(false);
    const take = (list: FileList | null) => {
        if (!list || !list.length) return;
        onFiles(Array.prototype.slice.call(list) as File[]);
    };
    return (
        <FileTrigger acceptedFileTypes={accept ? accept.split(",").map((s) => s.trim()) : undefined} allowsMultiple={multiple} onSelect={take}>
            <div
                id={id}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled}
                className={cx(
                    "flex cursor-pointer flex-col items-center gap-3 rounded-xl bg-primary px-6 py-5 text-center ring-1 ring-secondary outline-focus-ring transition duration-100 focus-visible:outline-2 focus-visible:outline-offset-2",
                    over && "ring-2 ring-brand bg-brand-primary",
                    disabled && "pointer-events-none opacity-50",
                    className,
                )}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!disabled) setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setOver(false);
                    if (!disabled) take(e.dataTransfer.files);
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLElement).click();
                }}
            >
                <FeaturedIcon icon={UploadCloud02} size="md" color="gray" theme="modern" />
                <div className="flex flex-col gap-0.5">
                    <p className="text-sm text-tertiary">
                        <span className="font-semibold text-brand-secondary">Click to upload</span> or drag and drop
                    </p>
                    {hint ? <p className="text-xs text-tertiary">{hint}</p> : null}
                </div>
            </div>
        </FileTrigger>
    );
}

/* ------------------------------------------------------------ chip input */
/* CHIP INPUT — several values in one field. THE BOX IS THE INPUT: the chips
   sit inside it and the caret follows them. Enter and a comma commit;
   Backspace on an empty box takes the last chip back; blur commits a typed
   word rather than dropping it. */
export function ChipInput({
    id,
    value,
    onChange,
    placeholder,
    clean,
    disabled,
    invalid,
    ariaLabel,
    max,
    className,
}: {
    id?: string;
    value: string[];
    onChange: (v: string[]) => void;
    placeholder?: string;
    clean?: (v: string[]) => string[];
    disabled?: boolean;
    invalid?: boolean;
    ariaLabel?: string;
    max?: number;
    className?: string;
}) {
    const [draft, setDraft] = useState("");
    const box = useRef<HTMLDivElement>(null);
    const norm =
        clean ||
        ((v: string[]) => {
            const out: string[] = [];
            v.forEach((raw) => {
                const t = String(raw || "").trim();
                if (t && out.indexOf(t) < 0) out.push(t);
            });
            return typeof max === "number" ? out.slice(0, max) : out;
        });
    const commit = (raw: string) => {
        const next = norm(value.concat(String(raw).split(",")));
        if (next.length !== value.length) onChange(next);
        setDraft("");
    };
    return (
        <div
            ref={box}
            className={cx(
                "flex min-h-9 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 shadow-xs ring-1 ring-primary transition-shadow duration-100 ring-inset focus-within:ring-2 focus-within:ring-brand",
                invalid && "ring-error_subtle focus-within:ring-error",
                disabled && "cursor-not-allowed opacity-50",
                className,
            )}
            onMouseDown={(e) => {
                if (disabled) {
                    e.preventDefault();
                    return;
                }
                if ((e.target as HTMLElement).closest("button,input")) return;
                e.preventDefault();
                box.current?.querySelector("input")?.focus();
            }}
        >
            {value.map((t) => (
                <Tag key={t} label={t} tone="brand" onRemove={disabled ? undefined : () => onChange(value.filter((y) => y !== t))} />
            ))}
            <input
                id={id}
                value={draft}
                disabled={disabled}
                aria-label={ariaLabel}
                placeholder={value.length && !placeholder ? "Add another" : placeholder}
                className="min-w-24 flex-1 bg-transparent px-1 text-sm text-primary outline-hidden placeholder:text-placeholder"
                onChange={(e) => {
                    if (e.target.value.indexOf(",") >= 0) commit(e.target.value);
                    else setDraft(e.target.value);
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) {
                        e.preventDefault();
                        commit(draft);
                    }
                    if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
                }}
                onBlur={() => {
                    if (draft.trim()) commit(draft);
                }}
            />
        </div>
    );
}

/* ---------------------------------------------------------------- search */
/* THE SEARCH FIELD. `data-filter` rides on the REAL input — Plans, Roles and
   Team read it back with querySelector('input[data-filter="q"]'). */
export function SearchField({
    ph,
    val,
    name,
    onFilter,
    className,
    autoFocus,
}: {
    ph?: string;
    val?: string;
    name?: string;
    onFilter?: (name: string, value: string) => void;
    className?: string;
    autoFocus?: boolean;
}) {
    return (
        <InputBase
            type="search"
            size="sm"
            icon={SearchLg}
            placeholder={ph}
            defaultValue={val || ""}
            autoComplete="off"
            autoFocus={autoFocus}
            aria-label={ph || "Search"}
            data-filter={name || "q"}
            wrapperClassName={cx("min-w-0 flex-1 basis-56 md:max-w-sm", className)}
            onChange={(e) => onFilter && onFilter(name || "q", e.target.value)}
        />
    );
}

/* ------------------------------------------------------------- legacy Field */
/* One field renderer the document builders still call: label + an uncontrolled
   control + help. */
export interface FieldProps {
    label?: ReactNode;
    id?: string;
    custom?: ReactNode;
    help?: ReactNode;
    tone?: string;
    req?: boolean;
    type?: string;
    options?: { v: string; l: string; sel?: boolean }[];
    rows?: number;
    ph?: string;
    value?: string | number;
    ro?: boolean;
    readonly?: boolean;
}
export function Field(o: FieldProps) {
    const gen = useId();
    const id = o.id || gen;
    const help = o.help ? <span className={cx("text-sm", o.tone === "bad" ? "text-error-primary" : o.tone === "warn" ? "text-warning-primary" : "text-tertiary")}>{o.help}</span> : null;
    if (o.custom)
        return (
            <div className="flex w-full min-w-0 flex-col gap-1.5">
                {o.label ? <span className="text-sm font-medium text-secondary">{o.label}</span> : null}
                {o.custom}
                {help}
            </div>
        );
    const opts = o.options || [];
    return (
        <FormField id={id} label={o.label} req={o.req}>
            {o.type === "select" ? (
                <SelectInput id={id} options={opts.map((x) => ({ v: x.v, l: x.l }))} defaultValue={(opts.filter((x) => x.sel)[0] || { v: undefined }).v} />
            ) : o.type === "textarea" ? (
                <Textarea id={id} rows={o.rows} ph={o.ph} defaultValue={o.value === undefined || o.value === null ? "" : String(o.value)} readOnly={!!(o.ro || o.readonly)} />
            ) : (
                <Input id={id} type={o.type || "text"} ph={o.ph} defaultValue={o.value === 0 ? "0" : o.value === undefined || o.value === null ? "" : String(o.value)} readOnly={!!(o.ro || o.readonly)} />
            )}
            {help}
        </FormField>
    );
}
