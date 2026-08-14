/* Hand-authored. Deliberately loose.
   ---------------------------------------------------------------------------
   The engines are ~6000 lines of untyped ES5 that this phase ports verbatim,
   and the whole layer is replaced by HTTP calls later. Typing it properly would
   be work thrown away, so every namespace is `any` — enough for `strict` TS
   callers to compile, and no more. Do not "improve" this file. */
declare const IBData: any;
declare const IBTeam: any;
declare const IBDeals: any;
declare const IBPlanInfo: any;
declare const IBPlans: any;
declare const IBQuote: any;
declare const IBInvoice: any;

export { IBData, IBTeam, IBDeals, IBPlanInfo, IBPlans, IBQuote, IBInvoice };
