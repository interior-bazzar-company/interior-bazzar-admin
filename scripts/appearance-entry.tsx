/* =============================================================================
   THE APPEARANCE GALLERY — every shared part, in one screen
   -----------------------------------------------------------------------------
   WHY IT EXISTS. Three schemes × two themes is six appearances, and the only
   honest way to know a change is right in all six is to look at all six. Every
   other check in this repo renders to a string; a string cannot tell you that a
   selected row lost its tint in one scheme, or that a chip inside a field is a
   different height from a chip beside it.

   It is NOT a page of the product: it renders the real components out of
   src/admin/ui and the real ShellProvider, with no session, no API and no
   router beyond a MemoryRouter, so it opens instantly and cannot be affected by
   what the backend is doing. `npm run shots` drives it and writes six PNGs.

   ADD A PART HERE THE DAY YOU ADD IT TO THE SYSTEM. A component absent from
   this page is a component nobody has seen in dark, in Portal, or in Beacon.
   ============================================================================= */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ShellProvider, useShell, SCHEMES, currentScheme, setScheme } from "../src/admin/shell/ShellContext";
import { ChipInput, EmptyState, Icon, Notice, Pill, Table, Tiles } from "../src/admin/ui";

import "../src/styles/untitled/globals.css";
import "../src/styles/admin-theme.css";
import "../src/styles/components.css";

function Board() {
  const shell = useShell();
  const [tags, setTags] = useState(["onboarding", "kitchen", "repeat client"]);
  const [scheme, setSchemeState] = useState(currentScheme());

  const openModal = () =>
    shell.modal(
      <>
        <div className="md-h md-hero">
          <span className="md-ic"><Icon name="alert" /></span>
          <div>
            <h3>Remove N. Pillai from Sales?</h3>
            <p>Their 14 open deals move to unassigned. Attendance history stays.</p>
          </div>
          <button className="md-x" aria-label="Close" onClick={shell.closeLayer}><Icon name="x" /></button>
        </div>
        <div className="md-b">
          <div className="fg">
            <label htmlFor="mreason">Reason</label>
            <input className="inp" id="mreason" placeholder="One line is enough" />
          </div>
          <Notice tone="warn" text="Two others in Sales are away this week — a warning, not a block." />
        </div>
        <div className="md-f">
          <button className="btn dgr left" onClick={shell.closeLayer}>Delete record</button>
          <button className="btn" onClick={shell.closeLayer}>Cancel</button>
          <button className="btn pri" onClick={shell.closeLayer}>Remove from team</button>
        </div>
      </>,
      "sm"
    );

  const openDrawer = () =>
    shell.drawer(
      <>
        <div className="dw-h">
          <span className="av">RM</span>
          <div style={{ minWidth: 0 }}>
            <h3>R. Menon</h3>
            <div className="dw-sub">Design · senior · EMP-0155</div>
          </div>
          <button className="dw-x" aria-label="Close" onClick={shell.closeLayer}><Icon name="x" /></button>
        </div>
        <div className="dw-b">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Today</div>
          <Tiles cols={2} list={[
            { k: "Hours", v: "6.1", delta: { dir: "up", text: "0.3", of: "vs last week" } },
            { k: "Tasks closed", v: "2", foot: <span className="pill warn">Break 1h 12m</span> },
          ]} />
          <div className="eyebrow" style={{ margin: "18px 0 10px" }}>Recent</div>
          <Notice tone="info" text="Absent is computed from the roster, never stored." />
        </div>
        <div className="dw-f">
          <span className="spacer" />
          <button className="btn" onClick={shell.closeLayer}>Open profile</button>
          <button className="btn pri" onClick={shell.closeLayer}>Close their day</button>
        </div>
      </>,
      undefined,
      "md"
    );

  return (
    <div className="page" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: 700, letterSpacing: "-.02em" }}>
            Appearance
          </h1>
          <div className="ap-hint">Every shared part, drawn in the scheme and theme selected.</div>
        </div>
        <span className="spacer" style={{ flex: 1 }} />
        <label className="ap-row" style={{ minWidth: 260 }}>
          <span className="ap-l">Scheme</span>
          <select className="ap-select" value={scheme}
            onChange={(e) => { setScheme(e.target.value); setSchemeState(e.target.value); }}>
            {SCHEMES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </header>

      <section className="card" style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Actions</div>
        <div className="toolbar">
          <button className="btn pri">Approve leave</button>
          <button className="btn brand">Open the portal</button>
          <button className="btn">Save draft</button>
          <button className="btn dgr">Delete</button>
          <button className="btn" disabled>Disabled</button>
          <button className="btn sm">Small</button>
          <button className="btn icon" aria-label="More"><Icon name="dots" /></button>
          <button className="btn" onClick={openModal}>Open modal</button>
          <button className="btn" onClick={openDrawer}>Open drawer</button>
          <button className="btn" onClick={() => shell.toast("Leave approved")}>Toast</button>
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Fields — one of them holds a list</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="fg">
            <label htmlFor="g1">Member</label>
            <input className="inp" id="g1" defaultValue="N. Pillai" />
          </div>
          <div className="fg">
            <label htmlFor="g2">Employee ID</label>
            <input className="inp mono" id="g2" defaultValue="EMP-0142" readOnly />
            <div className="help">Read-only — set when the account was created.</div>
          </div>
          <div className="fg" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="g3">Tags</label>
            <ChipInput id="g3" value={tags} onChange={setTags}
              placeholder={tags.length ? "Add another" : "Type a tag and press Enter"} />
            <div className="help">Enter or a comma commits. Backspace takes the last one back.</div>
          </div>
          <div className="fg">
            <label htmlFor="g4">Pincode</label>
            <input className="inp bad" id="g4" defaultValue="41007" aria-invalid="true" />
            <div className="help bad">Needs 6 digits. Yours has 5.</div>
          </div>
          <div className="fg">
            <label htmlFor="g5">Reason</label>
            <textarea className="inp" id="g5" rows={2} defaultValue="Family function, out of town" />
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Status, and the live accent</div>
        <div className="chiprow">
          <Pill text="Paid" tone="ok" />
          <Pill text="Awaiting approval" tone="warn" />
          <Pill text="Overdue 12d" tone="bad" />
          <Pill text="Auto-derived" tone="info" />
          <Pill text="Current" tone="brand" />
          <Pill text="Draft" />
          <span className="pill pill-live"><span className="live-dot" /> On shift</span>
          <span className="chip on">Team: Sales<button className="x" aria-label="Remove"><Icon name="x" size="sm" /></button></span>
        </div>
      </section>

      <section>
        <Tiles list={[
          { k: "On shift now", v: <>28<span className="u">/34</span></>, foot: <span className="pill pill-live"><span className="live-dot" /> live</span> },
          { k: "Avg hours / day", v: "7.4", delta: { dir: "up", text: "0.3", of: "vs last week" } },
          { k: "Unclosed days", v: "11", delta: { dir: "down", text: "4", of: "vs last week" } },
          { k: "Collection due", v: <>₹22.4<span className="u">L</span></>, foot: <span className="pill warn">6 overdue</span> },
        ]} />
      </section>

      <section className="card" style={{ padding: 16 }}>
        <div className="bulkbar">
          <span className="n">2 selected</span>
          <span className="spacer" />
          <button className="btn sm">Close their day</button>
          <button className="btn sm">Export selection</button>
        </div>
        <Table
          cols={[
            { label: "", w: "24px" },
            { label: "Member" },
            { label: "Team" },
            { label: "Status" },
            { label: "Hours", cls: "r" },
            { label: "Tasks", cls: "r" },
          ]}
          rows={[
            <tr aria-selected="true">
              <td><span className="sev bad" /></td>
              <td><b>N. Pillai</b></td><td>Sales</td>
              <td><Pill text="Unclosed 2d" tone="bad" /></td>
              <td className="num">9.6</td><td className="num">4</td>
            </tr>,
            <tr aria-selected="true">
              <td><span className="sev warn" /></td>
              <td><b>R. Menon</b></td><td>Design</td>
              <td><Pill text="Break 1h 12m" tone="warn" /></td>
              <td className="num">6.1</td><td className="num">2</td>
            </tr>,
            <tr>
              <td><span className="sev live" /></td>
              <td><b>S. Iyer</b></td><td>Sales</td>
              <td><span className="pill pill-live"><span className="live-dot" /> On shift</span></td>
              <td className="num">4.2</td><td className="num">3</td>
            </tr>,
            <tr>
              <td><span className="sev" /></td>
              <td><b>K. Fernandes</b></td><td>Support</td>
              <td><Pill text="On leave" tone="info" /></td>
              <td className="num none">—</td><td className="num none">—</td>
            </tr>,
          ]}
        />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Feedback</div>
          <Notice tone="ok" text="Day closed for 31 of 34. 3 are still on shift." />
          <Notice tone="warn" text="4 leave requests older than 3 days. Waiting on you." />
          <Notice tone="bad" text="Attendance could not load. Nothing was changed." />
          <Notice tone="info" text="Absent is computed, never stored." />
        </div>
        <div className="card" style={{ padding: 16 }}>
          <EmptyState icon="calendar" title="No leave requests waiting"
            body="Everything your team asked for is decided."
            action={<button className="btn sm">View decided</button>} />
        </div>
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <ShellProvider>
      <Board />
    </ShellProvider>
  </MemoryRouter>
);
