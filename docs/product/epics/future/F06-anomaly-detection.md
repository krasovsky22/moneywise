# Epic F06 — Anomaly Detection (V1/V2)

## Goal

Surface charges that are **statistically weird** for this household. The flagship use case from the original brief: *"Storage subscription just jumped from $9.99 to $29.99 — was that intentional?"*

Anomaly detection turns Moneywise from a passive ledger into an early-warning system.

## Personas

- **Vigilant member** — wants to catch sneaky price hikes and unexpected charges.
- **Family unaware of a charge** — discovers fraud or kid's in-app purchases via an alert.

## In scope (V1)

- **Subscription price spike** — when a recurring charge (from F05) appears with an amount ≥ X % above its typical value, raise an alert.
- **Unusual one-off charge** — a single transaction is ≥ X standard deviations above the rolling baseline for that category or merchant.
- **New merchant alert** (opt-in, V2) — first-ever charge from a merchant the household has never used.
- **Duplicate charge** (same card, same amount, same merchant within 24 h) — common fraud signal.
- Each anomaly has a **severity** (info / warning / critical) and a clear recommended action ("review and confirm" / "dispute if unauthorized").
- Anomalies appear on the dashboard's "Attention" section and via F04 notifications.
- User can **dismiss** or **mark legitimate** — feedback tunes future detection (or at least suppresses repeats).

## Out of scope (V1/V2 — defer)

- Real-time alerts during card swipes (would require issuer push integration — out forever for now).
- Cross-household anomaly comparison ("similar households saw a 10 % storage hike too") — V3+ with privacy guarantees.
- Predicting *future* price hikes — V3+ if ever.

## User stories

- As a member I want to know within 24 h when my cloud storage price suddenly doubled.
- As a member I want to be alerted if the same charge appears twice on the same day.
- As a member I want to dismiss an anomaly when it's legitimate, and not be alerted again for the same thing.
- As a member I want a clear list of "things to investigate" rather than scrolling for surprises.

## Key flows

### Detection
- Background job runs after every statement ingest / sync.
- For each transaction:
  - If it's tied to a `Subscription` (F05) and `amount > typical * (1 + threshold)`, flag.
  - Else compare to category-merchant baseline (rolling 6 months); flag if > threshold standard deviations.
  - Check for same-day duplicates per card.
- Creates `Anomaly` records.

### Review
- Dashboard → "Attention" surfaces unresolved anomalies.
- Click → detail showing the transaction(s), the baseline, the reason flagged, and actions.

### Actions
- **Confirm legitimate**: marks anomaly resolved; threshold for this specific pattern is bumped so we don't refire.
- **Mark suspicious**: highlights it as "user-flagged" — useful for export to issuer dispute later. We don't act on the user's behalf.
- **Dismiss**: archives without learning.

## Data model implications

- `Anomaly` — id, household_id, transaction_id (or subscription_id), kind (enum: price_spike, outlier, duplicate, new_merchant), severity, baseline_value, observed_value, threshold_used, status (open, confirmed_legitimate, marked_suspicious, dismissed), detected_at, resolved_at, resolved_by_user_id.
- `AnomalyFeedback` — id, anomaly_id, user_id, action, comment, created_at. Used to tune detection over time.

## API surface (high-level)

- List anomalies (filterable by status).
- Get anomaly detail.
- Resolve / dismiss anomaly.
- Get anomaly history per merchant/subscription.

## Acceptance criteria

- A subscription that doubles in price produces an anomaly within one detection cycle.
- A duplicate-charge anomaly fires within minutes of the duplicate appearing.
- Confirming legitimacy of an anomaly prevents the same pattern from re-firing.
- False-positive rate is low enough that users actually read the alerts (target: ≤ 1 in 5 dismissed as noise).

## Risks & open questions

- **Threshold tuning** — too sensitive = noise; too lax = missed. Start conservative; rely on user feedback for tuning.
- **Cold-start households** — not enough history to compute baselines. Detection must degrade gracefully.
- **Per-merchant vs. per-category baselines** — both have value; F06 v1 uses merchant when available, category otherwise.
- **Alert fatigue with F04** — coordinate with F04 to bundle multiple anomalies into a digest rather than firing one notification each.
- **"Mark suspicious" downstream** — do we ever export an actual dispute letter? Not in V2.

## Dependencies

- Blocked by: MVP statement ingestion + F05 subscriptions (for the price-spike use case).
- Consumes: F04 (notifications channel).
- Improves: trust in the product — likely the highest "wow" feature.
