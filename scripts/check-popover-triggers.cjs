/* =============================================================================
   Every shell popover trigger carries `data-act`.
   -----------------------------------------------------------------------------
   THE RULE IS IN ShellContext's PopBox: the popover dismisses on any document
   click that is not inside `.pop` and not on a `[data-act]` element. React 18
   flushes a discrete click synchronously, so `openPop` mounts the popover and
   registers that listener BEFORE the very click that opened it has finished
   bubbling to `document` — so a trigger without the attribute opens and closes
   the menu in one tick. It looks exactly like a button that does nothing, which
   is how the Tasks view switcher shipped and stayed broken: List, Board and
   Calendar had a segmented row of their own, so the menu only ever held
   Timeline and Analysis and nobody pressed it.

   Invoices and Quotations both carry a comment saying the attribute is
   load-bearing. A comment is not a check.

   IT MUST BE THE BUTTON'S OWN HANDLER. The first version of this script took a
   fixed window of characters after the tag and flagged two buttons INSIDE a
   popover — one of which closes it — because an `openPop` happened to sit
   further down the file. A trigger is a button whose own onClick opens the
   popover, so the tag is parsed properly (an arrow function's `>` is not the
   end of a JSX tag) and named handlers are resolved in the file.

   NOT EVERY `aria-haspopup` BUTTON, either. The panel has a second,
   self-contained menu pattern (`ib-menu` + `useMenuPlacement`, e.g. CreateMenu
   and the Today's-plan note) which owns its dismissal on `mousedown` with a
   containment test and needs nothing from the shell.
   ============================================================================= */
const fs = require("fs");
const path = require("path");

let failed = 0;
const ok = (what, cond) => {
  console.log("  " + (cond ? "ok  " : "FAIL") + " " + what);
  if (!cond) failed++;
};

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
};

/** The whole opening tag. `[^>]*>` stops at the first `>`, which inside
 *  `onClick={() => …}` is the arrow — so brace depth decides where it ends. */
function tagAt(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start, start + 400);
}

console.log("\nEvery shell popover trigger carries data-act\n");

const offenders = [];
let checked = 0;

for (const file of walk("src/admin")) {
  const text = fs.readFileSync(file, "utf8");
  if (!/openPop\(|\bpop\(e,/.test(text)) continue;

  for (let i = text.indexOf("<button"); i >= 0; i = text.indexOf("<button", i + 1)) {
    const tag = tagAt(text, i);
    let opens = /openPop\(|\bpop\(e,/.test(tag);

    /* `onClick={moreMenu}` — resolve the named handler in the same file. */
    if (!opens) {
      const named = /onClick=\{(\w+)\}/.exec(tag);
      if (named) {
        const def = new RegExp("(?:const|function)\\s+" + named[1] + "\\b[\\s\\S]{0,600}");
        const body = def.exec(text);
        opens = !!body && /openPop\(|\bpop\(e,/.test(body[0]);
      }
    }
    if (!opens) continue;

    checked++;
    if (!tag.includes("data-act")) {
      offenders.push(file + "\n          " + tag.replace(/\s+/g, " ").slice(0, 96));
    }
  }
}

ok(checked + " shell-popover triggers found", checked > 0);
ok("...and every one of them carries data-act", offenders.length === 0);
offenders.forEach((o) => console.log("       -> " + o));

console.log("\n" + (failed ? failed + " FAILED" : "all checks passed") + "\n");
process.exit(failed ? 1 : 0);
