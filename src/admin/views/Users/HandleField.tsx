/* =============================================================================
   HandleField — the username, and the public URL it produces.
   -----------------------------------------------------------------------------
   A username is not a text field with a rule on it. It is an ADDRESS: it is
   what the profile is reachable at, it is what gets shared, and it is the one
   value on this form that another profile can already be holding. So the
   control shows all three things at once — what you typed, what URL it makes,
   and whether anybody else has it — rather than making somebody press Save to
   find out.

   THE VERDICT IS THE POINT, and it is said where the panel says every other
   field's verdict: as the field's own `err` when it is wrong, its `hint` when
   it is not. Three states, plainly and differently:

     malformed   your mistake, and fixable from the message alone
     taken       not your mistake, and no amount of re-reading fixes it
     free        say so, out loud, because the absence of an error is not
                 the same as confirmation and people re-check silence

   The host is welded to the box as an `InputGroup` prefix — one control with
   one border — so the field reads as the address it is. It used to also print
   the full URL underneath, the same string a second time one line lower, and
   that was the clutter the prefix had already made unnecessary.

   COPY IS NOT AVAILABLE UNTIL THE HANDLE IS SAVED AND FREE. A copy button that
   hands somebody a link to a profile that does not exist yet is worse than no
   button: they will paste it somewhere.
   ============================================================================= */
import { useEffect, useState } from "react";
import { Button, FormField, Icon, Input, InputGroup, copyToClipboard } from "../../ui";
import {
  USERNAME_RULES, profileUrl, slugify, usernameError, usernameTaken,
} from "./store";

export default function HandleField({ value, saved, userId, suggestFrom, disabled, onChange }: {
  value: string;
  /** What is stored right now, so Copy can refuse a link that is not live. */
  saved: string | null;
  userId: string;
  /** Business name, offered as a handle when the field is empty. */
  suggestFrom?: string | null;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const v = value.trim();
  const malformed = usernameError(v);
  const taken = !malformed && !!v && usernameTaken(v, userId);
  const free = !!v && !malformed && !taken;
  /* Live only once it is the STORED value. Typing a valid handle does not put
     a page on the internet. */
  const live = !!saved && saved === v;

  const suggestion = !v && suggestFrom ? slugify(suggestFrom) : "";
  const host = String(profileUrl("")).replace(/^https?:\/\//, "");

  /* Through the shared helper: the async clipboard REJECTS on an insecure
     origin (the `vite --host` LAN case) rather than throwing, so a sync
     try/catch reported "Copied" over an empty clipboard. The helper falls
     back to the legacy copy command and says what actually happened. */
  const copy = () => {
    copyToClipboard(profileUrl(v)).then((line) => setCopied(line === "Copied."));
  };

  const err = malformed
    ? malformed
    : taken
      ? <>Taken by another profile. Try <b className="font-mono">{v}-studio</b> or <b className="font-mono">{v}-interiors</b>.</>
      : undefined;

  const hint = err
    ? undefined
    : free
      ? <span className="inline-flex items-center gap-1 text-success-primary">
          <Icon name="check" size="xs" />
          Available{live ? " · this link is live" : " · not saved yet"}
        </span>
      : suggestion
        ? <button type="button"
            className="cursor-pointer rounded text-left text-sm text-brand-secondary outline-focus-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={() => onChange(suggestion)}>
            Use <b className="font-mono font-medium">{suggestion}</b>
          </button>
        : USERNAME_RULES.help;

  return (
    <FormField err={err} hint={hint}>
      <div className="flex min-w-0 items-center gap-2">
        <InputGroup pre={<span className="font-mono text-xs">{host}</span>} className="min-w-0 flex-1">
          <Input
            mono
            value={value}
            disabled={disabled}
            err={!!err}
            ariaLabel="Username"
            ph="business-name"
            /* Lower-cased and hyphenated as you type rather than rejected after
               the fact. Somebody typing "Meera Studio" means `meera-studio`,
               and a form that knows that should not make them find out by
               failing. */
            onChange={(next) => onChange(slugify(next))}
          />
        </InputGroup>
        {live && free ? (
          <Button size="sm" color="secondary" ico={copied ? "check" : "link"} onClick={copy}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        ) : null}
      </div>
    </FormField>
  );
}
