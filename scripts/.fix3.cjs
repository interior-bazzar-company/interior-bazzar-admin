const fs = require("fs");
const p = "scripts/check-finance-ledger.cjs";
const l = fs.readFileSync(p, "utf8").split("\n");
/* Build the heading by cloning one that already works, so no escape sequence
   has to survive a shell, a heredoc and a JS parser on the way in. */
const template = l.find((x) => x.indexOf("writes \u00b7 arrears are paid oldest first") >= 0);
if (!template) { console.log("no template"); process.exit(1); }
const heading = template.replace("arrears are paid oldest first",
  "every salary payment carries a receipt, whatever the method");
const i = l.findIndex((x) => x.trim() === 'console.log("');
if (i < 0) { console.log("nothing broken"); process.exit(0); }
l.splice(i, 2, heading);
fs.writeFileSync(p, l.join("\n"));
console.log("repaired");
