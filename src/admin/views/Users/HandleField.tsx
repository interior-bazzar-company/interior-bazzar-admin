/* =============================================================================
   HandleField — the username, and the public URL it produces.
   -----------------------------------------------------------------------------
   A username is not a text field with a rule on it. It is an ADDRESS: it is
   what the profile is reachable at, it is what gets shared, and it is the one
   value on this form that another profile can already be holding. So the
   control shows all three things at once — what you typed, what URL it makes,
   and whether anybody else has it — rather than making somebody press Save to
   find out.

   THE VERDICT IS THE POINT. Three states, said plainly and differently:

     malformed   your mistake, and fixable from the message alone
     taken       not your mistake, and no amount of re-reading fixes it
     free        say so, out loud, because the absence of an error is not
                 the same as confirmation and people re-check silence

   The URL is shown even while the handle is invalid, greyed. Seeing the
   address form up as you type is what makes it obvious that this field is the
   address — a validation message under a text box teaches nobody that.

   COPY IS NOT AVAILABLE UNTIL THE HANDLE IS SAVED AND FREE. A copy button that
   hands somebody a link to a profile that does not exist yet is worse than no
   button: they will paste it somewhere.
   ============================================================================= */
import { useEffect, useState } from "react";
import { Icon } from "../../ui";
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
  const url = profileUrl(v || "your-business");

  const suggestion = !v && suggestFrom ? slugify(suggestFrom) : "";

  const copy = () => {
    try {
      navigator.clipboard.writeText(profileUrl(v));
      setCopied(true);
    } catch {
      /* Clipboard is permission-gated and throws on an insecure origin. The
         input below is selectable, so there is still a way through — saying
         nothing and doing nothing is what would leave somebody stuck. */
      setCopied(false);
    }
  };

  return (
    <div className={"um-handle" + (free ? " ok" : "") + (malformed || taken ? " bad" : "")}>
      <div className="um-handle-in">
        <span className="um-handle-pre" aria-hidden="true">
          {String(profileUrl("")).replace(/^https?:\/\//, "")}
        </span>
        <input
          className="inp"
          value={value}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          aria-label="Username"
          aria-invalid={!!malformed || taken}
          aria-describedby="handle-note"
          placeholder="business-name"
          /* Lower-cased and hyphenated as you type rather than rejected after
             the fact. Somebody typing "Meera Studio" means `meera-studio`, and
             a form that knows that should not make them find out by failing. */
          onChange={(e) => onChange(slugify(e.target.value))}
        />
        {live && free ? (
          <button type="button" className="um-handle-copy" onClick={copy}
            aria-label="Copy the profile link">
            <Icon name={copied ? "check" : "link"} size="sm" />
            {copied ? "Copied" : "Copy link"}
          </button>
        ) : null}
      </div>

      <p className="um-handle-note" id="handle-note">
        {malformed ? (
          <span className="bad"><Icon name="alert" size="sm" />{malformed}</span>
        ) : taken ? (
          <span className="bad">
            <Icon name="alert" size="sm" />
            Taken by another profile. Try <b>{v}-studio</b> or <b>{v}-interiors</b>.
          </span>
        ) : free ? (
          <span className="ok">
            <Icon name="check" size="sm" />
            Available{live ? " · this link is live" : " · not saved yet"}
          </span>
        ) : suggestion ? (
          <button type="button" className="um-handle-sug" onClick={() => onChange(suggestion)}>
            Use <b>{suggestion}</b>
          </button>
        ) : (
          <span>{USERNAME_RULES.help}</span>
        )}
      </p>

      <p className={"um-handle-url" + (free ? "" : " off")}>
        <Icon name="ext" size="sm" />
        <span className="mono">{url}</span>
      </p>
    </div>
  );
}
