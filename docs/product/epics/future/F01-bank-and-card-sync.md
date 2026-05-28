# Epic F01 — Bank & Card Provider Sync (V1)

## Goal

Eliminate manual statement upload by syncing transactions directly from card issuers and bank accounts. The user authorizes Moneywise once per institution; the system pulls new transactions automatically and reconciles them with existing data.

## Personas

- **Existing MVP user** — has been uploading statements; this is a relief.
- **New user** — onboards by linking accounts instead of uploading PDFs.

## In scope (V1)

- Integrate with an aggregator (Plaid, MX, Finicity, or similar) for US banks and credit-card issuers.
- Link flow: from Settings, "Link account" launches the aggregator's hosted UI; on success we store a long-lived item/token per institution.
- Periodic background sync (e.g., every 6 hours) pulling new transactions, balances, and account metadata.
- Map synced transactions onto existing `Card` / new `Account` records; preserve manual edits the user has made.
- Conflict resolution when manual data exists for the same period.
- Display sync status: last sync time, errors, "re-authorize required" prompts.
- Unlink / revoke an institution.

## Out of scope (V1 — defer)

- Direct issuer APIs (e.g., Amex's own API) — aggregator coverage first.
- Open-banking / PSD2 (non-US) — depends on aggregator support and is V2+.
- Investment-account sync (V2).
- Bill-pay / move-money capabilities — never. We are read-only.

## User stories

- As a user I want to link my Chase account once and never upload a statement again.
- As a user I want clear feedback when an institution requires re-authentication.
- As a user I want the system to merge synced data with what I already had — without duplicates.
- As a user I want to unlink an institution and have my historical data preserved.

## Key flows

### First-time link
1. Settings → Linked Institutions → **"Link new"**.
2. Hosted UI from aggregator opens; user enters institution + creds in *their* UI, not ours (we never see passwords).
3. On success: we get an `Item` token; we enumerate accounts (cards, checking, savings).
4. User maps each returned account to an existing Moneywise card or creates a new one.
5. Backfill of N months of history (configurable; default 12).
6. Transactions appear in Moneywise.

### Periodic sync
- Background worker per institution, every 6 hours.
- Delta-fetch only new transactions; reconcile with `merchant_signature + amount + date` to skip duplicates against statement-derived rows.

### Re-authentication
- Aggregator says token expired → user sees a banner: "Chase needs re-authentication." Click → launches hosted UI in update-mode.

### Unlink
- Confirm modal: "Future syncs stop. Existing transactions stay."
- Token is revoked at the aggregator.

## Data model implications

- `Institution` — id, household_id, aggregator (enum), aggregator_item_id, name, status (active / needs_reauth / disconnected), last_sync_at, last_sync_error, created_at.
- `Account` — generalization of `Card`: id, household_id, institution_id (nullable for manual cards), aggregator_account_id (nullable), kind (credit_card, checking, savings, cash, other), metadata. `Card` becomes a kind of `Account`.
- `Transaction.aggregator_transaction_id` (nullable) — used for dedup.

## API surface (high-level)

- Link/relink/unlink institution.
- List institutions and their statuses.
- Trigger manual re-sync.
- Map an aggregator account to an existing Moneywise account.

## Acceptance criteria

- A user links one major US bank and one credit-card issuer; 12 months of transactions appear within 5 minutes.
- Subsequent syncs pull only new transactions and never create duplicates against MVP statement uploads.
- Re-authentication prompt appears within one sync cycle of the token expiring.
- Unlinking does not delete historical data.

## Risks & open questions

- **Aggregator cost** — usage-based pricing. Forecast at scale; pick an aggregator with predictable per-user pricing.
- **Coverage** — not all small credit unions / cards are covered. MVP statement upload must remain as a fallback.
- **Compliance and ToS** — aggregator agreements typically forbid storing certain data. Audit before launch.
- **Reconciliation against statement uploads** — most likely conflict: user has been uploading statements and then links the same card mid-stream. We need clear UX for "which source wins" per range.

## Dependencies

- Blocked by: full MVP shipping.
- Blocks: F05 Subscriptions (synced data is denser and helps), F02 AI recommendations (needs reliable spending data).
