/* =============================================================================
   Interior bazzar — Admin Access · data layer
   -----------------------------------------------------------------------------
   One dataset, shared by every module view, that RECONCILES.

   The chain, end to end:
     Deal → Quotation → Invoice → Payment
   and the totals a module shows are computed from these rows, never typed in.
   That is the whole point: if a figure on the dashboard disagrees with the
   module it came from, the data is wrong — not the copy.

   MONEY IS INTEGER PAISE, everywhere. ₹2,47,800 is 24780000. No float ever
   reaches a commercial total and no display rounding is written back.
   (DEALS_OPERATION §6 · INVOICE_CHAIN_CONTRACT §5.7)

   Team members are NOT seeded here — they are read live from `ib_team_users`,
   the same localStorage store admin-auth.html writes. Register on the sign-in
   page and the person appears in Settings → Team, awaiting a role.
   ============================================================================= */
(function (root) {
  "use strict";

  /* ----------------------------------------------------------------- time --- */
  // Fixed "today" so every relative date in the prototype is stable and the
  // overdue counts do not drift as the file ages.
  var TODAY = new Date(2026, 5, 28); // 28 June 2026

  function d(iso) { var p = iso.split("-"); return new Date(+p[0], p[1] - 1, +p[2]); }
  function days(a, b) { return Math.round((a - (b || TODAY)) / 86400000); }
  function fmtDate(dt) {
    if (!dt) return "—";
    if (typeof dt === "string") dt = d(dt);
    return dt.getDate().toString().padStart(2, "0") + " " +
      ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dt.getMonth()] +
      " " + dt.getFullYear();
  }
  function fmtDay(dt) {
    if (typeof dt === "string") dt = d(dt);
    return dt.getDate().toString().padStart(2, "0") + " " +
      ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dt.getMonth()];
  }
  function relative(iso) {
    var n = days(d(iso));
    if (n === 0) return "today";
    if (n === 1) return "tomorrow";
    if (n === -1) return "yesterday";
    return n > 0 ? "in " + n + "d" : Math.abs(n) + "d ago";
  }
  function longDate(dt) {
    dt = dt || TODAY;
    return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][dt.getDay()] +
      ", " + dt.getDate() + " " +
      ["January","February","March","April","May","June","July","August","September","October","November","December"][dt.getMonth()] +
      " " + dt.getFullYear();
  }

  /* ---------------------------------------------------------------- money --- */
  // Indian lakh/crore grouping. Never thousands grouping. Never decimals.
  function groupIN(nStr) {
    var s = String(nStr);
    if (s.length <= 3) return s;
    var last3 = s.slice(-3), rest = s.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  function inr(paise, opts) {
    opts = opts || {};
    if (paise === null || paise === undefined) return "—";
    var neg = paise < 0, r = Math.round(Math.abs(paise) / 100);
    var out = "₹" + groupIN(r);
    if (opts.compact && r >= 100000) {
      out = r >= 10000000 ? "₹" + (r / 10000000).toFixed(r % 10000000 === 0 ? 0 : 2) + "Cr"
                          : "₹" + (r / 100000).toFixed(r % 100000 === 0 ? 0 : 2) + "L";
    }
    return (neg ? "−" : "") + out; // U+2212 minus, not a hyphen
  }
  function paiseOf(paise) { return String(Math.abs(paise)); } // ungrouped, for the audit parenthetical
  var ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve",
    "Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  var TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function two(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""); }
  function three(n) { return (n > 99 ? ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "") : "") + (n % 100 ? two(n % 100) : ""); }
  function inrWords(paise) {
    var n = Math.round(Math.abs(paise) / 100);
    if (!n) return "Rupees Zero Only";
    var parts = [], units = [[10000000, "Crore"], [100000, "Lakh"], [1000, "Thousand"]];
    units.forEach(function (u) {
      if (n >= u[0]) { parts.push(two(Math.floor(n / u[0])) + " " + u[1]); n %= u[0]; }
    });
    if (n) parts.push(three(n));
    return "Rupees " + parts.join(" ") + " Only";
  }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  var L = function (n) { return n * 100000 * 100; }; // lakh → paise
  var K = function (n) { return n * 1000 * 100; };   // thousand → paise
  var R = function (n) { return n * 100; };          // rupees → paise

  /* ============================================================== DEALS === */
  // Stage machine: 1 Deal · 2 Followup · 3 Slot Booked · 4 Won · 5 Lost
  /* Five stages, each named by the event that causes it. `hint` is what the
     stage MEANS — the stage-change modal shows it, so nobody has to guess
     whether "Slot Booked" is a promise or a payment. */
  /* Six stages. Installment sits between Slot Booked and Won because that is
     where the money actually spends its time: the slot amount arrives, then the
     plan is paid down over several transfers, and only when the last one lands
     is the deal Won. Before it existed a deal jumped from "paid a token" to
     "Won" on the first installment — which called a deal finished while most of
     its value was still outstanding, and left the remaining collection sitting
     under a green label that said there was nothing to collect. */
  var STAGES = {
    1: { key: "new",         label: "New",         tone: "",     hint: "Fresh lead" },
    2: { key: "followup",    label: "Followup",    tone: "warn", hint: "Interested conversation" },
    3: { key: "slot",        label: "Slot Booked", tone: "info", hint: "Paid slot registration amount" },
    4: { key: "installment", label: "Installment", tone: "info", hint: "Paying the plan down" },
    5: { key: "won",         label: "Won",         tone: "ok",   hint: "Paid in full" },
    6: { key: "lost",        label: "Lost",        tone: "dead", hint: "Denied" }
  };
  var PRIORITY = { 1: "Normal", 2: "High", 3: "Urgent" };

  /* `business` and `email` are optional on purpose — a walk-in customer often
     has neither yet, and blanks here keep the "—" rendering path honest. */
  var deals = [
    /* ---------------------------------------------------------- 1 · Deal --- */
    { ref:"DL-2501", who:"Kavya Reddy", business:"Reddy Interio", email:"kavya@reddyinterio.in",
      phone:"+91 90322 19614", city:"Hyderabad", state:"Telangana", interestedIn:"AutoGrowth · Growth",
      stage:1, priority:1, value:null, owner:"K. Iyer",
      created:"2026-06-27", stageSince:"2026-06-27", expectedClose:null,
      nextAction:{ date:"2026-06-29", note:"First contact" },
      enquiry:"ENQ-7901", stalled:false, duplicates:0 },

    { ref:"DL-2502", who:"Aman Gupta", business:"", email:"aman.gupta91@gmail.com",
      phone:"+91 98464 49366", city:"Lucknow", state:"Uttar Pradesh", interestedIn:"AutoGrowth · Starter",
      stage:1, priority:2, value:null, owner:"A. Rao",
      created:"2026-06-26", stageSince:"2026-06-26", expectedClose:null,
      nextAction:{ date:"2026-06-28", note:"First contact" },
      enquiry:"ENQ-7898", stalled:false, duplicates:1 },

    { ref:"DL-2503", who:"Farhan Sheikh", business:"Sheikh Lights", email:"farhan@sheikhlights.in",
      phone:"+91 89358 88930", city:"Indore", state:"Madhya Pradesh", interestedIn:"Signature Trial",
      stage:1, priority:1, value:null, owner:"R. Menon",
      created:"2026-06-25", stageSince:"2026-06-25", expectedClose:null,
      nextAction:{ date:"2026-06-30", note:"First contact" },
      enquiry:"ENQ-7894", stalled:false, duplicates:0 },

    /* ------------------------------------------------------ 2 · Followup --- */
    { ref:"DL-2504", who:"Ritu Malhotra", business:"Malhotra Design Co", email:"ritu@malhotradesign.co.in",
      phone:"+91 99200 60121", city:"Gurugram", state:"Haryana", interestedIn:"AutoGrowth · Scale",
      stage:2, priority:3, value:R(540000), owner:"R. Menon",
      created:"2026-06-08", stageSince:"2026-06-19", expectedClose:"2026-07-12",
      nextAction:{ date:"2026-06-29", note:"Quote sent — chase the decision" },
      enquiry:"ENQ-7852", discount:6, stalled:false, duplicates:0 },

    { ref:"DL-2505", who:"Vikas Jain", business:"Jain Ceilings", email:"vikas@jainceilings.in",
      phone:"+91 97232 55348", city:"Surat", state:"Gujarat", interestedIn:"Signature Trial",
      stage:2, priority:2, value:R(215000), owner:"A. Rao",
      created:"2026-06-11", stageSince:"2026-06-21", expectedClose:"2026-07-08",
      nextAction:{ date:"2026-06-26", note:"Trial explained — awaiting confirmation" },
      enquiry:"ENQ-7861", stalled:false, duplicates:0 },

    { ref:"DL-2506", who:"Sneha Pillai", business:"", email:"sneha.pillai@gmail.com",
      phone:"+91 94618 93805", city:"Kochi", state:"Kerala", interestedIn:"AutoGrowth · Starter",
      stage:2, priority:1, value:null, owner:"R. Menon",
      created:"2026-06-14", stageSince:"2026-06-17", expectedClose:"2026-07-20",
      nextAction:{ date:"2026-07-02", note:"Site measurement booked" },
      enquiry:"ENQ-7869", stalled:false, duplicates:0 },

    { ref:"DL-2507", who:"Gaurav Bhatt", business:"Bhatt Visual Studio", email:"gaurav@bhattvisual.in",
      phone:"+91 96340 51773", city:"Dehradun", state:"Uttarakhand", interestedIn:"Signature Trial",
      stage:2, priority:1, value:null, owner:"K. Iyer",
      created:"2026-05-26", stageSince:"2026-06-03", expectedClose:"2026-07-18",
      nextAction:{ date:"2026-06-21", note:"No response to three calls" },
      enquiry:"ENQ-7823", stalled:true, duplicates:0 },

    /* --------------------------------------------------- 3 · Slot Booked --- */
    /* Every deal here has a registration payment against it — that is what the
       stage means, so the seed has to be able to prove it.                     */
    { ref:"DL-2508", who:"Ananya Ghosh", business:"Lumen Studio", email:"ananya@lumen.co.in",
      phone:"+91 90722 43764", city:"Bengaluru", state:"Karnataka", interestedIn:"AutoGrowth · Growth",
      stage:3, priority:2, value:R(360000), owner:"A. Rao",
      created:"2026-05-30", stageSince:"2026-06-22", expectedClose:"2026-07-10",
      nextAction:{ date:"2026-07-01", note:"Installment 1 due" },
      enquiry:"ENQ-7836", stalled:false, duplicates:0 },

    { ref:"DL-2509", who:"Imran Qureshi", business:"CeilingPro", email:"imran@ceilingpro.in",
      phone:"+91 97290 43855", city:"Hyderabad", state:"Telangana", interestedIn:"AutoGrowth · Growth",
      stage:4, priority:3, value:R(480000), owner:"R. Menon", coOwner:"A. Rao", split:"60 / 40",
      created:"2026-05-12", stageSince:"2026-06-14", expectedClose:"2026-06-30",
      nextAction:{ date:"2026-06-24", note:"Installment 1 overdue — escalate to Head" },
      enquiry:"ENQ-7801", discount:8, stalled:false, duplicates:2 },

    { ref:"DL-2510", who:"Meera Raghavan", business:"", email:"meera.r@gmail.com",
      phone:"+91 99093 41307", city:"Pune", state:"Maharashtra", interestedIn:"AutoGrowth · Scale",
      stage:4, priority:1, value:R(620000), owner:"R. Menon",
      created:"2026-05-21", stageSince:"2026-06-25", expectedClose:"2026-07-15",
      nextAction:{ date:"2026-07-04", note:"Installment 1 scheduled" },
      enquiry:"ENQ-7818", discount:4, stalled:false, duplicates:0 },

    /* ----------------------------------------------------------- 4 · Won --- */
    /* Won means the first installment cleared — not that the deal is fully
       collected. Two of these three still carry a balance, which is the whole
       point of the model and the reason Won no longer locks a deal.            */
    { ref:"DL-2511", who:"Sandeep Kulkarni", business:"KitchenCraft", email:"sandeep.k@kitchencraft.in",
      phone:"+91 98279 95442", city:"Mumbai", state:"Maharashtra", interestedIn:"AutoGrowth · Growth",
      stage:4, priority:2, value:L(8.85), owner:"R. Menon", coOwner:"K. Iyer", split:"70 / 30",
      created:"2026-04-28", stageSince:"2026-06-24", expectedClose:"2026-06-30",
      nextAction:{ date:"2026-07-06", note:"Installment 2 due" },
      enquiry:"ENQ-7731", discount:10, stalled:false, duplicates:1 },

    { ref:"DL-2512", who:"Arjun Desai", business:"Wardrobe Works", email:"arjun@wardrobeworks.com",
      phone:"+91 98090 51118", city:"Bengaluru", state:"Karnataka", interestedIn:"AutoGrowth · Starter",
      stage:5, priority:1, value:R(177000), owner:"K. Iyer",
      created:"2026-04-22", stageSince:"2026-05-14", expectedClose:"2026-05-15",
      nextAction:null, enquiry:"ENQ-7602", discount:5, stalled:false, duplicates:0 },

    { ref:"DL-2513", who:"Priya Sharma", business:"Sharma Decor", email:"priya@sharmadecor.in",
      phone:"+91 93943 78057", city:"Jaipur", state:"Rajasthan", interestedIn:"Signature Trial",
      stage:4, priority:1, value:R(240000), owner:"A. Rao",
      created:"2026-05-06", stageSince:"2026-06-18", expectedClose:"2026-07-05",
      nextAction:{ date:"2026-07-09", note:"Installment 2 due" },
      enquiry:"ENQ-7776", stalled:false, duplicates:0 },

    /* ---------------------------------------------------------- 5 · Lost --- */
    { ref:"DL-2514", who:"Deepa Nair", business:"Casa Nair", email:"deepa@casanair.com",
      phone:"+91 95047 67747", city:"Kochi", state:"Kerala", interestedIn:"AutoGrowth · Starter",
      stage:6, priority:1, value:R(96000), owner:"A. Rao",
      created:"2026-04-30", stageSince:"2026-06-02", expectedClose:null,
      nextAction:null, enquiry:"ENQ-7654", stalled:false, duplicates:0,
      lostReason:"Chose a local vendor on price" }
  ];

  /* ========================================================== QUOTATIONS === */
  /* The plan on an ACCEPTED quotation is what decides the Premium / Generic
     tags — term_months >= 12 is Premium, a Signature trial is Generic. */
  var quotations = [
    { ref:"IB-QT-2026-00211", deal:"DL-2511", v:2, status:"accepted", value:L(8.85),
      plan:"AutoGrowth · Growth", term:24, rate:R(30000), discount:10,
      issued:"2026-06-16", accepted:"2026-06-18", validTo:"2026-07-01", owner:"R. Menon",
      supersedes:"IB-QT-2026-00210" },
    { ref:"IB-QT-2026-00210", deal:"DL-2511", v:1, status:"superseded", value:L(9.2),
      plan:"AutoGrowth · Growth", term:24, rate:R(32000), discount:4,
      issued:"2026-06-08", validTo:"2026-06-23", owner:"R. Menon",
      supersededBy:"IB-QT-2026-00211" },
    { ref:"IB-QT-2026-00205", deal:"DL-2512", v:1, status:"accepted", value:R(177000),
      plan:"AutoGrowth · Starter", term:12, rate:R(15500), discount:5,
      issued:"2026-05-06", accepted:"2026-05-09", validTo:"2026-05-21", owner:"K. Iyer" },
    { ref:"IB-QT-2026-00208", deal:"DL-2513", v:1, status:"accepted", value:R(240000),
      plan:"Signature Trial", term:6, rate:R(40000), discount:0,
      issued:"2026-06-10", accepted:"2026-06-13", validTo:"2026-06-25", owner:"A. Rao" },
    { ref:"IB-QT-2026-00212", deal:"DL-2509", v:1, status:"accepted", value:R(480000),
      plan:"AutoGrowth · Growth", term:24, rate:R(20000), discount:8,
      issued:"2026-06-06", accepted:"2026-06-10", validTo:"2026-06-21", owner:"R. Menon" },
    { ref:"IB-QT-2026-00214", deal:"DL-2510", v:1, status:"accepted", value:R(620000),
      plan:"AutoGrowth · Scale", term:24, rate:R(25800), discount:4,
      issued:"2026-06-18", accepted:"2026-06-22", validTo:"2026-07-02", owner:"R. Menon" },
    { ref:"IB-QT-2026-00215", deal:"DL-2508", v:1, status:"accepted", value:R(360000),
      plan:"AutoGrowth · Growth", term:12, rate:R(30000), discount:0,
      issued:"2026-06-16", accepted:"2026-06-20", validTo:"2026-07-01", owner:"A. Rao" },
    { ref:"IB-QT-2026-00216", deal:"DL-2504", v:1, status:"issued", value:R(540000),
      plan:"AutoGrowth · Scale", term:12, rate:R(45000), discount:6,
      issued:"2026-06-19", validTo:"2026-07-03", owner:"R. Menon" },
    { ref:"IB-QT-2026-00217", deal:"DL-2505", v:1, status:"issued", value:R(215000),
      plan:"Signature Trial", term:3, rate:R(71600), discount:0,
      issued:"2026-06-21", validTo:"2026-07-05", owner:"A. Rao" },
    { ref:"IB-QT-2026-00218", deal:"DL-2506", v:1, status:"draft", value:R(288000),
      plan:"AutoGrowth · Starter", term:12, rate:R(24000), discount:0,
      issued:null, validTo:"2026-07-20", owner:"R. Menon" },
    { ref:"IB-QT-2026-00219", deal:"DL-2507", v:1, status:"draft", value:R(150000),
      plan:"Signature Trial", term:3, rate:R(50000), discount:0,
      issued:null, validTo:"2026-07-18", owner:"K. Iyer", createdAt:"2026-06-15" },
    { ref:"IB-QT-2026-00204", deal:"DL-2514", v:1, status:"rejected", value:R(96000),
      plan:"AutoGrowth · Starter", term:6, rate:R(16000), discount:0,
      issued:"2026-05-20", validTo:"2026-06-03", owner:"A. Rao",
      rejectedReason:"Chose a local vendor on price" }
  ];

  /* ============================================================ INVOICES === */
  // Two independent axes (INVOICE_IA §3.3):
  //   doc     : draft · issued · cancelled
  //   payment : unpaid · overdue · paid
  // `remark` names what the money IS — it is what moves the deal's stage:
  //   "Slot booking" → Slot Booked · "Installment 1" → Won.
  var invoices = [
    { ref:"IB-INV-2026-00121", deal:"DL-2512", quote:"IB-QT-2026-00205", doc:"issued", pay:"paid",
      amount:R(177000), received:R(177000), billing:"Installment 1", remark:"Installment 1",
      date:"2026-05-09", due:"2026-05-16", owner:"K. Iyer", payment:"PAY-4501" },

    { ref:"IB-INV-2026-00122", deal:"DL-2511", quote:"IB-QT-2026-00211", doc:"cancelled", pay:"unpaid",
      amount:R(59000), received:0, billing:"Slot booking", remark:"Slot booking",
      date:"2026-06-16", due:"2026-06-23", owner:"R. Menon",
      cancelledReason:"Payment reversed — PAY-4503", cancelledBy:"System", cancelledAt:"2026-06-28" },
    { ref:"IB-INV-2026-00123", deal:"DL-2511", quote:"IB-QT-2026-00211", doc:"issued", pay:"paid",
      amount:R(25000), received:R(25000), billing:"Slot booking", remark:"Slot booking",
      date:"2026-06-19", due:"2026-06-26", owner:"R. Menon", payment:"PAY-4504", proofs:2 },
    { ref:"IB-INV-2026-00124", deal:"DL-2511", quote:"IB-QT-2026-00211", doc:"issued", pay:"paid",
      amount:R(225000), received:R(225000), billing:"Installment 1", remark:"Installment 1",
      date:"2026-06-24", due:"2026-07-01", owner:"R. Menon", payment:"PAY-4505", proofs:1 },
    // Never issued: an invoice is raised only once the client has already
    // paid, so an "unpaid" one is a draft, not an issued document sitting
    // around waiting for money.
    { ref:"IB-INV-2026-00125", deal:"DL-2511", quote:"IB-QT-2026-00211", doc:"draft", pay:"unpaid",
      amount:R(310000), received:0, billing:"Installment 2", remark:"Installment 2",
      date:"2026-06-27", due:"2026-07-06", owner:"R. Menon" },

    { ref:"IB-INV-2026-00126", deal:"DL-2508", quote:"IB-QT-2026-00215", doc:"issued", pay:"paid",
      amount:R(25000), received:R(25000), billing:"Slot booking", remark:"Slot booking",
      date:"2026-06-22", due:"2026-06-29", owner:"A. Rao", payment:"PAY-4506" },
    { ref:"IB-INV-2026-00127", deal:"DL-2508", quote:"IB-QT-2026-00215", doc:"draft", pay:"unpaid",
      amount:R(112000), received:0, billing:"Installment 1", remark:"Installment 1",
      date:"2026-06-26", due:"2026-07-03", owner:"A. Rao" },

    { ref:"IB-INV-2026-00128", deal:"DL-2509", quote:"IB-QT-2026-00212", doc:"issued", pay:"paid",
      amount:R(30000), received:R(30000), billing:"Slot booking", remark:"Slot booking",
      date:"2026-06-14", due:"2026-06-21", owner:"R. Menon", payment:"PAY-4507" },
    { ref:"IB-INV-2026-00129", deal:"DL-2509", quote:"IB-QT-2026-00212", doc:"draft", pay:"unpaid",
      amount:R(150000), received:0, billing:"Installment 1", remark:"Installment 1",
      date:"2026-06-15", due:"2026-06-22", owner:"R. Menon" },

    { ref:"IB-INV-2026-00130", deal:"DL-2510", quote:"IB-QT-2026-00214", doc:"issued", pay:"paid",
      amount:R(25000), received:R(25000), billing:"Slot booking", remark:"Slot booking",
      date:"2026-06-25", due:"2026-07-02", owner:"R. Menon", payment:"PAY-4508" },

    { ref:"IB-INV-2026-00131", deal:"DL-2513", quote:"IB-QT-2026-00208", doc:"issued", pay:"paid",
      amount:R(25000), received:R(25000), billing:"Slot booking", remark:"Slot booking",
      date:"2026-06-14", due:"2026-06-21", owner:"A. Rao", payment:"PAY-4509" },
    { ref:"IB-INV-2026-00132", deal:"DL-2513", quote:"IB-QT-2026-00208", doc:"issued", pay:"paid",
      amount:R(65000), received:R(65000), billing:"Installment 1", remark:"Installment 1",
      date:"2026-06-18", due:"2026-06-25", owner:"A. Rao", payment:"PAY-4510" },

    { ref:"IB-INV-2026-00133", deal:"DL-2504", quote:"IB-QT-2026-00216", doc:"draft", pay:"unpaid",
      amount:R(25000), received:0, billing:"Slot booking", remark:"Slot booking",
      date:"2026-06-27", due:"2026-07-04", owner:"R. Menon" }
  ];

  /* ============================================================ PAYMENTS === */
  // states: verified · submitted · unmatched · reversed · rejected · refunded
  // Three doors, one ledger: A salesperson logs it · B business self-submits · C bank import
  var payments = [
    { ref:"PAY-4505", amount:R(225000), state:"verified", mode:"NEFT", utr:"NEFT0026JUN7741",
      invoice:"IB-INV-2026-00124", deal:"DL-2511", who:"Sandeep Kulkarni", path:"A",
      received:"2026-06-24", verifiedAt:"2026-06-25", by:"Finance", receipt:"IB-RCP-2026-00412" },
    { ref:"PAY-4504", amount:R(25000), state:"verified", mode:"UPI", utr:"UPI 424578220011",
      invoice:"IB-INV-2026-00123", deal:"DL-2511", who:"Sandeep Kulkarni", path:"A",
      received:"2026-06-19", verifiedAt:"2026-06-19", by:"Finance", receipt:"IB-RCP-2026-00408" },
    { ref:"PAY-4503", amount:R(59000), state:"reversed", mode:"UPI", utr:"UPI 424578120019",
      invoice:"IB-INV-2026-00122", deal:"DL-2511", who:"Sandeep Kulkarni", path:"A",
      received:"2026-06-18", reversedAt:"2026-06-28", by:"V. Shakya",
      reversedReason:"Customer double-paid; returned to remitter" },
    { ref:"PAY-4506", amount:R(25000), state:"verified", mode:"UPI", utr:"UPI 424578220046",
      invoice:"IB-INV-2026-00126", deal:"DL-2508", who:"Ananya Ghosh", path:"A",
      received:"2026-06-22", verifiedAt:"2026-06-23", by:"Finance", receipt:"IB-RCP-2026-00410" },
    { ref:"PAY-4507", amount:R(30000), state:"verified", mode:"NEFT", utr:"NEFT0026JUN5520",
      invoice:"IB-INV-2026-00128", deal:"DL-2509", who:"Imran Qureshi", path:"A",
      received:"2026-06-14", verifiedAt:"2026-06-15", by:"Finance", receipt:"IB-RCP-2026-00403" },
    { ref:"PAY-4508", amount:R(25000), state:"verified", mode:"UPI", utr:"UPI 424578220077",
      invoice:"IB-INV-2026-00130", deal:"DL-2510", who:"Meera Raghavan", path:"A",
      received:"2026-06-25", verifiedAt:"2026-06-26", by:"Finance", receipt:"IB-RCP-2026-00414" },
    { ref:"PAY-4509", amount:R(25000), state:"verified", mode:"UPI", utr:"UPI 424578220090",
      invoice:"IB-INV-2026-00131", deal:"DL-2513", who:"Priya Sharma", path:"A",
      received:"2026-06-14", verifiedAt:"2026-06-15", by:"Finance", receipt:"IB-RCP-2026-00404" },
    { ref:"PAY-4510", amount:R(65000), state:"verified", mode:"NEFT", utr:"NEFT0026JUN6612",
      invoice:"IB-INV-2026-00132", deal:"DL-2513", who:"Priya Sharma", path:"A",
      received:"2026-06-18", verifiedAt:"2026-06-19", by:"Finance", receipt:"IB-RCP-2026-00406" },
    { ref:"PAY-4501", amount:R(177000), state:"verified", mode:"NEFT", utr:"NEFT0026MAY8802",
      invoice:"IB-INV-2026-00121", deal:"DL-2512", who:"Arjun Desai", path:"A",
      received:"2026-05-12", verifiedAt:"2026-05-13", by:"Finance", receipt:"IB-RCP-2026-00398" },
    { ref:"PAY-4511", amount:R(112000), state:"submitted", mode:"IMPS", utr:"IMPS 618240055711",
      invoice:"IB-INV-2026-00127", deal:"DL-2508", who:"Ananya Ghosh", path:"B",
      received:"2026-06-27" },
    { ref:"PAY-4512", amount:R(94400), state:"unmatched", mode:"UPI", utr:"UPI 424578120033",
      invoice:null, deal:null, who:"S K ENTERPRISES", path:"C", received:"2026-06-24" },
    { ref:"PAY-4502", amount:R(35400), state:"refund", mode:"NEFT", utr:"NEFT0026JUN2210",
      invoice:"IB-INV-2026-00120", deal:"DL-2514", who:"Deepa Nair", path:"A",
      received:"2026-06-02", refundReason:"Duplicate charge — service never activated" }
  ];

  /* ======================================================== TRANSACTIONS === */
  // Money OUT — company spend, not seller payouts. Category is mandatory.
  var categories = [
    { key:"sal",  label:"Salary & payroll",   budget:K(800), spent:K(800), roll:"Fixed" },
    { key:"exp",  label:"Company expense",    budget:K(420), spent:K(370), roll:"Fixed" },
    { key:"ads",  label:"Ads budget",         budget:K(300), spent:K(250), roll:"Reinvestment" },
    { key:"ven",  label:"Vendor & contractor",budget:K(180), spent:K(96),  roll:"Variable" },
    { key:"tax",  label:"Tax & statutory",    budget:K(250), spent:K(241), roll:"Excluded" },
    { key:"bank", label:"Bank & fees",        budget:K(20),  spent:K(7),   roll:"Excluded" }
  ];
  var txns = [
    { ref:"TXN-0912", dir:"out", amount:K(800), cat:"sal",  label:"June payroll — 7 staff",
      mode:"NEFT", utr:"SAL-JUN-2026", date:"2026-06-28", bill:true,  matched:true },
    { ref:"TXN-0911", dir:"out", amount:K(250), cat:"ads",  label:"Meta + Google, June",
      mode:"Card", utr:"CARD-8841", date:"2026-06-26", bill:true,  matched:true },
    { ref:"TXN-0910", dir:"out", amount:K(180), cat:"exp",  label:"Office rent — Q2",
      mode:"NEFT", utr:"RENT-Q2-26", date:"2026-06-25", bill:true,  matched:true },
    { ref:"TXN-0909", dir:"out", amount:K(96),  cat:"ven",  label:"Photography — 4 shoots",
      mode:"UPI",  utr:"UPI 4471120", date:"2026-06-22", bill:false, matched:true },
    { ref:"TXN-0908", dir:"out", amount:K(241), cat:"tax",  label:"GST — May filing",
      mode:"NEFT", utr:"GST-MAY-26",  date:"2026-06-20", bill:true,  matched:true },
    { ref:"TXN-0907", dir:"out", amount:K(120), cat:"exp",  label:"AWS + tooling",
      mode:"Card", utr:"CARD-8802",   date:"2026-06-18", bill:true,  matched:true },
    { ref:"TXN-0906", dir:"out", amount:K(70),  cat:"exp",  label:"Travel — Mumbai, Pune",
      mode:"Card", utr:"CARD-8790",   date:"2026-06-14", bill:false, matched:true },
    { ref:"TXN-0905", dir:"out", amount:K(7),   cat:"bank", label:"Bank charges, June",
      mode:"Auto", utr:"BNK-JUN-26",  date:"2026-06-12", bill:true,  matched:false }
  ];

  /* ========================================================= CLIENT DEALS === */
  // Chain B. A DIFFERENT record from a Deal. No money field, by design.
  // States: generated · qualified · ready · assigned · delivered · acknowledged
  //         converted · notconverted · invalid
  var clientDeals = [
    { ref:"IB-CD-2026-0047", buyer:"Priya M.", phone:"+91 98279 95442", category:"Interior Design",
      region:"Vasant Kunj, South Delhi", tier:"B", urgency:"within 30d", hot:true,
      state:"ready", business:null, age:"3h", sla:null,
      requirement:"3BHK full interior — kitchen, wardrobes, false ceiling. Possession in 6 weeks.",
      source:"funnel/interior-design-delhi", qualifiedAt:"2026-06-28", ruleVersion:"v3" },
    { ref:"IB-CD-2026-0046", buyer:"Rakesh T.", phone:"+91 99183 58718", category:"Modular Kitchen",
      region:"Baner, Pune", tier:"A", urgency:"within 15d", hot:true,
      state:"ready", business:null, age:"7h", sla:null,
      requirement:"L-shaped modular kitchen, 120 sq ft, mid-range finish.",
      source:"funnel/modular-kitchen-pune", qualifiedAt:"2026-06-28", ruleVersion:"v3" },
    { ref:"IB-CD-2026-0044", buyer:"Sneha K.", phone:"+91 97358 08163", category:"False Ceiling",
      region:"Whitefield, Bengaluru", tier:"B", urgency:"within 30d", hot:false,
      state:"delivered", business:"Loft & Co", age:"2d", sla:"breached",
      slaDetail:"delivered 26h ago, not acknowledged",
      requirement:"POP false ceiling, 3 rooms + living.",
      source:"funnel/false-ceiling-bengaluru", qualifiedAt:"2026-06-26", ruleVersion:"v3" },
    { ref:"IB-CD-2026-0043", buyer:"Mohit S.", phone:"+91 96481 27090", category:"Interior Design",
      region:"Jubilee Hills, Hyderabad", tier:"A", urgency:"within 60d", hot:false,
      state:"acknowledged", business:"Studio Aangan", age:"3d", sla:null,
      requirement:"Villa interior, 4200 sq ft. Design-only engagement.",
      source:"funnel/interior-design-hyderabad", qualifiedAt:"2026-06-25", ruleVersion:"v3" },
    { ref:"IB-CD-2026-0042", buyer:"Farah A.", phone:"+91 94800 51227", category:"Wardrobes",
      region:"Andheri West, Mumbai", tier:"C", urgency:"within 30d", hot:false,
      state:"delivered", business:"Nook & Co", age:"4d", sla:null,
      requirement:"Two sliding wardrobes, laminate finish.",
      source:"funnel/wardrobes-mumbai", qualifiedAt:"2026-06-24", ruleVersion:"v3" },
    { ref:"IB-CD-2026-0039", buyer:"Kabir J.", phone:"+91 93583 18411", category:"Painting",
      region:"Salt Lake, Kolkata", tier:"B", urgency:"within 15d", hot:false,
      state:"converted", business:"Ambient Works", age:"9d", sla:null,
      requirement:"2BHK repaint, premium emulsion.",
      source:"funnel/painting-kolkata", qualifiedAt:"2026-06-19", ruleVersion:"v3",
      outcome:"Converted — reported by the business on 27 Jun" },
    { ref:"IB-CD-2026-0037", buyer:"—", phone:"—", category:"—",
      region:"—", tier:"—", urgency:"—", hot:false,
      state:"invalid", business:null, age:"12d", sla:null,
      requirement:"—", invalidReason:"duplicate_submission — same phone within the dedup window",
      source:"funnel/interior-design-delhi", qualifiedAt:"2026-06-16", ruleVersion:"v3" }
  ];

  var suggestions = [
    { biz:"Studio Aangan", rank:1, score:91, band:"Best match", active:4, cap:12,
      why:"Full <em>Interior Design</em> match · serves <em>South Delhi</em> · <em>4 of 12</em> slots open",
      factors:{ cat:30, loc:25, seg:12, kw:8, cap:10, fair:3, qual:3 } },
    { biz:"Kaarigar Interiors", rank:2, score:78, band:"Strong", active:9, cap:12,
      why:"Full category match · serves <em>Delhi NCR</em> · <em>3 of 12</em> slots open",
      factors:{ cat:30, loc:20, seg:11, kw:6, cap:5, fair:3, qual:3 } },
    { biz:"Verve Design Studio", rank:3, score:64, band:"Eligible", active:11, cap:12,
      why:"Category match · <em>adjacent</em> service area · <em>1 of 12</em> slots open",
      factors:{ cat:30, loc:12, seg:8, kw:5, cap:2, fair:4, qual:3 } },
    { biz:"Habitat Collective", rank:4, score:58, band:"Eligible", active:6, cap:10,
      why:"Category match · serves <em>South Delhi</em> · lower recent responsiveness",
      factors:{ cat:30, loc:25, seg:0, kw:0, cap:2, fair:1, qual:0 } }
  ];
  var exclusions = [
    { biz:"Urban Loom Studio", reason:"Subscription expired 14 Mar 2026", stage:"Subscription" },
    { biz:"Metro Interio", reason:"Does not serve South Delhi", stage:"Location" },
    { biz:"Casa Bella", reason:"At capacity — 12 of 12 active client deals", stage:"Capacity" },
    { biz:"Prism Interiors", reason:"Category not offered — Modular Kitchen only", stage:"Category" },
    { biz:"The Wood Room", reason:"Profile incomplete — no service area declared", stage:"Profile" }
  ];
  var weights = [
    ["Category / service match", 30, "cat"], ["Location / serviceability", 25, "loc"],
    ["Project / segment fit", 15, "seg"], ["Service keywords", 10, "kw"],
    ["Capacity / availability", 10, "cap"], ["Assignment fairness", 5, "fair"],
    ["Responsiveness / quality", 5, "qual"]
  ];

  /* =============================================================== USERS === */
  // Marketplace end users. NOT staff — staff live in ib_team_users.
  // classification is DERIVED from membership, never stored.
  var PLANS = { starter:"Starter", growth:"Growth", pro:"Pro" };
  var users = [
    { id:"U-10241", name:"Sandeep Kulkarni", email:"sandeep.k@kitchencraft.in", phone:"+91 98279 95442",
      city:"Mumbai", joined:"2026-05-18", membership:"active", plan:"growth", term:"Term 2",
      renews:"2027-06-21", entitlement:"Growth v3", deal:"DL-2511", invoice:"IB-INV-2026-00123", profile:100 },
    { id:"U-10238", name:"Arjun Desai", email:"arjun@wardrobeworks.com", phone:"+91 98090 51118",
      city:"Bengaluru", joined:"2026-04-22", membership:"active", plan:"starter", term:"Term 1",
      renews:"2027-05-09", entitlement:"Starter v2", deal:"DL-2512", invoice:"IB-INV-2026-00121", profile:100 },
    { id:"U-10250", name:"Imran Qureshi", email:"imran@ceilingpro.in", phone:"+91 97290 43855",
      city:"Hyderabad", joined:"2026-06-09", membership:"pending", plan:"growth", term:"Term 1",
      renews:null, entitlement:"Growth v3", deal:"DL-2509", invoice:"IB-INV-2026-00129", profile:80 },
    { id:"U-10252", name:"Ananya Ghosh", email:"ananya@lumen.co.in", phone:"+91 90722 43764",
      city:"Bhubaneswar", joined:"2026-06-22", membership:"pending", plan:"starter", term:"Term 1",
      renews:null, entitlement:"Starter v2", deal:"DL-2508", invoice:"IB-INV-2026-00127", profile:65 },
    { id:"U-10199", name:"Rhea Kapoor", email:"rhea@rkinteriors.in", phone:"+91 98976 63003",
      city:"New Delhi", joined:"2026-03-11", membership:"active", plan:"growth", term:"Term 1",
      renews:"2026-07-12", entitlement:"Growth v2", deal:"DL-2513", invoice:"IB-INV-2026-00120", profile:100 },
    { id:"U-10188", name:"Deepa Nair", email:"deepa@casanair.com", phone:"+91 95047 67747",
      city:"Kochi", joined:"2026-03-02", membership:"cancelled", plan:"starter", term:"Term 1",
      renews:null, entitlement:"Starter v2", deal:"DL-2514", profile:90 },
    { id:"U-10260", name:"Meera Raghavan", email:"meera.r@gmail.com", phone:"+91 99093 41307",
      city:"Pune", joined:"2026-06-14", membership:null, plan:null, term:null,
      renews:null, entitlement:null, deal:"DL-2510", profile:40 },
    { id:"U-10262", name:"Nikhil Bose", email:"nikhil.bose@outlook.com", phone:"+91 89734 19776",
      city:"Kolkata", joined:"2026-06-27", membership:null, plan:null, term:null,
      renews:null, entitlement:null, deal:"DL-2503", profile:25 },
    { id:"U-10215", name:"Farid Ahmed", email:"farid@studioaangan.in", phone:"+91 92079 79285",
      city:"New Delhi", joined:"2026-04-02", membership:"paused", plan:"pro", term:"Term 3",
      renews:"2026-08-30", entitlement:"Pro v1", profile:100 }
  ];

  function classify(u) {
    if (!u.membership) return { key:"normal", label:"Normal User", tone:"" };
    if (u.membership === "active") return { key:"active", label:"Active Member", tone:"ok" };
    if (u.membership === "pending") return { key:"pending", label:"Pending Activation", tone:"warn" };
    if (u.membership === "paused") return { key:"paused", label:"Paused", tone:"warn" };
    if (u.membership === "cancelled" || u.membership === "expired")
      return { key:"former", label:"Former Member", tone:"dead" };
    return { key:"normal", label:"Normal User", tone:"" };
  }

  /* ============================================================ BUSINESSES === */
  var businesses = [
    { name:"Studio Aangan", city:"New Delhi", cats:"Interior Design, Wardrobes", plan:"growth",
      status:"verified", active:4, cap:12, rating:4.8, since:"2025-11-02" },
    { name:"Kaarigar Interiors", city:"Gurugram", cats:"Interior Design", plan:"growth",
      status:"verified", active:9, cap:12, rating:4.5, since:"2025-09-14" },
    { name:"Loft & Co", city:"Bengaluru", cats:"False Ceiling, Painting", plan:"starter",
      status:"verified", active:6, cap:8, rating:4.3, since:"2026-01-20" },
    { name:"Nook & Co", city:"Mumbai", cats:"Wardrobes, Furniture", plan:"starter",
      status:"verified", active:3, cap:8, rating:4.6, since:"2026-02-08" },
    { name:"Ambient Works", city:"Kolkata", cats:"Painting", plan:"starter",
      status:"verified", active:2, cap:8, rating:4.4, since:"2026-03-30" },
    { name:"Verve Design Studio", city:"Noida", cats:"Interior Design, 3D", plan:"pro",
      status:"verified", active:11, cap:12, rating:4.7, since:"2025-07-11" },
    { name:"Urban Loom Studio", city:"New Delhi", cats:"Interior Design", plan:"starter",
      status:"expired", active:0, cap:8, rating:4.1, since:"2025-05-19" },
    { name:"The Wood Room", city:"Jaipur", cats:"Furniture", plan:"starter",
      status:"pending", active:0, cap:8, rating:null, since:"2026-06-24" }
  ];

  /* ================================================================ AUDIT === */
  var audit = [
    { at:"2026-06-28 14:22", type:"PAYMENT", tone:"bad", actor:"V. Shakya", role:"Super Admin", module:"Finance",
      text:"Reversed <b>PAY-4503</b> — " + inr(R(59000)) + ". Reason: customer double-paid, returned to remitter.",
      ref:"PAY-4503", route:"#/payments/PAY-4503" },
    { at:"2026-06-28 14:22", type:"INVOICE", tone:"warn", actor:"System", role:"System", module:"Invoice",
      text:"<b>IB-INV-2026-00122</b> auto-cancelled — reason: payment reversed. Number stays consumed.",
      ref:"IB-INV-2026-00122", route:"#/invoices/IB-INV-2026-00122" },
    { at:"2026-06-28 11:04", type:"CLIENT", tone:"bad", actor:"System", role:"System", module:"Client Deals",
      text:"<b>IB-CD-2026-0044</b> breached its 24h acknowledgement SLA — Loft & Co notified.",
      ref:"IB-CD-2026-0044", route:"#/client-deals/IB-CD-2026-0044" },
    { at:"2026-06-28 09:36", type:"CLIENT", tone:"info", actor:"System", role:"System", module:"Client Deals",
      text:"<b>IB-CD-2026-0047</b> qualified and matched — 4 eligible of 9 subscribed, rule v3.",
      ref:"IB-CD-2026-0047", route:"#/client-deals/IB-CD-2026-0047" },
    { at:"2026-06-27 16:48", type:"PAYMENT", tone:"", actor:"Imran Qureshi", role:"Business", module:"Finance",
      text:"Submitted <b>PAY-4511</b> — " + inr(R(118000)) + " against IB-INV-2026-00129. Awaiting verification.",
      ref:"PAY-4511", route:"#/payments/PAY-4511" },
    { at:"2026-06-25 13:04", type:"INVOICE", tone:"", actor:"R. Menon", role:"Sales Agent", module:"Invoice",
      text:"Raised <b>IB-INV-2026-00125</b> — " + inr(R(637200)) + " · 20 months · months 5–24 of 24.",
      ref:"IB-INV-2026-00125", route:"#/invoices/IB-INV-2026-00125" },
    { at:"2026-06-25 10:12", type:"PAYMENT", tone:"ok", actor:"Finance", role:"Finance", module:"Finance",
      text:"Verified <b>PAY-4505</b> — " + inr(R(247800)) + ". Receipt IB-RCP-2026-00311 issued.",
      ref:"PAY-4505", route:"#/payments/PAY-4505" },
    { at:"2026-06-24 16:02", type:"PAYMENT", tone:"", actor:"R. Menon", role:"Sales Agent", module:"Deals",
      text:"Logged <b>PAY-4505</b> on DL-2511 against IB-INV-2026-00123.",
      ref:"DL-2511", route:"#/deals/DL-2511" },
    { at:"2026-06-22 09:41", type:"INVOICE", tone:"", actor:"R. Menon", role:"Sales Agent", module:"Invoice",
      text:"Raised <b>IB-INV-2026-00123</b> — " + inr(R(247800)) + " · 4 months + setup.",
      ref:"IB-INV-2026-00123", route:"#/invoices/IB-INV-2026-00123" },
    { at:"2026-06-21 11:47", type:"QUOTE", tone:"ok", actor:"R. Menon", role:"Sales Agent", module:"Quotation",
      text:"<b>IB-QT-2026-00211</b> v2 marked Accepted — wrote " + inr(L(8.85)) + " to DL-2511 as the agreed value.",
      ref:"IB-QT-2026-00211", route:"#/quotations/IB-QT-2026-00211" },
    { at:"2026-06-20 15:19", type:"QUOTE", tone:"", actor:"R. Menon", role:"Sales Agent", module:"Quotation",
      text:"Issued <b>IB-QT-2026-00211</b> v2 — supersedes v1 (IB-QT-2026-00210).",
      ref:"IB-QT-2026-00211", route:"#/quotations/IB-QT-2026-00211" },
    { at:"2026-06-19 17:41", type:"ROLE", tone:"warn", actor:"V. Shakya", role:"Super Admin", module:"Team",
      text:"Assigned role <b>Sales Head</b> to K. Iyer. Effective immediately, resolved per request.",
      ref:"k.iyer@interiorbazzar.com", route:"#/team" },
    { at:"2026-06-18 12:30", type:"DEAL", tone:"", actor:"System", role:"System", module:"Deals",
      text:"<b>DL-2501</b> created from funnel intake and assigned to K. Iyer by round-robin.",
      ref:"DL-2501", route:"#/deals/DL-2501" },
    { at:"2026-06-16 08:00", type:"RECON", tone:"warn", actor:"System", role:"System", module:"Finance",
      text:"HDFC ••••4021 statement imported — 24–27 Jun. <b>1 credit</b> could not be matched.",
      ref:"HDFC ••••4021", route:"#/reconciliation" }
  ];

  /* ============================================== TEAM (live, shared store) === */
  // Deliberately the SAME localStorage keys admin-auth.html uses. Registering on
  // the sign-in page makes the person appear in Settings → Team, awaiting a role.
  var TEAM_KEY = "ib_team_users", SESSION_KEY = "ib_team_session",
      REQUESTS_KEY = "ib_team_reset_requests", SCHEMA_V = 1;

  var ROLE_LABEL = {
    super_admin:"Super Admin", ops_manager:"Ops Manager", finance:"Finance",
    sales_agent:"Sales Agent", sales_head:"Sales Head", content:"Content",
    catalog_mod:"Catalog Mod", analyst:"Analyst"
  };
  // Illustrative only. The real grid is derived from the final module inventory
  // when the Team module ships — see ADMIN_PANEL_OPERATION.md §9.
  var ROLE_GRANTS = {
    super_admin:["Everything"],
    ops_manager:["Overview","Businesses","Client Deals","Subscriptions"],
    finance:["Payments","Refunds","Reconciliation","Revenue"],
    sales_agent:["Deals (own)","Quotations (own)","Invoices (own)"],
    sales_head:["Deals (all)","Quotations (all)","Invoices (all)","Sales Analytics","Roles (view)"],
    content:["Marketing","Content"],
    catalog_mod:["Businesses","Reviews & Reports"],
    analyst:["Read-only across most modules"]
  };

  function seedTeam() {
    // Anchored to the same fixed clock as the business data, so a seeded
    // member's "last login" never drifts ahead of the June 2026 dataset.
    // A genuinely NEW registration still stamps Date.now(), which is correct —
    // it happened now.
    var now = TODAY.getTime() + 9 * 3600000, day = 86400000;
    return [
      { id:"u1", name:"Vishal Shakya", email:"founder@interiorbazzar.com", phone:"+919810000001",
        password:"admin123", status:"active", role:"super_admin",
        registeredAt:now - day*180, lastLogin:now - 3600000, failedAttempts:0 },
      { id:"u2", name:"R. Menon", email:"r.menon@interiorbazzar.com", phone:"+919810000002",
        password:"sales123", status:"active", role:"sales_agent",
        registeredAt:now - day*40, lastLogin:now - 7200000, failedAttempts:0 },
      { id:"u3", name:"Priya Nair", email:"priya.nair@interiorbazzar.com", phone:"+919810000003",
        password:"priya1234", status:"pending", role:null,
        registeredAt:now - day*2, lastLogin:null, failedAttempts:0 },
      { id:"u4", name:"K. Iyer", email:"k.iyer@interiorbazzar.com", phone:"+919810000004",
        password:"kiyer1234", status:"suspended", role:"content",
        registeredAt:now - day*70, lastLogin:now - day*6, failedAttempts:0 },
      { id:"u5", name:"A. Rao", email:"a.rao@interiorbazzar.com", phone:"+919810000005",
        password:"arao1234", status:"active", role:"ops_manager",
        registeredAt:now - day*95, lastLogin:now - day*1, failedAttempts:0 },
      { id:"u6", name:"Nandini Shah", email:"nandini@interiorbazzar.com", phone:"+919810000006",
        password:"nandini123", status:"pending", role:null,
        registeredAt:now - day*4, lastLogin:now - day*3, failedAttempts:0 },
      { id:"u7", name:"Devang Patel", email:"devang@interiorbazzar.com", phone:"+919810000007",
        password:"devang123", status:"pending", role:null,
        registeredAt:now - day*1, lastLogin:null, failedAttempts:0 },
      { id:"u8", name:"Sana Fernandes", email:"sana@interiorbazzar.com", phone:"+919810000008",
        password:"sana12345", status:"active", role:"finance",
        registeredAt:now - day*140, lastLogin:now - 18000000, failedAttempts:0 }
    ];
  }

  var TeamStore = {
    KEY:TEAM_KEY, SESSION_KEY:SESSION_KEY, REQUESTS_KEY:REQUESTS_KEY,
    ROLE_LABEL:ROLE_LABEL, ROLE_GRANTS:ROLE_GRANTS, MAX_ATTEMPTS:5,
    load: function () {
      try {
        var raw = JSON.parse(localStorage.getItem(TEAM_KEY));
        if (raw && raw._v === SCHEMA_V && Array.isArray(raw.users)) return raw.users;
      } catch (e) {}
      var s = seedTeam(); TeamStore.save(s); return s;
    },
    save: function (list) {
      try { localStorage.setItem(TEAM_KEY, JSON.stringify({ _v:SCHEMA_V, users:list })); } catch (e) {}
    },
    reset: function () { try { localStorage.removeItem(TEAM_KEY); } catch (e) {} return TeamStore.load(); },
    byEmail: function (list, email) {
      email = (email || "").trim().toLowerCase();
      for (var i = 0; i < list.length; i++) if (list[i].email.toLowerCase() === email) return list[i];
      return null;
    },
    byPhone: function (list, phone) {
      for (var i = 0; i < list.length; i++) if (list[i].phone === phone) return list[i];
      return null;
    },
    getSession: function () { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; } },
    setSession: function (id) { try { localStorage.setItem(SESSION_KEY, JSON.stringify({ userId:id, at:Date.now() })); } catch (e) {} },
    clearSession: function () { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} },
    // Resolve the signed-in user from the USER RECORD, never from the session
    // blob — status and role are re-read on every boot, never cached as truth.
    current: function () {
      var s = TeamStore.getSession(); if (!s) return null;
      var list = TeamStore.load();
      for (var i = 0; i < list.length; i++) if (list[i].id === s.userId) return list[i];
      return null;
    },
    loadRequests: function () {
      try { var r = JSON.parse(localStorage.getItem(REQUESTS_KEY)); if (Array.isArray(r)) return r; } catch (e) {}
      return [];
    },
    saveRequests: function (l) { try { localStorage.setItem(REQUESTS_KEY, JSON.stringify(l)); } catch (e) {} }
  };

  /* =========================================================== SELECTORS === */
  // Everything a view or the dashboard shows is computed here, from the rows
  // above. No module ever hardcodes a total.
  function dealsOf(ref) { for (var i=0;i<deals.length;i++) if (deals[i].ref===ref) return deals[i]; return null; }
  function quoteOf(ref) { for (var i=0;i<quotations.length;i++) if (quotations[i].ref===ref) return quotations[i]; return null; }
  function invoiceOf(ref) { for (var i=0;i<invoices.length;i++) if (invoices[i].ref===ref) return invoices[i]; return null; }
  function paymentOf(ref) { for (var i=0;i<payments.length;i++) if (payments[i].ref===ref) return payments[i]; return null; }
  function clientDealOf(ref){ for (var i=0;i<clientDeals.length;i++) if (clientDeals[i].ref===ref) return clientDeals[i]; return null; }
  function userOf(id) { for (var i=0;i<users.length;i++) if (users[i].id===id) return users[i]; return null; }

  function invoicesForDeal(ref) { return invoices.filter(function (i) { return i.deal === ref; }); }
  function quotesForDeal(ref)   { return quotations.filter(function (q) { return q.deal === ref; }); }
  function paymentsForDeal(ref) { return payments.filter(function (p) { return p.deal === ref; }); }
  function acceptedQuote(ref)   { return quotesForDeal(ref).filter(function (q) { return q.status === "accepted"; })[0] || null; }

  // A deal's money is DERIVED, never stored: collected is the sum of its valid
  // ledger rows; outstanding is value − collected. (DEALS_OPERATION §6)
  function dealMoney(dl) {
    var collected = paymentsForDeal(dl.ref).reduce(function (a, p) {
      return a + (p.state === "verified" ? p.amount : 0);
    }, 0);
    var value = dl.value || 0;
    return { value:value, collected:collected, outstanding:Math.max(0, value - collected),
             progress:pct(collected, value) };
  }

  // Chain state — the four scalars a Deal actually stores.
  function chainOf(ref) {
    var q = acceptedQuote(ref) || quotesForDeal(ref).sort(function (a, b) { return b.v - a.v; })[0] || null;
    var invs = invoicesForDeal(ref).filter(function (i) { return i.doc !== "cancelled"; });
    var pays = paymentsForDeal(ref).filter(function (p) { return p.state === "verified"; });
    return {
      quote:q, quoteStatus:q ? q.status : "none",
      invoices:invs, invoiceStatus:invs.length ? (invs.every(function(i){return i.pay==="paid";}) ? "paid" : "raised") : "none",
      payments:pays
    };
  }

  // An invoice is never issued unpaid — Issue requires proof and a reference,
  // and logs the payment in the same action — so this is not a routine queue
  // any more. It only ever catches the rare case where that ledger write
  // failed after Issue and nobody has logged the payment manually yet.
  function isOverdueInvoice(i) { return i.doc === "issued" && i.pay !== "paid" && overdueDays(i) > 0; }
  function overdueDays(i) { return Math.abs(days(d(i.due))); }

  var derive = {
    // ---- the money line on the dashboard -----------------------------------
    money: function () {
      var live = invoices.filter(function (i) { return i.doc === "issued"; });
      var invoiced = live.reduce(function (a, i) { return a + i.amount; }, 0);
      var received = live.reduce(function (a, i) { return a + i.received; }, 0);
      var overdue  = live.filter(isOverdueInvoice).reduce(function (a, i) { return a + (i.amount - i.received); }, 0);
      return { invoiced:invoiced, received:received, outstanding:invoiced - received, overdue:overdue,
               notYetDue:(invoiced - received) - overdue, collectedPct:pct(received, invoiced) };
    },
    // ---- every queue, in one place. A badge counts only what needs a human. --
    queues: function () {
      var team = TeamStore.load();
      var m = derive.money();
      var overdueInv = invoices.filter(isOverdueInvoice);
      var toVerify   = payments.filter(function (p) { return p.state === "submitted" || p.state === "unmatched"; });
      var refunds    = payments.filter(function (p) { return p.state === "refund"; });
      var expiring   = quotations.filter(function (q) {
                         return q.status === "issued" && days(d(q.validTo)) <= 3 && days(d(q.validTo)) >= 0; });
      var followup   = deals.filter(function (dl) {
                         return dl.stage < 4 && dl.nextAction && days(d(dl.nextAction.date)) < 0; });
      var cdReady    = clientDeals.filter(function (c) { return c.state === "ready"; });
      var cdBreach   = clientDeals.filter(function (c) { return c.sla === "breached"; });
      var pendingAct = users.filter(function (u) { return u.membership === "pending"; });
      var pendingRole= team.filter(function (u) { return !u.role || u.status === "pending"; });
      var reconVar   = R(23600);

      return [
        { key:"invoices",     route:"#/invoices?pay=overdue", icon:"invoice", tone:"bad",
          title:"Invoices overdue", n:overdueInv.length,
          why:inr(m.overdue) + " issued, unpaid and past due" },
        { key:"reconciliation", route:"#/reconciliation", icon:"recon", tone:"bad",
          title:"Reconciliation variance", n:1,
          why:inr(reconVar) + " — the June period cannot close" },
        { key:"refunds",      route:"#/refunds", icon:"refund", tone:"bad",
          title:"Refunds to approve", n:refunds.length,
          why:inr(refunds.reduce(function(a,p){return a+p.amount;},0)) + " awaiting four-eyes approval" },
        { key:"client-deals", route:"#/client-deals?state=ready", icon:"route", tone:"bad",
          title:"Client Deals to assign", n:cdReady.length,
          why:cdBreach.length + " has breached its 24h SLA" },
        { key:"payments",     route:"#/payments?state=open", icon:"cash", tone:"warn",
          title:"Payments to verify", n:toVerify.length,
          why:inr(toVerify.reduce(function(a,p){return a+p.amount;},0)) + " needs a decision" },
        { key:"quotations",   route:"#/quotations?status=expiring", icon:"quote", tone:"warn",
          title:"Quotations expiring", n:expiring.length,
          why:"within 3 days — revenue about to need re-work" },
        { key:"deals",        route:"#/deals?next=overdue", icon:"deal", tone:"warn",
          title:"Deals needing follow-up", n:followup.length,
          why:"next action overdue in your scope" },
        { key:"users",        route:"#/users?membership=pending", icon:"users", tone:"",
          title:"Users pending activation", n:pendingAct.length,
          why:"membership paid, not yet switched on" },
        { key:"team",         route:"#/team?status=pending", icon:"team", tone:"",
          title:"Team members pending a role", n:pendingRole.length,
          why:"signed in, zero access by construction" }
      ].filter(function (q) { return q.n > 0; });
    },
    // ---- badge counts, keyed by nav item ------------------------------------
    badges: function () {
      var map = {};
      derive.queues().forEach(function (q) {
        map[q.key] = { n:q.n, alert:q.tone === "bad" };
      });
      return map;
    },
    // ---- the sales chain, stage by stage ------------------------------------
    chain: function () {
      var open = deals.filter(function (dl) { return dl.stage < 4; });
      return {
        deals:deals.length, openDeals:open.length,
        quotations:quotations.filter(function (q) { return q.status !== "draft"; }).length,
        invoices:invoices.filter(function (i) { return i.doc === "issued"; }).length,
        payments:payments.filter(function (p) { return p.state === "verified"; }).length,
        noQuote:open.filter(function (dl) { return !quotesForDeal(dl.ref).length; }).length,
        acceptedNotInvoiced:quotations.filter(function (q) {
          return q.status === "accepted" && !invoicesForDeal(q.deal).filter(function (i) { return i.doc === "issued"; }).length;
        }).length,
        raisedUnpaid:invoices.filter(function (i) { return i.doc === "issued" && i.pay !== "paid"; }).length
      };
    },
    // ---- marketplace (chain B). No rupee figure, ever. ----------------------
    marketplace: function () {
      var by = function (s) { return clientDeals.filter(function (c) { return c.state === s; }).length; };
      return { total:clientDeals.length, ready:by("ready"), assigned:by("assigned"),
               delivered:by("delivered"), acknowledged:by("acknowledged"),
               converted:by("converted"), invalid:by("invalid"),
               breached:clientDeals.filter(function (c) { return c.sla === "breached"; }).length,
               eligible:suggestions.length, subscribed:businesses.filter(function(b){return b.status==="verified";}).length };
    },
    // ---- finance ------------------------------------------------------------
    finance: function () {
      var sum = function (arr) { return arr.reduce(function (a, p) { return a + p.amount; }, 0); };
      var verified = payments.filter(function (p) { return p.state === "verified"; });
      return {
        verified:sum(verified), verifiedN:verified.length,
        submitted:sum(payments.filter(function (p) { return p.state === "submitted"; })),
        unmatched:sum(payments.filter(function (p) { return p.state === "unmatched"; })),
        reversed:sum(payments.filter(function (p) { return p.state === "reversed"; })),
        refund:sum(payments.filter(function (p) { return p.state === "refund"; })),
        outstanding:derive.money().outstanding,
        spend:txns.reduce(function (a, t) { return a + t.amount; }, 0),
        variance:R(23600)
      };
    },
    // ---- users --------------------------------------------------------------
    users: function () {
      var c = function (k) { return users.filter(function (u) { return classify(u).key === k; }).length; };
      return { total:users.length, normal:c("normal"), active:c("active"),
               pending:c("pending"), paused:c("paused"), former:c("former"),
               conversion:pct(c("active") + c("paused"), users.length),
               incomplete:users.filter(function (u) { return u.profile < 100; }).length,
               renewing:users.filter(function (u) { return u.renews && days(d(u.renews)) <= 45 && days(d(u.renews)) >= 0; }).length };
    },
    // ---- team (live from the shared auth store) -----------------------------
    team: function () {
      var t = TeamStore.load();
      var c = function (f) { return t.filter(f).length; };
      return { total:t.length,
               active:c(function (u) { return u.status === "active" && u.role; }),
               pending:c(function (u) { return !u.role || u.status === "pending"; }),
               suspended:c(function (u) { return u.status === "suspended" || u.status === "deactivated"; }),
               locked:c(function (u) { return u.status === "locked"; }) };
    }
  };

  /* --------------------------------------------------------- search index --- */
  function searchIndex() {
    var out = [];
    deals.forEach(function (x) {
      var m = dealMoney(x);
      out.push({ id:x.ref, kind:"Deal", icon:"deal", group:"Sales", chain:"Sales", route:"#/deals/" + x.ref,
        title:x.ref, sub:x.who + (x.business ? " · " + x.business : "") + " · " + STAGES[x.stage].label +
          (m.outstanding ? " · " + inr(m.outstanding) + " outstanding" : ""),
        hay:(x.ref + " " + x.who + " " + (x.business || "") + " " + (x.email || "") + " " +
             x.city + " " + (x.state || "") + " " + x.phone + " " + x.enquiry).toLowerCase() });
    });
    quotations.forEach(function (x) {
      out.push({ id:x.ref, kind:"Quotation", icon:"quote", group:"Sales", chain:"Sales", route:"#/quotations/" + x.ref,
        title:x.ref, sub:x.deal + " · " + x.status + " · " + inr(x.value),
        hay:(x.ref + " " + x.deal + " " + x.plan + " " + x.status).toLowerCase() });
    });
    invoices.forEach(function (x) {
      out.push({ id:x.ref, kind:"Invoice", icon:"invoice", group:"Sales", chain:"Sales", route:"#/invoices/" + x.ref,
        title:x.ref, sub:x.deal + " · " + inr(x.amount) + " · " + (x.doc === "cancelled" ? "cancelled" : x.pay),
        hay:(x.ref + " " + x.deal + " " + x.quote + " " + x.doc + " " + x.pay).toLowerCase() });
    });
    return out;
  }

  /* ------------------------------------------------------------------ api --- */
  root.IBData = {
    TODAY:TODAY, d:d, days:days, fmtDate:fmtDate, fmtDay:fmtDay, relative:relative, longDate:longDate,
    inr:inr, inrWords:inrWords, paiseOf:paiseOf, pct:pct, L:L, K:K, R:R,
    STAGES:STAGES, PRIORITY:PRIORITY, PLANS:PLANS,
    deals:deals, quotations:quotations, invoices:invoices, payments:payments,
    txns:txns, categories:categories, clientDeals:clientDeals, suggestions:suggestions,
    exclusions:exclusions, weights:weights, users:users, businesses:businesses, audit:audit,
    TeamStore:TeamStore, seedTeam:seedTeam,
    dealOf:dealsOf, quoteOf:quoteOf, invoiceOf:invoiceOf, paymentOf:paymentOf,
    clientDealOf:clientDealOf, userOf:userOf,
    invoicesForDeal:invoicesForDeal, quotesForDeal:quotesForDeal, paymentsForDeal:paymentsForDeal,
    acceptedQuote:acceptedQuote, dealMoney:dealMoney, chainOf:chainOf,
    isOverdueInvoice:isOverdueInvoice, overdueDays:overdueDays, classify:classify,
    derive:derive, searchIndex:searchIndex
  };
})(window);

/* ---------------------------------------------------------------- ES module
   The IIFE above is verbatim from the prototype and still attaches to
   `window`, because the engines find each other through `root.IB*` at
   runtime. This only re-exports what it already published. */
export const IBData = window.IBData;
export default window.IBData;
