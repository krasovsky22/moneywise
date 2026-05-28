# Epic 02 — Credit Cards & Billing Cycles

## Goal

Let the household register each credit card they use, with enough metadata that Moneywise can:
1. Attach uploaded statements to the right card.
2. Know when each card's billing cycle closes and when payment is due.
3. Roll up "what do we owe this cycle?" across all cards.

This is the structural backbone of the **Cashflow / "Money Left"** computation in Epic 08.

## Personas

- **Account creator** setting up the household — adds the cards the family actually uses.
- **Secondary member** — adds their own cards once they join.

## In scope (MVP)

- CRUD for credit cards: name, last-4 digits, issuer (free text), card-network (optional), color/icon for UI.
- Configure the **billing cycle**: statement closing day-of-month + payment due day-of-month.
- Configure the **minimum payment** (manual entry, optional).
- Soft-delete / archive a card (transactions remain, but it stops appearing in dashboards).
- A card can be marked **shared** (default — counts in household cashflow) or **personal** (visible to all but tagged; treatment in V1).
- One card can be marked the **default** for new manual transactions.

## Out of scope (MVP — defer)

- Live balance sync (V1, via F01).
- Multiple cycles per year (most US cards are monthly; non-monthly cycles are V2).
- Card rewards modeling (cashback, points).
- Linking debit cards or checking accounts as "cards." Use the Manual Income flow instead.
- Per-card spending limits or alerts (V1).

## User stories

- As a primary user I want to add my Amex Gold and Chase Sapphire with their closing/due dates so the system can tell me what I owe and when.
- As a member I want to set a recognizable color or icon per card so I can identify them in a glance on the dashboard.
- As a household I want to archive a card we cancelled, without losing its historical transactions.
- As a member I want to fix a wrong cycle day after I notice my statements aren't landing in the right month.

## Key flows

### Add a card
1. Settings → Cards → **"Add card"**.
2. Enter: nickname, issuer, last-4, statement-close day (1–31), payment-due day (1–31), optional minimum-payment.
3. Save. Card appears in the list with a colored chip.

### Edit a card
- Standard form. Changing the cycle days does **not** retroactively re-bucket past transactions; we annotate "billing cycle changed on YYYY-MM-DD" in the audit log.

### Archive a card
- Confirm modal: "Existing statements and transactions remain. The card stops appearing in new uploads and dashboards."

### Cycle-day edge cases
- A close-day of 31 falls back to the last day of months with fewer days.
- If statement-close and due-day are misordered (e.g., close 28, due 1), assume the due date is in the *following* calendar month. Make this explicit in copy.

## Data model implications

New entity:

- `Card` — id, household_id, nickname, issuer, last4 (4 chars, no validation that it's the real last-4), network (enum or null), color, icon, statement_close_day (1–31), payment_due_day (1–31), minimum_payment_amount (nullable money), is_shared (bool, default true), is_archived (bool), created_at, archived_at.

## API surface (high-level)

- List cards (household-scoped, excludes archived by default).
- Get card.
- Create card.
- Update card.
- Archive / unarchive card.
- (Future: get current cycle window for a card — derived, not stored — used by cashflow.)

## Acceptance criteria

- A user can add ≥ 3 cards and they appear consistently across the dashboard, the upload screen, and the transactions list.
- Editing close/due days updates the next computed cycle window immediately.
- Archived cards do not show up in the upload card-picker.
- Last-4 is treated as a display string, never validated as the real card number; we never accept the full PAN.

## Risks & open questions

- **Multiple cards on same account (authorized users):** for MVP, treat each card as separate. If the issuer's statement bundles them, parsing will produce one statement with mixed transactions; we may need to split or tag by last-4 in V1.
- **Cycle day vs. posting date drift:** in practice, statement-close is somewhat fuzzy (weekend bumps). MVP assumes the configured day; we revisit if it causes real mis-bucketing.
- **Minimum payment vs. statement balance vs. current balance:** MVP only models the *statement balance owed* per cycle, derived from parsed statements. Min-payment is informational only.

## Dependencies

- Blocked by: Household epic (cards belong to households).
- Blocks: Statement Ingestion, Transactions, Cashflow.
