const fs = require("fs");
const p = "scripts/check-finance-ledger.cjs";
const lines = fs.readFileSync(p, "utf8").split("\n");
const a = lines.findIndex((l) => l.indexOf('how it was paid decides what evidence is asked for') >= 0);
const b = lines.findIndex((l) => l.indexOf('console.log("\nwrites · arrears are paid oldest first")') >= 0);
if (a < 0 || b < 0) { console.log("bounds not found", a, b); process.exit(1); }
const NEW = `console.log("\nwrites · every salary payment carries a receipt, whatever the method");
S.resetStore();
{
  /* THE REFERENCE FIELD IS GONE. It was a UTR typed from memory on a screen
     where nothing checked it against a statement, and a reference nobody
     verifies is one nobody should trust. The attachment replaced it, for every
     method — a payment with no evidence at all is a claim, which is the one
     thing this module refuses to store. */
  const ID = "SAL-AC-0022";
  const acct = { accountId: "ACC-HDFC-4021" };
  const PDF = { filename: "receipt.pdf", mime: "application/pdf" };
  const JPG = { filename: "upi-screenshot.jpg", mime: "image/jpeg" };

  ok("bank transfer with no receipt is refused",
    has(S.paySalary(ID, { via: "bank", ...acct, proof: { filename: "", mime: "" } }), "proof_required"), true);
  ok("UPI with no receipt is refused",
    has(S.paySalary(ID, { via: "upi", ...acct, proof: { filename: "", mime: "" } }), "proof_required"), true);
  ok("cash with no receipt is refused — the rule does not vary by method",
    has(S.paySalary(ID, { via: "cash", ...acct, proof: { filename: "", mime: "" } }), "proof_required"), true);

  ok("a file that is neither an image nor a PDF is refused",
    has(S.paySalary(ID, { via: "bank", ...acct, proof: { filename: "notes.txt", mime: "text/plain" } }), "proof_type"), true);
  ok("...and the refusal names the file, so it is obvious which one",
    has(S.paySalary(ID, { via: "bank", ...acct, proof: { filename: "notes.txt", mime: "text/plain" } }), "notes.txt"), true);
  ok("a spreadsheet is refused too", S.proofAccepted("application/vnd.ms-excel"), false);
  ok("a PDF is accepted", S.proofAccepted("application/pdf"), true);
  ok("...so is a photo, which is what a cash acknowledgement usually is",
    [S.proofAccepted("image/jpeg"), S.proofAccepted("image/png")], [true, true]);

  ok("an unknown method is refused",
    has(S.paySalary(ID, { via: "carrier-pigeon", ...acct, proof: PDF }), "Pick how it was paid"), true);

  ok("UPI with a screenshot is accepted", S.paySalary(ID, { via: "upi", ...acct, proof: JPG, remark: "Sent at 6pm" }), "");
  const slip = S.readRun("RUN-2026-08").slips.filter((s) => s.salaryAccountId === ID)[0];
  ok("...the slip carries NO reference at all", slip.reference, "");
  ok("...it carries the receipt instead", slip.proof.filename, "upi-screenshot.jpg");
  ok("...the method is stored in both vocabularies", [slip.via, slip.mode], ["upi", "UPI"]);
  ok("...the remark is kept, load-bearing on nothing", slip.remark, "Sent at 6pm");
  ok("...and it still froze: paid date, issued date and hash",
    [!!slip.paidAt, !!slip.issuedAt, !!slip.sha256], [true, true, true]);
  void PDF;
}

`;
lines.splice(a - 1, b - (a - 1), ...NEW.split("\n"));
fs.writeFileSync(p, lines.join("\n"));
console.log("evidence section rewritten");
