# Epic F02 — AI Budget Recommendations (V2)

## Goal

Move Moneywise from descriptive to **prescriptive**: given the household's spending history, surface concrete, household-specific suggestions to reduce spending, project potential savings, and produce a plan for next month.

## Personas

- **Goal-oriented member** — already trying to budget; wants help finding cuts.
- **Couples discussing finances** — wants neutral, data-backed prompts to talk about together.

## In scope (V2)

- Monthly **AI insights** report: 5–10 specific, actionable observations such as:
  - *"You spent $84 more on rideshares in May than your 6-month average. Setting a $200 monthly cap would save ~$50/month."*
  - *"Three subscriptions account for 60 % of your Entertainment spending. Pausing the least-used could save $35/month."*
- **Projected savings** number for each recommendation.
- **"Plan for next month"** — assembled from the user-accepted recommendations into a simple budget per category, with progress tracking through the month.
- **Recommendation history** — see which ones the user accepted, dismissed, or tried.
- **Tone control** — neutral by default, "tougher" optional, "encouraging" optional. Money is emotional; tone matters.

## Out of scope (V2 — defer)

- Hard limits / blocking spending (V3+ if ever — we don't move money).
- Negotiating bills on the user's behalf (V3+).
- Comparison to other households' aggregate spending (privacy can of worms; V3+).
- Investment / wealth-building advice — explicitly out, regulatory risk.

## User stories

- As a member I want monthly bite-sized recommendations grounded in *my* data, not generic blog tips.
- As a couple we want to skim a single page and pick 2–3 things to try next month.
- As a member I want to see whether last month's plan actually saved us money.

## Key flows

### Monthly insights generation
- Triggered on cycle close (start of next cycle).
- Backend job aggregates last cycle + prior baseline (rolling 6 months); LLM generates structured recommendations with projected savings.
- Stored as `Recommendation` records.

### Review insights
- Dashboard banner: "Your May insights are ready."
- Insights page: cards listing each recommendation. User can **accept**, **dismiss**, or **save for later**.
- Accepted recommendations roll into the next-month plan.

### Plan for next month
- Page showing: target spending per category, progress so far this cycle, "money left" implication.
- Mid-cycle nudges when a category is at risk of overspend (e.g., 80 % through budget at 50 % through cycle).

### Plan retrospective
- At cycle close, "How did we do?" page comparing plan vs. actual.

## Data model implications

- `Recommendation` — id, household_id, cycle_id, kind (enum: reduce_category, cancel_subscription, etc.), title, body, projected_savings_amount, status (proposed, accepted, dismissed, expired), accepted_at, created_at, model_used, model_cost_cents.
- `CycleBudget` — id, household_id, cycle_id, category_id, target_amount, source (ai_recommendation / user / template).
- `CycleBudgetActual` — derived per request.

## API surface (high-level)

- Generate insights for a cycle (manual trigger or auto).
- List recommendations (filterable by status).
- Accept / dismiss recommendation.
- Get current cycle plan.
- Get plan retrospective for a cycle.

## Acceptance criteria

- Generated recommendations are grounded in real transactions (every claim cites concrete data).
- ≥ 50 % of recommendations are rated useful by user feedback ("thumbs up").
- Plan tracking matches actual spending exactly (no double-counting splits, no off-by-one across cycle boundaries).

## Risks & open questions

- **Quality and trust of recommendations.** Mediocre advice is worse than no advice. Heavily prompt-engineer + validate before exposing.
- **Tone & condescension.** "Stop buying coffee" is the lowest form of money advice and well-deserved internet hate. Train guardrails into the prompt.
- **Cost.** Monthly generation per household at LLM rates — model selection and aggressive caching of summarized inputs are essential.
- **Privacy.** Sending an entire spending history to an LLM provider must remain under a zero-retention agreement.
- **Mis-attribution.** If categories are wrong, the recommendation is wrong. F02 quality depends on Epic 05 quality.

## Dependencies

- Blocked by: MVP epics 04, 05, 06 (need clean, categorized data).
- Strongly improved by: F01 (denser, more reliable data).
- Blocks: F03 (allocation), which builds on the plan.
