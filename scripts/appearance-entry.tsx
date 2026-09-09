/* =============================================================================
   THE APPEARANCE GALLERY — every shared part, in one screen, both themes
   -----------------------------------------------------------------------------
   It renders the real parts out of src/admin/ui and the real ShellProvider,
   with no session, no API and no router beyond a MemoryRouter, so it opens
   instantly and cannot be affected by what the backend is doing. `npm run
   shots` drives it and writes the PNGs (.tmp/appearance/).

   ADD A PART HERE THE DAY YOU ADD IT TO THE SYSTEM. A component absent from
   this page is a component nobody has seen in dark.
   ========================================================================== */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "../src/styles/globals.css";
import { ShellProvider, bootAppearance, useShell } from "../src/admin/shell/ShellContext";
import {
  ActivityFeed, Alert, Assignee, Avatar, Breadcrumbs, Button, Card, ChartFrame, Checkbox, ChipInput, ConfirmModal, DateRange, DealStatus, Delta,
  DrawerShell, EmptyState, Eyebrow, FieldRow, FilterBar, FilterChips, FormField, FormSection, IconButton, InfoDot, Input, InputGroup, KvList, LeadStatus,
  ListSkeleton, ListTable, Meter, ModalShell, MoreMenu, MultiSelect, PageHeader, Pagination, PaneLoading, Person, Pill, Pipeline, Priority, Radio, Rail,
  SearchField, SectionHead, Segmented, Select, SelectInput, StatStrip, Table, Tabs, Tag, Tags, Textarea, Tile, Tiles, Timeline, Toggle, Tooltip,
} from "../src/admin/ui";
import { BarRows, ColumnChart, FunnelChart, SignedColumns, Spark, Waterfall } from "../src/admin/views/charts";

function Layers() {
  const shell = useShell();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        color="secondary"
        onClick={() =>
          shell.modal(
            <ConfirmModal title="Remove N. Pillai from Sales?" body="They keep their account and their history; only the Sales grant is withdrawn. This can be re-granted later." verb="Remove" tone="bad" onConfirm={shell.closeLayer} onClose={shell.closeLayer} />,
            "sm",
          )
        }
      >
        Open modal
      </Button>
      <Button
        color="secondary"
        onClick={() =>
          shell.drawer(
            <DrawerShell title="R. Menon" sub="Sales · joined Mar 2025" mark={<Avatar name="R. Menon" lg />} onClose={shell.closeLayer} actions={<Button color="primary">Save</Button>}>
              <KvList pairs={[["Role", "Sales executive"], ["Department", "Sales"], ["Phone", <span className="font-mono">+91 98 4500 1122</span>], ["Status", <Pill tone="ok" dot text="Active" />]]} />
              <SectionHead title="Recent" className="mt-6" />
              <Timeline items={[{ title: "Closed IB-D-1042", meta: "Today · 11:20", tone: "ok" }, { title: "Stage moved to Followup", meta: "Yesterday", tone: "sys", body: "Automatic — the slot was booked." }]} />
            </DrawerShell>,
            undefined,
            "md",
          )
        }
      >
        Open drawer
      </Button>
      <Button color="secondary" onClick={() => shell.toast("Saved. The change is live.", "ok")}>
        Toast
      </Button>
      <Button color="secondary" onClick={() => shell.banner("The ledger service is slow right now — figures may be a minute behind.", "warn")}>
        Banner
      </Button>
    </div>
  );
}

function Gallery() {
  const [seg, setSeg] = useState("table");
  const [on, setOn] = useState(true);
  const [chips, setChips] = useState(["onboarding", "sales"]);
  const [multi, setMulti] = useState(["north"]);
  const [range, setRange] = useState<[string, string]>(["2026-09-01", "2026-09-09"]);
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 p-8">
      <PageHeader
        title="Appearance"
        eyebrow="Every shared part"
        meta={
          <>
            <span>Both themes · the real components</span>
            <Pill tone="brand" dot text="live" />
          </>
        }
        actions={
          <>
            <Button color="secondary" ico="download">
              Export
            </Button>
            <Button color="primary" ico="plus">
              New record
            </Button>
          </>
        }
        tabs={<Tabs items={[{ k: "a", label: "Parts" }, { k: "b", label: "Patterns", n: 3 }, { k: "c", label: "Charts", icon: "chart" }]} cur="a" />}
      />

      <Card title="Layers" sub="A toast confirms · a modal decides · a drawer inspects · a banner stays.">
        <Layers />
      </Card>

      <Card title="Actions" sub="One primary per view; the rest secondary or tertiary. xs in a row, sm elsewhere, lg on the door.">
        <div className="flex flex-wrap items-center gap-2">
          <Button color="primary">Primary</Button>
          <Button color="secondary">Secondary</Button>
          <Button color="tertiary">Tertiary</Button>
          <Button color="link-color">Link</Button>
          <Button color="primary-destructive">Delete</Button>
          <Button color="secondary-destructive">Remove</Button>
          <Button color="primary" isLoading>
            Saving
          </Button>
          <Button color="secondary" isDisabled>
            Disabled
          </Button>
          <Button color="secondary" size="xs" ico="download">
            xs
          </Button>
          <Button color="primary" size="lg" ico="plus">
            lg
          </Button>
          <IconButton ico="edit" label="Edit" />
          <IconButton ico="trash" label="Delete" color="secondary" />
          <MoreMenu items={[{ icon: "edit", label: "Edit", act: () => {} }, { icon: "copy", label: "Duplicate", act: () => {} }, { icon: "trash", label: "Delete", act: () => {}, tone: "bad" }]} />
          <Segmented value={seg} onPick={setSeg} options={[{ v: "table", l: "Table", ico: "list" }, { v: "board", l: "Board", ico: "columns" }, { v: "chat", l: "Chat", ico: "chat" }]} />
        </div>
      </Card>

      <Card title="Form controls" sub="Label above, always. Error or hint, never both.">
        <FormSection>
          <FieldRow cols={3}>
            <FormField id="a1" label="Customer" req>
              <Input id="a1" ph="Full name" />
            </FormField>
            <FormField id="a2" label="Phone" hint="Ten digits">
              <Input id="a2" ph="98 4500 1122" mono />
            </FormField>
            <FormField id="a3" label="Email" err="Needs an @ — yours has none.">
              <Input id="a3" defaultValue="priya.nair" err />
            </FormField>
          </FieldRow>
          <FieldRow cols={3}>
            <FormField id="a4" label="Amount">
              <InputGroup pre="₹" post="/mo">
                <Input id="a4" defaultValue="4,20,000" mono />
              </InputGroup>
            </FormField>
            <FormField id="a5" label="Stage">
              <SelectInput id="a5" options={["Deal", "Followup", "Slot booked", "Won"]} defaultValue="Followup" />
            </FormField>
            <FormField id="a6" label="Period">
              <DateRange from={range[0]} to={range[1]} onChange={(f, t) => setRange([f, t])} />
            </FormField>
          </FieldRow>
          <FieldRow>
            <FormField id="a7" label="Tags">
              <ChipInput id="a7" value={chips} onChange={setChips} placeholder="Add a tag" />
            </FormField>
            <FormField label="Regions">
              <MultiSelect label="Region" options={[{ v: "north", l: "North" }, { v: "south", l: "South" }, { v: "west", l: "West" }]} value={multi} onChange={setMulti} />
            </FormField>
          </FieldRow>
          <FormField id="a8" label="Notes" hint="Visible to the team, never to the customer.">
            <Textarea id="a8" ph="What was discussed…" rows={3} />
          </FormField>
          <div className="flex flex-wrap items-center gap-6">
            <Checkbox label="Send a copy" hint="To the customer's email" checked={on} onChange={setOn} />
            <Checkbox label="Some selected" indeterminate />
            <Radio name="r" value="a" label="Monthly" checked />
            <Radio name="r" value="b" label="Yearly" />
            <Toggle on={on} onChange={setOn} label="Auto-renew" />
          </div>
        </FormSection>
      </Card>

      <Card title="Status" sub="A state is rounded and carries a dot; a label a person typed is square; the filter chip alone wears the brand.">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="ok" dot text="Paid" />
            <Pill tone="warn" dot text="Overdue" />
            <Pill tone="bad" dot text="Failed" />
            <Pill tone="info" dot text="In progress" />
            <Pill tone="neutral" dot text="Draft" />
            <Pill tone="brand" text="Current" />
            <Pill tone="live" dot text="On shift" />
            <Pill tone="sys" dot text="Automation" />
            <Pill tone="dead" text="Cancelled" />
            <LeadStatus status="qualified" />
            <DealStatus status="won" />
            <Priority level="urgent" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tag label="kitchen" tone="teal" />
            <Tag label="Premium" tone="violet" />
            <Tag label="Generic funnel" tone="orange" auto />
            <Tag label="chase this" tone="red" onRemove={() => {}} />
            <Tags items={[{ label: "a" }, { label: "b", tone: "blue" }, { label: "c" }, { label: "d" }]} max={2} />
          </div>
          <FilterChips params={{ stage: "Followup", owner: "R. Menon" }} labels={{ stage: "Stage", owner: "Owner" }} onUnfilter={() => {}} />
        </div>
      </Card>

      <Card title="CRM" sub="Where the deal is, who owns it, and how far along.">
        <div className="flex flex-col gap-4">
          <Pipeline stages={[{ k: "deal", label: "Deal" }, { k: "followup", label: "Followup" }, { k: "slot", label: "Slot booked" }, { k: "won", label: "Won" }]} current="slot" />
          <div className="flex flex-wrap items-center gap-6">
            <Person name="Priya Nair" sub="Sales executive" />
            <Person name="Jaswant Kaul" sub="Ops" sm to="#/team/1" />
            <Assignee name={null} />
            <Avatar name="Asha Rao" xl />
            <div className="w-56">
              <Meter value={64} />
            </div>
            <Delta value="11%" dir="up" of="vs last week" />
            <Delta value="3 days" dir="up" good={false} of="unclosed" />
          </div>
        </div>
      </Card>

      <Card title="A list" sub="Filters, the strip, the table, the pager — the four bands." flush>
        <div className="flex flex-col gap-4 p-5">
          <FilterBar
            search={<SearchField ph="Search deals…" />}
            filters={
              <>
                <Select name="stage" label="Stage" value="followup" options={[{ v: "deal", l: "Deal", dot: "info" }, { v: "followup", l: "Followup", dot: "warn" }, { v: "won", l: "Won", dot: "ok" }]} />
                <Select name="owner" label="Owner" options={["Priya Nair", "R. Menon"]} />
                <Select name="tier" label="Tier" options={[{ v: "a", l: "Tier A", badge: "A" }, { v: "b", l: "Tier B", badge: "B" }]} />
              </>
            }
            right={<Segmented sm value={seg} onPick={setSeg} options={[{ v: "table", l: "Table" }, { v: "board", l: "Board" }]} />}
          />
          <StatStrip cells={[{ k: "open", v: 24, to: "#/x", on: true }, { k: "followup", v: 9, dot: "warn", to: "#/y" }, { k: "won", v: 12, dot: "ok", to: "#/z" }, "sep", { k: "pipeline", v: "₹42.1L" }, { k: "collected", v: "₹7.4L", tone: "ok" }]} />
          <ListTable
            head={
              <tr>
                <th className="rail" />
                <th>Deal</th>
                <th>Stage</th>
                <th>Owner</th>
                <th className="n">Value</th>
                <th>Next</th>
                <th className="acts" />
              </tr>
            }
          >
            {[
              ["IB-D-1042", "Sharma residence", "followup", "warn", "Priya Nair", "₹4,20,000", "Today"],
              ["IB-D-1039", "Café Nine, Indiranagar", "won", undefined, "R. Menon", "₹11,80,000", "—"],
              ["IB-D-1031", "Verma 3BHK", "deal", "bad", "Jaswant Kaul", "₹2,10,000", "3 days late"],
            ].map((r) => (
              <tr key={r[0]} className="clickable">
                <Rail tone={r[3] as string} />
                <td className="cell-1">
                  {r[1]}
                  <div className="cell-2 font-mono">{r[0]}</div>
                </td>
                <td>
                  <DealStatus status={r[2] as string} />
                </td>
                <td>
                  <Person name={r[4] as string} sm />
                </td>
                <td className="n">{r[5]}</td>
                <td className={r[3] === "bad" ? "text-error-primary" : ""}>{r[6]}</td>
                <td className="acts">
                  <IconButton ico="dots" label="More" size="xs" />
                </td>
              </tr>
            ))}
          </ListTable>
          <Pagination page={2} pages={9} total={241} pageSize={30} onPage={() => {}} />
        </div>
      </Card>

      <Tiles
        list={[
          { k: "Collected", v: "₹7.38L", s: "7 payments in", delta: { dir: "up", text: "150%", of: "vs prev 30d" }, icon: "cash" },
          { k: "Pipeline", v: "₹42.1L", s: "24 open deals", delta: { dir: "down", text: "4%", of: "vs prev 30d" } },
          { k: "Unclosed days", v: "3", tone: "warn", delta: { dir: "up", text: "+2", of: "this week", good: false } },
          { k: "Conversion", v: "38%", to: "#/deals", foot: <Pill xs tone="ok" text="on target" /> },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Conditions" sub="Still true. A toast is a receipt; this is a state.">
          <div className="flex flex-col gap-3">
            <Alert tone="ok" title="Payroll for August is settled">
              22 slips issued, none outstanding.
            </Alert>
            <Alert tone="warn" title="Two members are unclosed" action={<Button size="xs" color="secondary">Review</Button>}>
              Yesterday's day is still open for J. Kaul and S. Saifi.
            </Alert>
            <Alert tone="bad" title="Could not reach the ledger service" onClose={() => {}}>
              Nothing was changed. Try again in a moment.
            </Alert>
            <Alert tone="info">Seed sections run on their own clock.</Alert>
          </div>
        </Card>
        <Card title="Explanations" sub="A tooltip labels; the dot explains.">
          <div className="flex flex-wrap items-center gap-6">
            <Tooltip tip="Refresh the ledger">
              <IconButton ico="refresh" label="Refresh" />
            </Tooltip>
            <span className="inline-flex items-center gap-1.5 text-sm text-secondary">
              Collected
              <InfoDot>
                <b>Collected</b>
                <p>Every receipt recorded against an invoice in the period, net of reversals.</p>
              </InfoDot>
            </span>
            <Eyebrow>Executive snapshot</Eyebrow>
            <Breadcrumbs items={[{ label: "Sales", to: "#/deals" }, { label: "Deals", to: "#/deals" }, { label: "IB-D-1042" }]} />
          </div>
        </Card>
        <Card title="Waiting, and nothing there" sub="A skeleton keeps the shape; an empty state is dashed.">
          <div className="flex flex-col gap-4">
            <ListSkeleton rows={2} />
            <PaneLoading label="Loading the record…" />
            <EmptyState icon="search" title="No enquiries match those filters" body="Try clearing the city filter — it excludes 14." action={<Button color="secondary" size="sm">Clear filters</Button>} />
          </div>
        </Card>
        <Card title="What happened" sub="To a record (timeline) and across the panel (feed).">
          <div className="grid gap-6 sm:grid-cols-2">
            <Timeline
              items={[
                { title: "Payment received", body: "₹1,20,000 against INV-0091", meta: "Today · 11:20", tone: "ok" },
                { title: "Stage moved to Followup", meta: "Yesterday", tone: "sys" },
                { title: "Quotation revised to v2", meta: "3 Sep" },
                { title: "Delivery failed", body: "Business did not acknowledge", meta: "1 Sep", tone: "bad" },
              ]}
            />
            <ActivityFeed items={[{ who: "Priya Nair", what: "closed IB-D-1042", when: "11:20" }, { who: "Jaswant Kaul", what: "reassigned E-2044 to Studio Kanva", when: "10:02" }, { ico: "sparkle", what: "The matching run found 3 businesses", when: "09:40" }]} />
          </div>
        </Card>
      </div>

      <Card title="Data visualisation" sub="Series one is the brand; status colours are never a series.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartFrame title="Members by month" legend={[{ label: "New", color: "var(--color-chart-1)" }, { label: "Renewed", color: "var(--color-chart-2)" }]}>
            <ColumnChart
              series={[{ key: "new", label: "New", slot: 1 }, { key: "ren", label: "Renewed", slot: 2 }]}
              points={["Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((m, i) => ({ key: m, label: m, values: { new: 40 + i * 12, ren: 20 + i * 5 } }))}
              unit="members"
              labelSeries="new"
            />
          </ChartFrame>
          <ChartFrame title="August, from nothing to closing">
            <Waterfall steps={[{ key: "c", label: "Collected", value: 738, kind: "in", display: "₹7.38L" }, { key: "o", label: "Other in", value: 60, kind: "in", display: "₹0.6L" }, { key: "s", label: "Salaries", value: 310, kind: "out", display: "₹3.1L" }, { key: "x", label: "Spend", value: 120, kind: "out", display: "₹1.2L" }, { key: "t", label: "Closing", value: 0, kind: "total", display: "₹3.68L" }]} unit="₹ lakh" />
          </ChartFrame>
          <ChartFrame title="Net by month">
            <SignedColumns points={[12, -4, 18, 22, -9, 31, 14, 27, -3, 40, 36, 44].map((v, i) => ({ key: String(i), label: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i], value: v }))} unit="₹ lakh" />
          </ChartFrame>
          <ChartFrame title="Enquiry funnel">
            <FunnelChart stages={[{ key: "n", label: "New", value: 240 }, { key: "q", label: "Qualified", value: 180 }, { key: "a", label: "Assigned", value: 122 }, { key: "c", label: "Converted", value: 41 }]} unit="enquiries" />
          </ChartFrame>
          <ChartFrame title="Deals by owner" ticks={false}>
            <BarRows rows={[{ key: "p", label: <Person name="Priya Nair" sm />, value: 14, hint: "₹18.2L" }, { key: "r", label: <Person name="R. Menon" sm />, value: 9, hint: "₹11.0L", tone: "s2" }, { key: "j", label: <Person name="Jaswant Kaul" sm />, value: 4, hint: "₹3.1L", tone: "s3" }]} unit="open deals" />
          </ChartFrame>
          <Card title="Sparklines" tight>
            <div className="flex items-center gap-6">
              <Spark values={[3, 5, 4, 8, 7, 11, 10, 14]} tone="s1" label="Collected, 8 weeks" />
              <Spark values={[9, 8, 8, 6, 7, 5, 4, 3]} tone="s2" label="Spend, 8 weeks" />
              <Tile k="Inline" v="₹1.2L" delta={{ dir: "up", text: "8%" }} className="w-44" />
            </div>
          </Card>
        </div>
        <div className="mt-4">
          <Table cols={[{ label: "Plan" }, { label: "Members", cls: "n" }, { label: "MRR", cls: "n" }, { label: "Status" }]} rows={[<tr key="1"><td className="t">Starter</td><td className="n">142</td><td className="n">₹2,84,000</td><td><Pill tone="ok" dot text="Active" /></td></tr>, <tr key="2"><td className="t">Growth</td><td className="n">38</td><td className="n">₹3,04,000</td><td><Pill tone="ok" dot text="Active" /></td></tr>, <tr key="3"><td className="t">Legacy</td><td className="n">6</td><td className="n">₹18,000</td><td><Pill tone="dead" text="Retired" /></td></tr>]} />
        </div>
      </Card>
    </div>
  );
}

bootAppearance();
createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <ShellProvider>
      <Gallery />
    </ShellProvider>
  </MemoryRouter>,
);
