# Epic 07 — Manual Income

## Goal

Without bank-account integration, the household needs a reliable way to tell the system "money came in." Two flavors matter:

1. **Recurring income** — paychecks, child-support, regular gigs. The system should *expect* these.
2. **One-off deposits** — bonuses, gifts, refunds, side income.

This data feeds directly into "money left" (Epic 08).

## Personas

- **Salaried member** — sets up a single recurring template and forgets it.
- **Variable-income member** — logs deposits as they happen.
- **Couple** — both members can log income; both see the same income ledger.

## In scope (MVP)

- **Income entries** (one-off): date, amount, source label, category (defaults to "Income"), notes, member who received it.
- **Recurring income templates**: source label, amount (or "varies"), schedule (frequency: weekly, biweekly, semi-monthly, monthly; anchor day(s)), start date, optional end date, member.
- For each template, the system generates **expected income occurrences** on the cycle calendar.
- Each expected occurrence has a status: `expected → received` (when the user marks it received, optionally adjusting the amount). The user can also **add an unexpected one-off** at any time.
- Income shows up on the dashboard as both **expected this cycle** and **received this cycle**.
- Edit/delete a template (does not retroactively delete past confirmed receipts).
- Edit/delete a single occurrence.
- Income entries are tagged with an income category (separate from spending categories — they share the same `Category` table via the `kind` field from Epic 05).

## Out of scope (MVP — defer)

- Paystub OCR (V1).
- Bank-sync auto-detection of deposits (V1, via F01).
- Splitting income (e.g., paycheck → savings + checking buckets). The household has one shared cash bucket in MVP.
- Tax modeling (gross vs. net, withholding) — users enter take-home.
- Refunds-as-income — a credit-card refund is a negative spending transaction (Epic 06), not an income entry.

## User stories

- As a salaried member I want to set up "$3,200 every other Friday" once, and have the system know when to expect my paycheck.
- As a freelancer I want to log a $1,800 payment when it arrives.
- As a member I want to see *expected* income this cycle vs. *received*, so I can predict if we'll be short.
- As a member I want to skip or adjust a single occurrence without breaking the template.
- As a household I want both members' incomes to roll up into one "money in" number.

## Key flows

### First-time setup
- During onboarding (or anytime), Settings → Income → **"Add income source"**.
- Form: source name (e.g., "Acme payroll"), member, amount or "varies", frequency, start date.
- System shows the next 3 expected occurrences as a preview before saving.

### Mark an expected occurrence as received
- Dashboard widget shows "Expected this cycle: $X (Y not yet received)".
- Clicking the not-yet-received item → quick-confirm: actual amount (defaults to expected) + actual date.
- Status flips to received; ledger updates.

### Adjust or skip
- An expected occurrence has a 3-dot menu: **Skip** (with reason), **Adjust amount**, **Reschedule date**.

### One-off deposit
- "**Add deposit**" anywhere → date, amount, source, notes.
- Lands immediately as received, no template attached.

### Edit template after first use
- Changing amount: future expected occurrences update; past confirmed ones do not.
- Changing schedule: future occurrences regenerate from the change date forward.

## Data model implications

- `IncomeTemplate` — id, household_id, member_user_id (nullable — for shared income), label, amount_expected (nullable for "varies"), category_id, frequency (enum), schedule_payload (jsonb — anchor days, etc.), start_date, end_date (nullable), is_active, created_at.
- `IncomeOccurrence` — id, household_id, template_id (nullable for one-offs), expected_amount (nullable), expected_date (nullable), actual_amount (nullable until received), actual_date (nullable), status (enum: expected, received, skipped), notes, recorded_by_user_id.
- Categories reused (with `kind = income`).

## API surface (high-level)

- CRUD income templates.
- List occurrences (by cycle, by date range).
- Mark occurrence received / skipped / adjusted.
- Add one-off occurrence.
- Get income summary for a cycle (expected, received, delta).

## Acceptance criteria

- A biweekly $3,200 template, set up once, produces expected occurrences for every cycle going forward.
- The dashboard reflects both expected and received income in real time.
- Marking an occurrence received with a different amount updates "money left" without affecting history.
- Skipping an occurrence does not affect future ones.

## Risks & open questions

- See cross-cutting risk #8: *Income modeling without bank sync.* This is the biggest weakness of MVP — we'll need to evaluate after first households use it.
- **Frequency edge cases:** "semi-monthly on the 1st and 15th" needs careful handling when those fall on weekends/holidays. MVP: expected_date stays as the configured calendar day; actual_date is whatever the user enters when confirming.
- **Couples with merged finances vs. separate:** in MVP every member sees all income. That works for fully-merged households; for partially-merged ones we may need per-member visibility in V1.
- **Variable-amount templates:** mark amount as null + a "typical range" hint. Don't auto-bake an estimate into "money left" — show as "income expected from <source>".

## Dependencies

- Blocked by: Household (Epic 01), Categories (Epic 05).
- Blocks: Cashflow (Epic 08), Dashboard (Epic 09).
