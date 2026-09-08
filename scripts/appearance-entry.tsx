/* =============================================================================
   THE APPEARANCE GALLERY — every shared part, in one screen
   -----------------------------------------------------------------------------
   WHY IT EXISTS. There are two themes, and the only honest way to know a change
   is right in both is to look at both. Every other check in this repo renders
   to a string; a string cannot tell you that a selected row lost its tint in
   dark, that a chip inside a field is a different height from a chip beside it,
   or that an icon-only button came out rectangular.

   It used to photograph SIX appearances — three schemes × two themes. There are
   two now, which is the point: six appearances is six design systems to keep
   honest, and in practice four of them were never looked at again after the
   week they landed.

   It is NOT a page of the product: it renders the real components out of
   src/admin/ui and the real ShellProvider, with no session, no API and no
   router beyond a MemoryRouter, so it opens instantly and cannot be affected by
   what the backend is doing. `npm run shots` drives it and writes the PNGs.

   ADD A PART HERE THE DAY YOU ADD IT TO THE SYSTEM. A component absent from
   this page is a component nobody has seen in dark.
   ============================================================================= */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  ShellProvider, useShell, THEMES, currentTheme, setTheme,
} from "../src/admin/shell/ShellContext";
import {
  ActivityFeed, Alert, Assignee, Avatar, Breadcrumbs, Card, Checkbox, ChipInput,
  ConfirmModal, DateRange, DealStatus, Delta, DrawerShell, EmptyState, Eyebrow,
  FileUpload, FormField, Icon, InfoDot, Input, InputGroup, LeadStatus, Legend,
  ListSkeleton, MenuDivider, MenuItem, MenuSection, Meter, MultiSelect,
  Pagination, Person, Pill, Pipeline, Priority, Radio, Segmented, SelectInput,
  Table, Tabs, Tags, Textarea, Tiles, Timeline, Toggle, Tooltip,
} from "../src/admin/ui";

import "../src/styles/admin-theme.css";

const STAGES = [
  { k: "new", label: "New" }, { k: "qualified", label: "Qualified" },
  { k: "quoted", label: "Quoted" }, { k: "won", label: "Won" },
];
const TEAMS = [
  { v: "sales", l: "Sales" }, { v: "design", l: "Design" },
  { v: "site", l: "Site" }, { v: "finance", l: "Finance" },
];

function Board() {
  const shell = useShell();
  const [tags, setTags] = useState(["onboarding", "kitchen", "repeat client"]);
  const [theme, setThemeState] = useState(currentTheme());
  const [tab, setTab] = useState("all");
  const [multi, setMulti] = useState<string[]>(["sales", "design"]);
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [page, setPage] = useState(3);
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("2026-09-30");

  const openModal = () =>
    shell.modal(
      <ConfirmModal
        title="Remove N. Pillai from Sales?"
        body={
          <>
            <p className="md-p">Their 14 open deals move to unassigned. Attendance history stays.</p>
            <div style={{ height: 12 }} />
            <Alert tone="warn" title="Two others in Sales are away this week">
              A warning, not a block — you can go ahead.
            </Alert>
          </>
        }
        verb="Remove from team"
        tone="bad"
        onConfirm={shell.closeLayer}
        onClose={shell.closeLayer}
      />,
      "sm"
    );

  const openDrawer = () =>
    shell.drawer(
      <DrawerShell
        title="R. Menon"
        sub="Design · senior · EMP-0155"
        onClose={shell.closeLayer}
        actions={
          <>
            <span className="spacer" />
            <button className="btn" onClick={shell.closeLayer}>Open profile</button>
            <button className="btn pri" onClick={shell.closeLayer}>Close their day</button>
          </>
        }
      >
        <Eyebrow>Today</Eyebrow>
        <div style={{ height: 12 }} />
        <Tiles cols={2} list={[
          { k: "Hours", v: "6.1", delta: { dir: "up", text: "0.3", of: "vs last week" } },
          { k: "Tasks closed", v: "2", foot: <Pill tone="warn" text="Break 1h 12m" /> },
        ]} />
        <div style={{ height: 18 }} />
        <Eyebrow>What happened</Eyebrow>
        <div style={{ height: 12 }} />
        <Timeline items={[
          { title: "Shift opened", meta: "09:04 · self", tone: "ok" },
          { title: "Assigned IB-D-1042", meta: "10:20 · A. Rao" },
          { title: "Marked absent for 8 Sep", meta: "00:05 · derived from the roster", tone: "sys" },
        ]} />
      </DrawerShell>,
      undefined,
      "md"
    );

  return (
    <div className="page wide" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <header style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <Breadcrumbs items={[
            { label: "Admin", to: "#/" }, { label: "Design system" }, { label: "Appearance" },
          ]} />
          <h1 style={{ fontSize: "var(--text-3xl)", marginTop: 6 }}>Ink &amp; Signal</h1>
          <div className="ap-hint" style={{ maxWidth: "62ch" }}>
            Every shared part, drawn in the theme selected. Black and white build the
            interface; forest marks where you are and what is yours; everything else is
            a signal.
          </div>
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        <div>
          <div className="ap-k">Theme</div>
          <Segmented
            label="Theme"
            value={theme}
            options={THEMES.map((t) => ({ v: t.id, l: t.label }))}
            onPick={(v) => { setTheme(v); setThemeState(v); }}
          />
        </div>
      </header>

      {/* ---------------------------------------------------------- ACTIONS */}
      <Card title="Actions" sub="One height per row. The primary is ink, never green.">
        <div className="toolbar">
          <button className="btn pri">Approve leave</button>
          <button className="btn brand">Open the portal</button>
          <button className="btn">Save draft</button>
          <button className="btn dgr">Delete</button>
          <button className="btn ghost">Ghost</button>
          <button className="btn" disabled>Disabled</button>
          <button className="btn sm">Small</button>
          <button className="btn lg">Large</button>
          <button className="btn icon" aria-label="More"><Icon name="dots" /></button>
          <Tooltip tip="Opens the modal specimen">
            <button className="btn" onClick={openModal}>Open modal</button>
          </Tooltip>
          <button className="btn" onClick={openDrawer}>Open drawer</button>
          <button className="btn" onClick={() => shell.toast("Leave approved")}>Toast</button>
          <button className="btn" onClick={() => shell.toast("Could not reach the server.", "bad")}>
            Toast · bad
          </button>
        </div>
      </Card>

      {/* ------------------------------------------------------------ FORMS */}
      <Card title="Form controls" sub="Every one is 38px, so a column of them lines up.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          <FormField id="g1" label="Member" req hint="As it appears on their contract.">
            <Input id="g1" defaultValue="N. Pillai" />
          </FormField>
          <FormField id="g2" label="Employee ID" hint="Read-only — set when the account was created.">
            <Input id="g2" defaultValue="EMP-0142" readOnly />
          </FormField>
          <FormField id="g3" label="Team">
            <SelectInput id="g3" ph="Pick a team" defaultValue="design"
              options={TEAMS.map((t) => ({ v: t.v, l: t.l }))} />
          </FormField>
          <FormField id="g4" label="Pincode" err="Needs 6 digits. Yours has 5.">
            <Input id="g4" defaultValue="41007" err />
          </FormField>
          <FormField id="g5" label="Monthly retainer">
            <InputGroup pre="₹" post="/mo"><Input id="g5" defaultValue="42,000" /></InputGroup>
          </FormField>
          <FormField id="g6" label="Reporting window">
            <DateRange from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
          </FormField>
          <FormField label="Also in">
            <MultiSelect label="Teams" options={TEAMS} value={multi} onChange={setMulti} />
          </FormField>
          <FormField id="g8" label="Reason">
            <Textarea id="g8" rows={2} defaultValue="Family function, out of town" />
          </FormField>
          <FormField id="g9" label="Tags" hint="Enter or a comma commits. Backspace takes the last one back.">
            <ChipInput id="g9" value={tags} onChange={setTags} placeholder="Add another" />
          </FormField>
          <FormField label="Attachment">
            <FileUpload accept=".pdf,.png,.jpg" hint="PDF or an image, up to 8 MB."
              onFiles={(f) => shell.toast(f.length + " file(s) taken")} />
          </FormField>
        </div>
        <div style={{ height: 16 }} />
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow bare>Choices</Eyebrow>
            <Checkbox id="c1" checked={checked} onChange={setChecked}
              label="Send them the summary" hint="Once, at 18:00 their time." />
            <Checkbox id="c2" indeterminate label="Some of the 14 selected" />
            <Checkbox id="c3" disabled label="Locked by the role" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow bare>One of</Eyebrow>
            <Radio id="r1" name="w" value="a" checked label="Whole day" />
            <Radio id="r2" name="w" value="b" label="Half day" hint="Counts as 0.5 against leave." />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Eyebrow bare>Takes effect at once</Eyebrow>
            <Toggle id="t1" on={on} onChange={setOn}
              label="Auto-assign new enquiries" hint="Applies the moment it moves." />
            <Toggle id="t2" on={false} disabled onChange={() => {}} label="Disabled" />
          </div>
        </div>
      </Card>

      {/* ----------------------------------------------------------- STATUS */}
      <Card title="Status" sub="One chip, in the whole product. A module hands in the key, not a colour.">
        <Eyebrow bare>Lead — the CRM's own lifecycle</Eyebrow>
        <div style={{ height: 8 }} />
        <div className="chiprow">
          {["new", "processing", "qualified", "assigned", "converted", "rejected", "no-match", "duplicate"]
            .map((s) => <LeadStatus key={s} status={s} />)}
        </div>
        <div style={{ height: 16 }} />
        <Eyebrow bare>Deal, subscription, invoice, task — one map, so "paid" and "won" are one green</Eyebrow>
        <div style={{ height: 8 }} />
        <div className="chiprow">
          {["open", "won", "lost", "stalled", "active", "paused", "paid", "overdue",
            "refunded", "in-review", "completed", "draft"]
            .map((s) => <DealStatus key={s} status={s} />)}
        </div>
        <div style={{ height: 16 }} />
        <Eyebrow bare>Priority — a ramp, not a palette</Eyebrow>
        <div style={{ height: 8 }} />
        <div className="chiprow">
          {["critical", "high", "medium", "normal", "low"].map((p) => <Priority key={p} level={p} />)}
        </div>
        <div style={{ height: 16 }} />
        <Eyebrow bare>Tags — hues that mean nothing, by contract</Eyebrow>
        <div style={{ height: 8 }} />
        <div className="chiprow">
          <Tags items={[
            { label: "kitchen", tone: "teal" },
            { label: "repeat client", tone: "violet" },
            { label: "site visit done", tone: "lime" },
            { label: "high-value", tone: "amber", auto: true },
            { label: "referred", tone: "pink" },
            { label: "north zone", tone: "blue" },
            { label: "urgent-ish", tone: "orange" },
          ]} max={5} />
        </div>
        <div style={{ height: 16 }} />
        <Eyebrow bare>Shapes and the live accent</Eyebrow>
        <div style={{ height: 8 }} />
        <div className="chiprow">
          <Pill tone="solid" text="Solid" />
          <Pill tone="line" text="Outline" />
          <Pill tone="dead" text="Cancelled" />
          <Pill tone="brand" text="Current" />
          <Pill text="No tone" />
          <span className="pill pill-live"><span className="live-dot" /> On shift</span>
          <span className="chip on">
            Team: Sales
            <button className="x" aria-label="Remove"><Icon name="x" size="sm" /></button>
          </span>
        </div>
      </Card>

      {/* ------------------------------------------------------------- CRM */}
      <Card title="CRM" sub="Where the deal is, who owns it, and how far along.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
          <div>
            <Eyebrow bare>Pipeline</Eyebrow>
            <div style={{ height: 10 }} />
            <Pipeline stages={STAGES} current="quoted" />
          </div>
          <div>
            <Eyebrow bare>Assignment</Eyebrow>
            <div style={{ height: 10 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Assignee name="A. Rao" role="Sales · senior" to="#/team/1" />
              <Assignee />
            </div>
          </div>
          <div>
            <Eyebrow bare>Progress</Eyebrow>
            <div style={{ height: 10 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div className="faint" style={{ fontSize: "var(--text-sm)", marginBottom: 5 }}>
                  Quota · 68% <Delta value="6" suffix="%" dir="up" />
                </div>
                <Meter value={68} label="Quota" />
              </div>
              <div>
                <div className="faint" style={{ fontSize: "var(--text-sm)", marginBottom: 5 }}>
                  Budget spent · 94%
                </div>
                <Meter value={94} tone="bad" label="Budget" />
              </div>
            </div>
          </div>
          <div>
            <Eyebrow bare>People</Eyebrow>
            <div style={{ height: 10 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Person name="N. Pillai" sub="Sales" />
              <Person name="R. Menon" sub="Design · senior" />
              <div style={{ display: "flex", gap: 6 }}>
                <Avatar name="A. Rao" sm /><Avatar name="S. Iyer" sm />
                <Avatar name="K. Das" sm /><Avatar name="M. Roy" sm />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ----------------------------------------------------------- FIGURES */}
      <div>
        <Tiles list={[
          {
            k: "On shift now", v: <>28<span className="u">/34</span></>,
            foot: <span className="pill pill-live"><span className="live-dot" /> live</span>,
          },
          { k: "Avg hours / day", v: "7.4", delta: { dir: "up", text: "0.3", of: "vs last week" } },
          { k: "Unclosed days", v: "11", delta: { dir: "down", text: "4", of: "vs last week" } },
          {
            k: "Collection due", v: <>₹22.4<span className="u">L</span></>, serif: true,
            foot: <Pill tone="warn" text="6 overdue" />,
          },
        ]} />
      </div>

      {/* ------------------------------------------------------------- DATA */}
      <Card title="A list" sub="Filters, selection, sort, bulk actions and a pager — the five bands.">
        <Tabs items={[
          { k: "all", label: "All", n: 241 },
          { k: "mine", label: "Mine", n: 18 },
          { k: "flagged", label: "Needs attention", n: 6 },
        ]} cur={tab} onPick={setTab} />
        <div className="filterband">
          <span className="field grow">
            <Icon name="search" size="sm" />
            <input type="search" placeholder="Search name, reference or phone…" aria-label="Search" />
          </span>
          <select className="sel on" aria-label="Status" defaultValue="qualified">
            <option value="">Status</option><option value="qualified">Qualified</option>
          </select>
          <select className="sel" aria-label="City" defaultValue="">
            <option value="">City</option><option value="pune">Pune</option>
          </select>
          <MultiSelect label="Teams" options={TEAMS} value={multi} onChange={setMulti} sm />
          <span className="spacer" />
          <button className="btn sm"><Icon name="download" />Export</button>
          <button className="btn pri sm"><Icon name="plus" />Add enquiry</button>
        </div>
        <div className="bulkbar">
          <span className="n">2 selected</span>
          <span className="spacer" />
          <button className="btn sm">Assign</button>
          <button className="btn sm">Export selection</button>
          <button className="btn sm dgr">Reject</button>
        </div>
        <Table
          cols={[
            { label: "", w: "26px" },
            { label: "" , w: "26px" },
            { label: "Enquiry" },
            { label: "Stage" },
            { label: "Owner" },
            { label: "Tags" },
            { label: "Value", cls: "n" },
            { label: "Age", cls: "n" },
          ]}
          rows={[
            <tr key="1" aria-selected="true">
              <td><span className="sev bad" /></td>
              <td><Checkbox checked ariaLabel="Select IB-E-2214" /></td>
              <td>
                <div className="cell-1">N. Pillai · modular kitchen</div>
                <div className="cell-2 mono">IB-E-2214 · Pune</div>
              </td>
              <td><LeadStatus status="qualified" /></td>
              <td><Assignee name="A. Rao" /></td>
              <td><Tags items={[{ label: "kitchen", tone: "teal" }, { label: "repeat", tone: "violet" }]} max={2} /></td>
              <td className="n">₹4,20,000</td>
              <td className="n">12d</td>
            </tr>,
            <tr key="2">
              <td><span className="sev warn" /></td>
              <td><Checkbox ariaLabel="Select IB-E-2215" /></td>
              <td>
                <div className="cell-1">S. Iyer · full home</div>
                <div className="cell-2 mono">IB-E-2215 · Mumbai</div>
              </td>
              <td><LeadStatus status="processing" /></td>
              <td><Assignee /></td>
              <td><Tags items={[{ label: "high-value", tone: "amber", auto: true }]} /></td>
              <td className="n">₹11,80,000</td>
              <td className="n">3d</td>
            </tr>,
            <tr key="3">
              <td><span className="sev" /></td>
              <td><Checkbox ariaLabel="Select IB-E-2216" /></td>
              <td>
                <div className="cell-1">K. Das · wardrobe</div>
                <div className="cell-2 mono">IB-E-2216 · Nashik</div>
              </td>
              <td><LeadStatus status="no-match" /></td>
              <td><Assignee name="R. Menon" /></td>
              <td><span className="none">—</span></td>
              <td className="n"><span className="none">—</span></td>
              <td className="n">28d</td>
            </tr>,
          ]}
        />
        <Pagination page={page} pages={9} total={241} unit="enquiries" onPage={setPage} />
      </Card>

      {/* --------------------------------------------------------- FEEDBACK */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20 }}>
        <Card title="Conditions" sub="Still true. A toast is a receipt; this is a state.">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Alert tone="ok" title="Payroll for August is settled">
              34 of 34 members reconciled.
            </Alert>
            <Alert tone="warn" title="Two members are unclosed"
              action={<button className="btn sm">Review</button>}>
              Their days will auto-close at midnight.
            </Alert>
            <Alert tone="bad" title="Could not reach the ledger service"
              onClose={() => {}}>
              Figures below are from 12 minutes ago.
            </Alert>
            <Alert tone="info">
              Absent is computed from the roster and never stored.
            </Alert>
          </div>
        </Card>

        <Card title="Menu" sub="One row, whichever surface it lands on.">
          <div className="menu" style={{ position: "static", boxShadow: "var(--shadow-md)" }}>
            <MenuSection>This record</MenuSection>
            <MenuItem ico="eye" label="Open" right="↵" />
            <MenuItem ico="edit" label="Edit details" />
            <MenuItem ico="user" label="Reassign" desc="Moves the 14 open deals too" />
            <MenuItem ico="copy" label="Duplicate" current />
            <MenuDivider />
            <MenuSection>Export</MenuSection>
            <MenuItem ico="download" label="Download CSV" right="⌘E" />
            <MenuItem ico="print" label="Print" disabled />
            <MenuDivider />
            <MenuItem ico="trash" label="Delete enquiry" danger />
          </div>
        </Card>

        <Card title="Explanations" sub="A tooltip labels; the dot explains.">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="faint" style={{ fontSize: "var(--text-md)" }}>Attainment</span>
              <InfoDot label="What attainment counts">
                <b>What it counts</b>
                Closed-won value against the quota set for this quarter.
                <br /><br />
                <b>What pressing it does</b>
                Filters the list to this person's won deals.
              </InfoDot>
            </div>
            <div>
              <Tooltip tip="Export every matching row, not the page on screen">
                <button className="btn sm"><Icon name="download" />Export</button>
              </Tooltip>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Delta value="12" suffix="%" dir="up" of="vs last quarter" />
              <Delta value="4" suffix="d" dir="down" />
              <Delta value="0" dir="flat" />
            </div>
          </div>
        </Card>

        <Card title="Waiting, and nothing there" sub="A skeleton keeps the shape; an empty state is dashed.">
          <ListSkeleton rows={3} />
          <div style={{ height: 16 }} />
          <EmptyState
            icon="inbox"
            title="No enquiries match those filters"
            body="Nine hundred are in the queue — these filters just do not reach any of them."
            action={<button className="btn">Clear all filters</button>}
          />
        </Card>

        <Card title="What happened" sub="To this record, newest first. The system's own entries are marked.">
          <Timeline items={[
            { title: <>Qualified by <b>A. Rao</b></>, meta: "Today · 14:20", tone: "ok" },
            { title: "Site visit logged", body: "Measurements attached (3 files).", meta: "Yesterday · 11:05" },
            { title: "Matched to 4 businesses", meta: "8 Sep · automatic", tone: "sys" },
            { title: "Duplicate check failed", body: "Same phone as IB-E-1990.", meta: "8 Sep · automatic", tone: "bad" },
          ]} />
        </Card>

        <Card title="Across the panel" sub="Who did what, most recent first.">
          <ActivityFeed items={[
            { who: "A. Rao", what: <>assigned <b>IB-E-2214</b> to Design</>, when: "4 min ago" },
            { who: "S. Iyer", what: <>approved leave for <b>R. Menon</b></>, when: "22 min ago" },
            { ico: "recon", what: <>Payroll for <b>August</b> was reconciled</>, when: "1 h ago" },
            { who: "K. Das", what: <>rejected <b>IB-E-2201</b> — out of service area</>, when: "3 h ago" },
          ]} />
        </Card>
      </div>

      {/* ------------------------------------------------------------ CHARTS */}
      <Card title="Data visualisation"
        sub="The first series is the brand. A single-series chart is therefore forest.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          <figure className="chartframe ticks">
            <figcaption className="cf-h"><h4>Enquiries per week</h4></figcaption>
            <div className="cf-plot">
              <svg viewBox="0 0 260 90" role="img" aria-label="Enquiries per week, rising">
                <line x1="0" y1="89" x2="260" y2="89" stroke="var(--chart-grid)" />
                <line x1="0" y1="45" x2="260" y2="45" stroke="var(--chart-grid)" strokeDasharray="2 3" />
                {[38, 52, 44, 61, 58, 74, 69, 86].map((v, i) => (
                  <rect key={i} x={6 + i * 32} y={90 - v} width="20" height={v}
                    fill="var(--chart-1)" rx="2" />
                ))}
              </svg>
            </div>
            <Legend items={[{ label: "Enquiries", color: "var(--chart-1)" }]} />
          </figure>

          <figure className="chartframe ticks">
            <figcaption className="cf-h"><h4>Source mix</h4></figcaption>
            <div className="cf-plot">
              <svg viewBox="0 0 260 90" role="img" aria-label="Source mix by channel">
                {[
                  ["var(--chart-1)", 0, 96], ["var(--chart-2)", 96, 64],
                  ["var(--chart-3)", 160, 44], ["var(--chart-4)", 204, 32],
                  ["var(--chart-5)", 236, 24],
                ].map(([c, x, w], i) => (
                  <rect key={i} x={x as number} y="30" width={w as number} height="30"
                    fill={c as string} />
                ))}
              </svg>
            </div>
            <Legend items={[
              { label: "Portal", color: "var(--chart-1)" },
              { label: "WhatsApp", color: "var(--chart-2)" },
              { label: "Referral", color: "var(--chart-3)" },
              { label: "Walk-in", color: "var(--chart-4)" },
              { label: "Other", color: "var(--chart-5)" },
            ]} />
          </figure>

          <figure className="chartframe ticks">
            <figcaption className="cf-h"><h4>Conversion by stage</h4></figcaption>
            <div className="cf-plot">
              <svg viewBox="0 0 260 90" role="img" aria-label="Conversion, a sequential ramp">
                {[1, 2, 3, 4, 5].map((n, i) => (
                  <rect key={n} x={4 + i * 51} y="20" width="46" height="50"
                    fill={"var(--chart-seq-" + n + ")"} rx="2" />
                ))}
              </svg>
            </div>
            <div className="cf-note">
              A ramp encodes magnitude, so it is forest — the panel's own measurement.
            </div>
          </figure>
        </div>
      </Card>
    </div>
  );
}

/* Mounted with the REAL ShellProvider, so a modal, a drawer, a popover and a
   toast in here are the same objects the product raises. MemoryRouter because
   the parts route through ui/nav and nothing in a gallery should navigate. */
createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <ShellProvider>
      <Board />
    </ShellProvider>
  </MemoryRouter>
);
