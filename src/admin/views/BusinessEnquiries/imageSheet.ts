/* =============================================================================
   Business Enquiries — the shareable image.
   -----------------------------------------------------------------------------
   The third way an enquiry leaves the panel, and the sibling of the two in
   share.ts: the WhatsApp text, the A4 print sheet, and this. Same act — "here
   is what we know about this customer" — so the field selection is copied from
   `shareText` deliberately rather than invented here. A third surface with its
   own idea of what is shareable is how the rule stops being true.

   WHY A CANVAS AND NOT A SCREENSHOT LIBRARY. html2canvas and its relatives are
   ~200 KB of dependency to solve a problem this file solves in one function,
   and they solve it wrongly: they rasterise the DOM as it currently looks, so
   an operator working in dark mode would send a dark card, and a card rendered
   from `enquiries.css` changes every time somebody touches a rule in it. A
   hand-drawn canvas is deterministic — the same enquiry produces the same
   pixels on every machine, every theme, every browser — and nothing in the
   panel's stylesheet can reach it. That determinism is also what makes rule 1
   below enforceable: what is on the image is exactly what this file draws.

   WHY THERE IS NO COMPANY NAME ON IT. Not an oversight, and not a branding
   decision that can be reversed later without reading this paragraph. This
   image is made to be forwarded into a chat app — it will sit in a thread, get
   screenshotted, get forwarded again, and end up somewhere nobody chose. The
   reference and the requirement identify the enquiry to the person who needs to
   act on it, and that person already knows who sent it, so a wordmark buys
   nothing and costs the ability to say the artefact is unattributable once it
   leaves. No brand name, no legal entity, no domain, no logo, anywhere on the
   canvas. The A4 sheet in share.ts DOES carry the company name and should: that
   is an internal document printed for a meeting, not a thing forwarded to a
   chat.

   WHAT IS NEVER DRAWN, and this is the point of the file rather than a caveat:
     · the contact log (`contactLog[].note`) — our notes about a customer,
       written by an operator for an operator
     · `remarks[]` — internal notes, the same class of thing as the contact log
       and more candid still: "her architect is the one who decides", "they have
       gone quiet on the last two as well". Never exported, copied, printed or
       imaged. `scripts/check-enquiry-share.cjs` asserts this file does not so
       much as reference the field.
     · the match score, the candidate rank, the eligible count, who else was
       considered. Exposing rank turns routing into a negotiation.
     · any money. There is none in the module to leak, and there never will be.
   The only two lines from the customer's side that may appear are their own
   words (`lastResponse(e).response`) and the confirmed requirement summary —
   the one sentence a person wrote deliberately for a business to read.

   THE PHONE NUMBER IS DRAWN, and that is the line worth being deliberate about
   rather than comfortable with: it is the whole point of sharing, and it is
   also personal data being baked into a picture and handed to a chat app that
   nobody can revoke it from. A picture is worse than the clipboard in one
   specific way — it cannot be redacted after the fact, and it survives being
   forwarded intact. The menu item says so before the press; this file cannot
   enforce anything past that.

   COLOURS ARE LITERAL HEX HERE, ON PURPOSE. This file is not styled by
   enquiries.css and a canvas never sees a CSS variable, so there is nothing to
   read a token from even if we wanted to. More importantly the image must look
   identical for every viewer regardless of the theme they happen to be working
   in — the recipient's copy cannot depend on the sender's settings. The palette
   is the print sheet's, so the image and the printed sheet read as one family.
   ============================================================================= */
import {
  activeAssignment, dateTimeLabel, lastResponse, place, sourceOf, statusOf, urgencyOf, viaLabel,
} from "./store";
import type { Enquiry } from "./store";

/* ============================================================ THE PALETTE ===
   Lifted from `enquirySheetHtml` in share.ts. Same greens, same ink, same
   hairlines, same rust accent for the unconfirmed caveat. */
const INK = "#14201d";        // body text
const GREEN = "#0c6b57";      // the accent rule and the confirmed-summary bar
const MUTED = "#6d8580";      // labels, keys, the footer
const HAIRLINE = "#eef3f2";   // between rows
const RULE = "#d3dedb";       // under a section heading, above the footer
const BAND = "#f6f9f8";       // the header band and the quote boxes
const PAPER = "#ffffff";      // the card itself
const PILL_EDGE = "#bfcecb";
const PILL_INK = "#3f5451";
const RUST = "#b3401f";       // urgency-is-hot, and "not yet confirmed"
const RUST_EDGE = "#eeb4a1";
const RUST_BG = "#fdf0eb";
const SRC_INK = "#264b83";
const SRC_EDGE = "#c8d5ec";
const SRC_BG = "#eef2fa";

/* ============================================================== THE METRICS =
   1080 × 1350 — the portrait ratio chat apps preview without cropping. Fixed,
   and drawn at scale 1: no devicePixelRatio anywhere in this file. The output
   is a file being sent to someone else, so its size must not depend on the
   screen it happened to be generated on. */
const WIDTH = 1080;
const HEIGHT = 1350;

const PAD = 72;
const COL = WIDTH - PAD * 2;          // 936 — the content column
const VAL_X = PAD + 268;              // where a row's value starts
const VAL_W = WIDTH - PAD - VAL_X;    // 668 — and how wide it may run
const BOX_W = COL;
const BOX_TEXT_W = COL - 52;          // inside the left bar and the padding

const BAND_H = 244;                   // the header band
const BODY_TOP = BAND_H + 34;
const FOOT_RULE = 1268;
const BODY_MAX = FOOT_RULE - 16;      // nothing may be drawn below this

const HEAD_H = 36;                    // a section heading and its rule
const GAP = 20;                       // between sections
const ROW_PAD = 9;                    // above and below a row's text
const ROW_LEAD = 31;                  // line height inside a row value
const BOX_PAD = 16;
const BOX_LEAD = 34;                  // line height inside a quote box
const PILL_H = 44;

const SANS = `"Segoe UI", -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif`;
const MONO = `"Consolas", ui-monospace, "SF Mono", Menlo, monospace`;
const font = (spec: string, family: string = SANS) => spec + " " + family;

const FONT_LABEL = font("700 18px");
const FONT_KEY = font("500 22px");
const FONT_VALUE = font("500 24px");
const FONT_BLOCK = font("500 26px");
const FONT_QUOTE = font("italic 500 26px");
const FONT_PILL = font("600 20px");
const FONT_REF = font("700 48px", MONO);
const FONT_SUB = font("500 22px");
const FONT_FOOT = font("500 19px");
const FONT_FOOT_MONO = font("500 19px", MONO);

const dash = (v: string | null | undefined) => (v && String(v).trim()) || "—";

/* ============================================================ THE PRIMITIVES */

/** Rounded rectangle as a fresh path, ready to fill or stroke. `roundRect` is
 *  the one-liner everywhere except older Safari, which is exactly the browser
 *  an operator on an iPad is using — so the manual path is not defensive
 *  padding, it is the fallback that actually fires. */
function path(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Break `text` into lines that fit `maxWidth` at the context's CURRENT font.
 *  Word boundaries first; a single token wider than the column — a pasted URL,
 *  a run-on reference, a language this splitter has no spaces to work with — is
 *  cut by character rather than allowed to run off the edge of the card, which
 *  is the failure a naive wrapper ships with and nobody notices until a
 *  customer's email address is half missing from an image already sent. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  const fits = (s: string) => ctx.measureText(s).width <= maxWidth;

  String(text ?? "").split(/\r?\n/).forEach((para) => {
    let line = "";
    para.split(/\s+/).filter(Boolean).forEach((word) => {
      const candidate = line ? line + " " + word : word;
      if (fits(candidate)) { line = candidate; return; }
      if (line) { out.push(line); line = ""; }
      let rest = word;
      while (!fits(rest)) {
        let cut = rest.length - 1;
        while (cut > 1 && !fits(rest.slice(0, cut))) cut -= 1;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    });
    out.push(line);
  });

  while (out.length && !out[0]) out.shift();
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}

/** Cut a wrapped block to the number of lines its allotted height can hold.
 *  An ellipsis is only ever added when something was actually dropped — a card
 *  that ends in "…" is telling the reader to go and open the record, and it
 *  must not say that about a summary it printed in full. */
function clampLines(
  ctx: CanvasRenderingContext2D, lines: string[], maxLines: number, maxWidth: number,
): string[] {
  if (maxLines <= 0) return [];
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
  kept[maxLines - 1] = last.replace(/[\s,;:.·—-]+$/, "") + "…";
  return kept;
}

/** Letter-spaced small caps, drawn a character at a time. `ctx.letterSpacing`
 *  exists in Chrome and not in Safari or Firefox's older builds, and a heading
 *  that is tracked on one machine and cramped on another breaks the one promise
 *  this renderer makes — that everybody gets the same picture. */
function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, space: number) {
  let cx = x;
  Array.from(text).forEach((ch) => {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + space;
  });
}

/** One status/urgency/source chip. Returns the width it consumed so the caller
 *  can lay the next one beside it. */
function pill(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  fg: string, bg: string, edge: string,
): number {
  ctx.font = FONT_PILL;
  const w = Math.ceil(ctx.measureText(text).width) + 44;
  path(ctx, x, y, w, PILL_H, PILL_H / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.fillText(text, x + 22, y + PILL_H / 2 + 7);
  return w;
}

/* ============================================================== THE LAYOUT ===
   Rows are measured before anything is drawn, because the two free-text blocks
   in the middle — the requirement and the customer's own words — get whatever
   vertical space the fixed rows leave, and they cannot be given it after the
   fact. Everything that overflows its allotment is truncated with an ellipsis
   rather than allowed to run into the footer. */

type MeasuredRow = { key: string; lines: string[]; height: number };

function measureRows(
  ctx: CanvasRenderingContext2D, rows: [string, string][], maxLines: number,
): MeasuredRow[] {
  ctx.font = FONT_VALUE;
  return rows.map(([key, value]) => {
    const lines = clampLines(ctx, wrapText(ctx, dash(value), VAL_W), maxLines, VAL_W);
    return { key, lines, height: ROW_PAD * 2 + Math.max(1, lines.length) * ROW_LEAD };
  });
}

const rowsHeight = (rows: MeasuredRow[]) => rows.reduce((n, r) => n + r.height, 0);

function sectionHead(ctx: CanvasRenderingContext2D, label: string, y: number, colour = MUTED): number {
  ctx.font = FONT_LABEL;
  ctx.fillStyle = colour;
  tracked(ctx, label.toUpperCase(), PAD, y + 18, 3);
  ctx.fillStyle = RULE;
  ctx.fillRect(PAD, y + 30, COL, 1);
  return y + HEAD_H;
}

function drawRows(ctx: CanvasRenderingContext2D, rows: MeasuredRow[], y: number): number {
  let cy = y;
  rows.forEach((r) => {
    ctx.font = FONT_KEY;
    ctx.fillStyle = MUTED;
    ctx.fillText(r.key, PAD, cy + ROW_PAD + 24);
    ctx.font = FONT_VALUE;
    ctx.fillStyle = INK;
    r.lines.forEach((ln, i) => ctx.fillText(ln, VAL_X, cy + ROW_PAD + 25 + i * ROW_LEAD));
    cy += r.height;
    ctx.fillStyle = HAIRLINE;
    ctx.fillRect(PAD, cy - 1, COL, 1);
  });
  return cy;
}

/** A headed box of free text — the requirement, or the customer's own words.
 *  The bar down its left edge carries the meaning: green for something a person
 *  confirmed, rust for something only the form has said. */
function drawBlock(
  ctx: CanvasRenderingContext2D, label: string, labelColour: string, lines: string[],
  y: number, textFont: string, bar: string, bg: string,
): number {
  ctx.font = FONT_LABEL;
  ctx.fillStyle = labelColour;
  tracked(ctx, label.toUpperCase(), PAD, y + 18, 3);
  const top = y + HEAD_H;
  const h = BOX_PAD * 2 + Math.max(1, lines.length) * BOX_LEAD;
  path(ctx, PAD, top, BOX_W, h, 12);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = bar;
  ctx.fillRect(PAD, top, 6, h);
  ctx.restore();
  ctx.font = textFont;
  ctx.fillStyle = INK;
  lines.forEach((ln, i) => ctx.fillText(ln, PAD + 28, top + BOX_PAD + 26 + i * BOX_LEAD));
  return top + h;
}

const boxLines = (space: number) => Math.max(0, Math.floor((space - BOX_PAD * 2) / BOX_LEAD));

/* ================================================================ THE CARD === */

function render(ctx: CanvasRenderingContext2D, e: Enquiry) {
  const src = sourceOf(e.source.kind);
  const u = urgencyOf(e.qualification.urgency);
  const a = activeAssignment(e);
  const q = e.qualification;
  const last = lastResponse(e);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  /* ------------------------------------------------------- the header band --
     Reference, when it arrived, and the three chips that say what state it is
     in. No name of ours goes in this band or anywhere else — see the file
     header. The reference is the identity. */
  ctx.fillStyle = BAND;
  ctx.fillRect(0, 0, WIDTH, BAND_H);
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, WIDTH, 8);
  ctx.fillStyle = RULE;
  ctx.fillRect(0, BAND_H, WIDTH, 1);

  ctx.font = FONT_LABEL;
  ctx.fillStyle = MUTED;
  tracked(ctx, "BUSINESS ENQUIRY", PAD, 76, 3.4);

  ctx.font = FONT_REF;
  ctx.fillStyle = INK;
  ctx.fillText(e.enquiryId, PAD, 136);

  ctx.font = FONT_SUB;
  ctx.fillStyle = MUTED;
  ctx.fillText("Received " + dateTimeLabel(e.createdAt), PAD, 174);

  let px = PAD;
  const chips: [string, string, string, string][] = [
    [statusOf(e.status).label, PILL_INK, PAPER, PILL_EDGE],
  ];
  if (u) chips.push([u.label, u.hot ? RUST : PILL_INK, u.hot ? RUST_BG : PAPER, u.hot ? RUST_EDGE : PILL_EDGE]);
  chips.push([
    src.label + (e.source.via ? " · " + viaLabel(e.source.via) : ""), SRC_INK, SRC_BG, SRC_EDGE,
  ]);
  chips.forEach(([text, fg, bg, edge]) => {
    ctx.font = FONT_PILL;
    const w = Math.ceil(ctx.measureText(text).width) + 44;
    /* A chip that would run past the margin is dropped rather than clipped:
       half a status is worse than no status. */
    if (px + w > WIDTH - PAD) return;
    px += pill(ctx, text, px, 190, fg, bg, edge) + 10;
  });

  /* ------------------------------------------------------------- the rows --
     The same field selection as `shareText`, in the same order, minus the two
     that the band above already says (source, received). Owner is not here on
     purpose: the recipient of this image does not need to know which of our
     people is holding it. */
  const customer: [string, string][] = [
    ["Customer", e.customer.name],
    /* The phone. The reason the image exists, and personal data leaving the
       audited surface — see the file header. */
    ["Phone", e.customer.phone],
  ];
  if (e.customer.email) customer.push(["Email", e.customer.email]);
  customer.push([
    "Location",
    place(e) + (e.requirement.state ? ", " + e.requirement.state : "") +
      (e.requirement.pincode ? " · " + e.requirement.pincode : ""),
  ]);

  const requirement: [string, string][] = [
    ["Category", dash(e.requirement.category)],
    ["Service", dash(e.requirement.service)],
  ];
  if (e.requirement.projectType) requirement.push(["Project type", e.requirement.projectType]);
  requirement.push(["Urgency", dash(u ? u.label : null)]);

  const handling: [string, string][] = [["Status", statusOf(e.status).label]];
  if (a) handling.push(["Assigned to", a.businessName + " · " + dateTimeLabel(a.assignedAt)]);

  /* ------------------------------------------------- what gets the leftover --
     Fixed rows are measured at two lines each; if that leaves the free-text
     blocks less than a single line to stand in, they are re-measured at one
     line. The requirement is the reason somebody is looking at this card, so it
     is the last thing allowed to disappear. */
  const blockCount = last?.response ? 2 : 1;
  const minBlocks = (BOX_PAD * 2 + BOX_LEAD + HEAD_H) * blockCount;
  const spaceFor = (rows: MeasuredRow[][]) =>
    BODY_MAX - BODY_TOP - rows.reduce((n, r) => n + HEAD_H + rowsHeight(r), 0) -
    GAP * (blockCount + 2);

  let sections = [customer, requirement, handling].map((r) => measureRows(ctx, r, 2));
  if (spaceFor(sections) < minBlocks) {
    sections = [customer, requirement, handling].map((r) => measureRows(ctx, r, 1));
  }
  const forBlocks = spaceFor(sections) - HEAD_H * blockCount;

  /* The confirmed summary if a person wrote one; otherwise the raw submission,
     labelled so nobody quotes it back to the customer as though we had checked
     it. Same rule, same words, as the text and the print sheet. */
  const confirmed = !!q.requirementSummary;
  ctx.font = FONT_BLOCK;
  const summaryAll = wrapText(ctx, dash(q.requirementSummary || e.requirement.text), BOX_TEXT_W);
  ctx.font = FONT_QUOTE;
  const quoteAll = last?.response
    ? wrapText(ctx, "“" + last.response + "”", BOX_TEXT_W)
    : [];

  let quoteSpace = 0;
  if (quoteAll.length) {
    const wants = BOX_PAD * 2 + quoteAll.length * BOX_LEAD;
    quoteSpace = Math.min(wants, Math.max(BOX_PAD * 2 + BOX_LEAD, Math.floor(forBlocks * 0.45)));
  }
  ctx.font = FONT_BLOCK;
  const summaryLines = clampLines(ctx, summaryAll, boxLines(forBlocks - quoteSpace), BOX_TEXT_W);
  ctx.font = FONT_QUOTE;
  const quoteLines = clampLines(ctx, quoteAll, boxLines(quoteSpace), BOX_TEXT_W);

  /* ------------------------------------------------------------- the draw -- */
  let y = BODY_TOP;

  y = drawRows(ctx, sections[0], sectionHead(ctx, "Customer", y)) + GAP;
  y = drawRows(ctx, sections[1], sectionHead(ctx, "Requirement", y)) + GAP;

  y = drawBlock(
    ctx,
    confirmed ? "What they need" : "As submitted · not yet confirmed",
    confirmed ? MUTED : RUST,
    summaryLines, y, FONT_BLOCK,
    confirmed ? GREEN : RUST_EDGE,
    confirmed ? BAND : RUST_BG,
  ) + GAP;

  if (quoteLines.length) {
    y = drawBlock(
      ctx, "In their own words", MUTED, quoteLines, y, FONT_QUOTE, PILL_EDGE, BAND,
    ) + GAP;
  }

  drawRows(ctx, sections[2], sectionHead(ctx, "Handling", y));

  /* ------------------------------------------------------------ the footer --
     The reference again, because a card cropped by a chat app's preview should
     still be traceable, and the moment it was made, because a forwarded picture
     has no other way of saying how old it is. Nothing else: no company name, no
     domain, no "generated by". */
  ctx.fillStyle = RULE;
  ctx.fillRect(PAD, FOOT_RULE, COL, 1);
  ctx.font = FONT_FOOT_MONO;
  ctx.fillStyle = MUTED;
  ctx.fillText(e.enquiryId, PAD, FOOT_RULE + 38);
  ctx.font = FONT_FOOT;
  ctx.textAlign = "right";
  ctx.fillText(dateTimeLabel(new Date().toISOString()), WIDTH - PAD, FOOT_RULE + 38);
  ctx.textAlign = "left";
}

/* ================================================================ THE EXITS = */

/** The card as a PNG. Separated from the download so the same bytes can be fed
 *  to a clipboard write or an upload later without a second renderer existing. */
export function enquiryImageBlob(e: Enquiry): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("This browser did not give us a 2D canvas context."));
  render(ctx, e);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be encoded."))),
      "image/png",
    );
  });
}

/** Build it and hand it to the browser. Named `<reference>.png` so a card
 *  sitting in a downloads folder a week later still says which enquiry it is —
 *  the same reasoning as `fileNameFor` in exportCsv.ts, and the same anchor
 *  dance as `downloadCsv`, including the delayed revoke: Safari has not always
 *  finished reading the blob by the time click() returns. */
export async function downloadEnquiryImage(e: Enquiry): Promise<void> {
  const blob = await enquiryImageBlob(e);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = e.enquiryId + ".png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
