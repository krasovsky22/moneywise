# Epic 09 — Dashboard & Overview

## Goal

A single landing page that ties the system together. Within 5 seconds of opening Moneywise, the user should know:

1. **How much money is left** this cycle (Epic 08's number, prominently).
2. **What bills are coming due** and when.
3. **Where the spending is going** this cycle.
4. **What needs the user's attention** (statements to review, income to confirm).

## Personas

- **Daily user** — quick check-in on phone or laptop.
- **Weekly reviewer** — clicks through to transactions / categories.
- **New user** — uses the dashboard to learn what the app does.

## In scope (MVP)

The dashboard is composed of widgets, top to bottom, in roughly this priority:

1. **Money Left this cycle** — big colored number; hover/click for formula breakdown (Epic 08).
2. **Bills due this cycle** — list of cards with unpaid statements in this cycle, sorted by due date. Each row: card chip, statement period, amount, due date, "Mark paid" button.
3. **Attention** — small section showing:
    - Statements awaiting review (link to review queue).
    - Expected income not yet received and past due (e.g., "Acme payroll was expected 3 days ago").
    - Statements that failed to process.
4. **Spending this cycle** — a category-rollup view (donut + ranked list of top categories by amount).
5. **Recent transactions** — last 10 transactions across all cards (link to full list).
6. **Cards at a glance** — a card grid showing each card with current cycle pending total and last-statement amount.
7. **Income this cycle** — expected vs. received summary; link to Income page.

A cycle picker at the top toggles which cycle the dashboard reflects.

## Out of scope (MVP — defer)

- Customizable widget layout (V2).
- Comparisons / trend lines across cycles (V1).
- AI-generated insights (V2).
- Forecasts beyond the current cycle (V1).
- Per-member spending views (V1 — uses the household privacy work).

## User stories

- As a member I want to open Moneywise and immediately see "money left" without scrolling.
- As a member I want to scan all the bills coming due so nothing surprises me.
- As a member I want to click a category in the donut to see the underlying transactions.
- As a member I want a clear list of "needs my attention" so I know what to do.

## Key flows

### Land on dashboard
- After login, route is `/secure/dashboard`.
- Default cycle: current calendar month.
- Loading state: skeleton widgets, never empty screen.

### Drill-down
- Click on a category in the donut → navigate to Transactions filtered by that category and cycle.
- Click on a card chip → navigate to that card's detail (transactions filtered to that card).
- Click a "bills due" row → opens the statement detail.

### Empty states
- Brand-new household with no cards: show a friendly onboarding card guiding them to add a card.
- Cards but no statements: show a card guiding them to upload their first statement.
- No income yet: show a card explaining manual income setup.

### Mobile layout
- Stack widgets vertically.
- Money-left number stays the hero; everything else collapses sensibly.

## Data model implications

No new entities. The dashboard is read-only over aggregations from prior epics.

## API surface (high-level)

A small number of **purpose-built endpoints** the dashboard calls in parallel:

- Get money-left summary (current cycle).
- Get bills-due summary.
- Get attention items (statements pending review, missed income, failed statements).
- Get category-rollup for cycle.
- Get recent transactions (limit 10).
- Get card-at-a-glance summary.
- Get income summary for cycle.

These are derived endpoints (no new tables) tuned for the dashboard. Reusing the generic Transactions list endpoint would be wasteful per-widget.

## Acceptance criteria

- The dashboard renders fully in under 1.5 s on a typical broadband connection with 5,000 transactions.
- Every widget links to the deeper view it summarizes.
- Empty states never look broken — each suggests the next action.
- Cycle picker works for any past cycle; future cycles are disabled.
- Color usage is consistent with the category color system (Epic 05).

## Risks & open questions

- **Information overload:** too many widgets dilutes the headline. Stay disciplined — only the top three widgets should be visible without scrolling.
- **Cycle = calendar month default:** simple, but it doesn't align with anyone's card cycles. We're intentionally diverging from card cycles for household-level reporting; per-card cycles are still surfaced in the card grid.
- **Mobile-first vs. desktop-first:** MVP is desktop-first responsive. Real users likely live on phones — revisit in V1 with telemetry.
- **Caching:** the dashboard reads a lot. Server-side caching of cycle aggregations (with invalidation on transaction/payment writes) is likely required to hit the 1.5 s target. Decided in tech spec.

## Dependencies

- Blocked by: every other MVP epic. This is the integration epic.
- Blocks: nothing — but its quality determines whether MVP "feels done."
