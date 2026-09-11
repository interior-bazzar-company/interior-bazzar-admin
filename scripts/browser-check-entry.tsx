/* A browser harness for the shell's popover dismiss rule. Mounts the REAL
   ShellProvider and the REAL FaceSwitch, plus a copy of the trigger without
   `data-act`, so the bug and the fix can be observed side by side. */
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ShellProvider, useShell } from "../src/admin/shell/ShellContext";
import { FaceMenu, FaceSwitch } from "../src/admin/views/Team/Work";
import { TodayPlanMenu } from "../src/admin/views/Team/TodayPlan";
import {
  TODAY, isTerminal, planFor, readItems, readMembers,
} from "../src/admin/views/Team/store";

const ids = readMembers().map((m) => m.memberId);
const openTasks = (id: string) => readItems().filter(
  (i) => i.kind === "task" && i.assigneeId === id && !isTerminal(i.status)).length;
/* No plan today AND work actually assigned — without the second condition the
   note opens on "Nothing is assigned to you", the list is empty, and the branch
   this instance exists to drive is not driven. */
const noPlanYet = ids.filter((id) => !planFor(id, TODAY) && openTasks(id) > 0)[0] || ids[0];

/* THE REAL STYLESHEETS. They were spliced out by an over-wide revert and no
   assertion noticed, because every one of them is structural — a selector
   either matches or it does not, styled or not. The screenshots this script
   takes are the half that does notice, and they were of an unstyled page. */
import "../src/styles/admin-theme.css";
import "../src/admin/views/Team/team.css";
/** The trigger exactly as it was before the fix: no `data-act`. */
function BareSwitch() {
  const shell = useShell();
  return (
    <button id="bare" className="btn tb-view-btn" aria-haspopup="menu"
      onClick={(e) => {
        const el = e.currentTarget;
        if (shell.popAnchor === el) { shell.closePop(); return; }
        shell.openPop(el, <FaceMenu face="tasks" view="calendar" goto={() => {}} />,
          { width: 268, align: "right", cls: "pop-views" });
      }}>
      Bare (no data-act)
    </button>
  );
}

createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <ShellProvider>
      <div style={{ padding: 24, display: "flex", gap: 16 }}>
        <span id="fixed"><FaceSwitch face="tasks" view="calendar" goto={() => {}} /></span>
        <BareSwitch />
        {/* The note's contents exist only while it is open, so a rendered string
            never sees them. Both branches are mounted: the signed-in member's
            plan is already in, so a single instance would only ever show the
            read-back half. */}
        <span id="note"><TodayPlanMenu /></span>
        <span id="note-new"><TodayPlanMenu who={noPlanYet} /></span>
      </div>
    </ShellProvider>
  </MemoryRouter>,
);
