# Epic 08 — Cashflow & "Money Left"

## Goal

Compute and display the **flagship number**: how much money the household has left after paying credit-card bills this cycle. This number must be:

1. **Defined precisely** (one formula, written down, visible to the user).
2. **Trustworthy** (no silent assumptions; data freshness obvious).
3. **Actionable** (clear what changes it).

This is the headline metric for the dashboard (Epic 09). Everything else exists to make this number correct.

## Personas

- **Anyone in the household** — checks the number weekly or daily.
- **Decision-maker** — uses the number to decide whether to make a big purchase, hold off, or save.

## In scope (MVP)

- A canonical formula, computed server-side, for **"Money left this cycle"**:

  ```
  money_left_this_cycle
      = income_received_this_cycle
      + income_expected_this_cycle_remaining
      - amount_due_on_open_statements
      - charges_posted_this_cycle_not_yet_billed
  ```

  Where:
  - `income_received_this_cycle` — sum of `IncomeOccurrence` with status `received` whose `actual_date` falls in the current household cycle.
  - `income_expected_this_cycle_remaining` — sum of expected occurrences with status `expected` whose `expected_date` is in the current household cycle and is in the future or today.
  - `amount_due_on_open_statements` — for every card with an unpaid statement whose `payment_due_day` is in the current cycle, the statement's parsed total.
  - `charges_posted_this_cycle_not_yet_billed` — transactions on each card whose date is after that card's last statement close — i.e., charges accruing toward the next bill.

  This is a **deliberately conservative** definition: it subtracts not just the bills we owe now, but the bills that are accumulating, so the user knows what's truly available.

- A **"household cycle"** concept: a calendar month (1st – last day) by default. The current cycle is the one containing today. Users can flip the dashboard to view past cycles.

- Per-card view: each card shows
  - Last statement total (if any) and its due date.
  - Statement status: `unpaid`, `paid` (user-marked), `overdue`.
  - Pending charges since last close.

- Per-cycle history: a simple table of past cycles with income / spending / "money left at end of cycle."

- Manual **"Mark statement paid"** action. We do not actually move money; this just toggles the flag so it stops counting against money-left.

## Out of scope (MVP — defer)

- Auto-detection of bill payment (would require bank sync — V1).
- Partial payments on a statement (V1).
- Forecasting beyond the current cycle (V1 — "next 3 months projection").
- "What if" sandbox (V2 — "what if we cut dining by 20 %").
- Multi-currency.
- Cash-on-hand tracking — MVP does not subtract cash transactions because we don't model a cash balance.

## User stories

- As a member I want one number that answers "can I make a $300 purchase right now?"
- As a member I want to hover on the number and see the formula so I trust it.
- As a member I want to mark statements as paid so they stop counting against my available money.
- As a member I want to scroll back to last cycle and see how we did.
- As a member I want to see which cards are "open" (accumulating charges) and which are "settled."

## Key flows

### View dashboard money-left (drives Epic 09)
- Big number, color-coded (green if positive, red if negative), with sub-line "+$X expected this week" if expected income is still pending.
- Hover or click → formula popover with each component as a line item.

### Mark statement paid
- On the dashboard's "Bills due this cycle" widget, each statement has a **"Mark paid"** button.
- Confirm with optional date and amount paid (defaults to today, full amount).
- Persisted as a `StatementPayment` record. Future support for partial payments uses this same record type.

### Cycle navigation
- Top-right of dashboard: cycle picker (this month / last month / pick a month).
- Past cycles are read-only.

## Data model implications

- `StatementPayment` — id, statement_id, household_id, paid_on (date), amount_paid (money), marked_by_user_id, notes. (A statement can have multiple, but MVP UI only writes one full payment.)
- Derived (not stored) per-request:
  - Current cycle window for the household.
  - Current cycle window per card (based on its statement_close_day).
  - Aggregations defined by the formula.

## API surface (high-level)

- Get money-left summary for a given cycle (current by default).
- List statements with their payment status.
- Mark statement paid.
- List cycle history (summarized).

## Acceptance criteria

- The "Money left" number on the dashboard equals a hand calculation on a contrived test household within $0.01 (no float drift).
- A statement marked paid disappears from the "Bills due" widget instantly and stops affecting the number.
- The formula popover lists each component with its actual value for that cycle.
- A user can view any prior cycle's snapshot and see the same components.

## Risks & open questions

- See cross-cutting risk #6: *"Money left" semantics.* The formula above is the proposal. Sign-off required before build.
- **Conservatism vs. clarity:** subtracting "charges posted but not yet billed" is conservative and may surprise users on cycle boundaries (a fresh card cycle starts and the number jumps). Mitigate with the formula popover and small explanatory copy.
- **Statement-payment timing:** users will mark statements paid before money actually leaves their checking. We don't model checking balances in MVP, so this is fine — the number reflects "available to spend assuming you pay your bills." Document this clearly.
- **Late or split payments:** out of scope for MVP. Note in the data model that `StatementPayment` is one-to-many to allow this in V1.
- **Cycle alignment:** household cycle = calendar month, but cards have their own cycles. This is intentional — money-left is about *your wallet*, not the card-issuer's billing. The per-card view shows per-card cycles separately.

## Dependencies

- Blocked by: Cards (Epic 02), Statement Ingestion (Epic 03), Transactions (Epic 06), Manual Income (Epic 07).
- Blocks: Dashboard (Epic 09).
