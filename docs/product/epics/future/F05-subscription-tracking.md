# Epic F05 — Subscription Tracking (V1)

## Goal

Identify recurring subscriptions the household pays for, surface them in one place, and warn before renewals. Subscriptions are usually small charges that escape notice but compound — Moneywise should make them visible and easy to act on.

## Personas

- **Cost-conscious household** — wants to find and cut unused subscriptions.
- **Forgetful user** — got auto-billed for an annual renewal they meant to cancel.

## In scope (V1)

- **Auto-detection**: a service scans transactions and identifies recurring patterns — same merchant + same approximate amount + same monthly/yearly cadence over ≥ 2 occurrences. Confirmed via user review.
- **Subscription page**: list of detected subscriptions with merchant, amount, frequency, next expected renewal, last 6 months of history.
- **Status**: active / paused / cancelled (user-set; we don't actually cancel anything).
- **Notes / cancellation links**: free-text field for "cancel by emailing X" or a URL.
- **Renewal reminders**: notify N days before next expected charge (uses F04 infrastructure).
- **Manual add**: user can add a subscription that hasn't been auto-detected yet (e.g., one they just signed up for).

## Out of scope (V1 — defer)

- Actually cancelling subscriptions on the user's behalf (regulatory and operational nightmare; V3+ if ever).
- Negotiating subscription rates (V3+).
- Detecting price changes — that lives in F06 Anomaly Detection.
- Free-trial expiry detection (V2 — depends on user telling us trial dates).

## User stories

- As a member I want to see every recurring charge in one list so I can find subscriptions I forgot about.
- As a member I want a reminder 5 days before Netflix renews so I can decide to cancel.
- As a member I want to mark a subscription cancelled so it stops triggering reminders even if a stray charge appears.
- As a member I want to add a subscription manually before its first charge.

## Key flows

### Detection
- Background job runs nightly, scans transactions for the household.
- For each candidate cluster, creates a `Subscription` proposal in `pending_review` status.
- User reviews on the Subscriptions page: confirm, edit details, or dismiss.

### Renewal reminder
- Each active subscription has a `next_expected_charge_date`.
- N days before, F04 schedules a notification.

### Cancellation
- User marks subscription cancelled with a date and reason.
- Future charges that *should not* have happened (e.g., one slips through) will be flagged by F06.

### Manual add
- "**Add subscription**" → merchant, amount, frequency, next expected date, notes.

## Data model implications

- `Subscription` — id, household_id, merchant_clean, amount_typical, currency, frequency (enum: monthly, yearly, quarterly, weekly, custom), anchor_day, status (pending_review, active, paused, cancelled), next_expected_charge_date, first_seen_at, last_seen_at, notes, source (detected / manual), created_at.
- `SubscriptionCharge` — link table: subscription_id, transaction_id, occurred_on, amount, deviation_from_typical.

## API surface (high-level)

- List subscriptions (filterable).
- Confirm / dismiss a detected subscription.
- CRUD manual subscription.
- Get charge history for a subscription.

## Acceptance criteria

- For a test household with 10 known subscriptions, detection finds ≥ 8 within 2 cycles of data.
- False-positive rate on detection is low enough that the review queue is manageable (< 5 false candidates per cycle).
- Renewal reminders fire reliably for at least the next 6 cycles after confirmation.
- Marking cancelled stops reminders immediately.

## Risks & open questions

- **Detection algorithm choice** — pure heuristic (merchant + amount + cadence) is fine for MVP of V1; a small ML model is overkill. Re-evaluate later.
- **Multiple subscriptions to the same merchant** — e.g., two Apple charges in the same month for different services. Detection has to allow this rather than collapse them.
- **Cancellation we can't see** — user cancels Netflix, but a charge still arrives next month. F06 picks this up as an anomaly.
- **Trial → paid conversion** — first charge of a paid plan may not match prior cadence. Handle gracefully (still propose as subscription).

## Dependencies

- Blocked by: MVP shipping.
- Strongly improved by: F01 (denser data).
- Consumes: F04 (notifications).
- Feeds: F06 (anomaly detection uses subscriptions for "expected charge" baselines).
