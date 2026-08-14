/* =============================================================================
   Admin engines — load order.
   -----------------------------------------------------------------------------
   Verbatim port of the prototype's logic layer. Each file is byte-for-byte the
   prototype original plus an appended `export`; the IIFEs still attach to
   `window` because the engines look each other up as `root.IBData`,
   `root.IBDeals`, ... at runtime, and several of them do real work at load
   (seeding, draining outboxes, reconciling back into Module 1).

   The order below mirrors admin-access.html exactly. It is not cosmetic:
     - team-engine   reads IBData.TeamStore
     - deals-engine  projects from IBData
     - ib-plan-info  is read by plans-engine and quotation-engine for pricing
     - quotation/invoice call IBDeals.Sync.reconcile() at the bottom of their
       own IIFE, so IBDeals must already exist
     - guards        wraps the finished namespaces in place, so it goes last
   ES module imports evaluate in declaration order, which is what preserves it.

   These get replaced by HTTP calls in a later phase. Do not build on top of the
   `window` globals; import from here.
   ========================================================================== */
import { IBData } from './admin-data.js';
import { IBTeam } from './team-engine.js';
import { IBDeals } from './deals-engine.js';
import { IBPlanInfo } from './ib-plan-info.js';
import { IBPlans } from './plans-engine.js';
import { IBQuote } from './quotation-engine.js';
import { IBInvoice } from './invoice-engine.js';
import './guards.js';

export { IBData, IBTeam, IBDeals, IBPlanInfo, IBPlans, IBQuote, IBInvoice };
