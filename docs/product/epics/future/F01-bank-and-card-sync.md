# Epic F01 — Plaid Bank & Card Sync

## Goal

Eliminate manual statement uploads by syncing transactions, balances, and account metadata directly from banks and credit-card issuers via Plaid. The user authorizes Moneywise once per institution; the system maintains the connection and pulls new transactions automatically. The existing manual/upload path remains fully intact as a fallback.

## Personas

- **Existing MVP user** — has been uploading statements; Plaid is a relief from a recurring chore.
- **New user** — onboards by linking accounts instead of uploading PDFs.

## In scope (MVP)

- Plaid Link flow: "Connect a bank" launches Plaid's hosted modal; user authenticates inside Plaid's iframe (we never see credentials).
- Store one `PlaidItem` per institution connection, with an encrypted `access_token`.
- Enumerate accounts on connection; auto-create or link to existing `BankAccount` / `Card` records.
- Cursor-based transaction sync: full backfill on first connect, incremental delta on subsequent syncs (Plaid `/transactions/sync`).
- Hourly cron job: sync all active items every hour via Celery Beat + Redis.
- Manual "Refresh" button per institution.
- Map synced transactions onto existing records; preserve user edits (category, notes, splits).
- Pending-transaction handling: import as `pending = true`, update or remove when they post.
- Sync status surface: last synced time, item health badge (`good` / `login_required` / `error`).
- Re-authentication flow: "login required" banner + Plaid Link update-mode reconnect.
- Unlink institution: revokes token at Plaid, stops future syncs, preserves historical data.
- `source = "plaid"` as a new transaction filter option alongside `"statement"` and `"manual"`.

## Out of scope (MVP — defer)

- **Webhooks:** Plaid `SYNC_UPDATES_AVAILABLE` / `ITEM_LOGIN_REQUIRED` webhook receiver — deferred to post-MVP (see Phase 2). Cron is the sole sync trigger for MVP.
- **User notifications:** push / email alerts when new transactions arrive — deferred to post-MVP.
- Liabilities product: auto-fill credit card due dates, minimum payments, statement close dates.
- Investments product: brokerage / retirement holdings and transactions.
- Non-US institutions (depends on Plaid coverage and plan tier).
- Direct issuer APIs (Amex, Chase) — aggregator coverage first.
- Bill-pay / move-money — Moneywise is read-only, always.

---

## How Plaid Works

Plaid is a financial data aggregator. You create one **Item** per user per institution. Plaid handles bank authentication, MFA, and OAuth redirects inside its hosted UI. From a single Item you can read accounts, transactions, balances, and more.

### Link flow (step by step)

1. **Backend creates a link token** — `POST /link/token/create` to Plaid with the user's stable ID and requested products (e.g. `["transactions"]`). Plaid returns a short-lived `link_token` (30-min TTL, single-use).
2. **Frontend opens Plaid Link** — the `@plaid/react` SDK initializes with the token and renders a modal. The user picks their bank and enters credentials inside Plaid's iframe.
3. **Plaid calls `onSuccess`** — passes a one-time `public_token` and account metadata.
4. **Frontend sends `public_token` to our backend** — never to Plaid directly.
5. **Backend exchanges for a permanent `access_token`** — `POST /item/public_token/exchange` to Plaid. Returns `access_token` + `item_id`. Access token is encrypted and stored; never returned to the frontend.
6. **Backend provisions accounts** — calls `/accounts/get`, creates or links `BankAccount`/`Card` records.
7. **Backend queues initial sync** — fires the first `/transactions/sync` call in the background (up to 24 months of history).

### Incremental sync (cursor-based)

Plaid's `/transactions/sync` is cursor-based, like a bookmark:

- First call (no cursor) → full history returned in pages.
- Plaid returns a `cursor` string → saved on the `PlaidItem` row.
- Subsequent calls with cursor → only `added`, `modified`, `removed` deltas.
- Cursor is saved after each successful page so a crash mid-sync can resume safely.

### Transaction categories

Plaid provides its own taxonomy (`personal_finance_category.primary` / `.detailed`). A mapping function translates to Moneywise categories where possible; unmatched transactions land with `category_id = null` and `is_low_confidence = true`, matching the existing AI-categorization fallback.

### Sign convention

Plaid's positive-amount = debit convention must be normalized to Moneywise's convention in `sync.py` before inserting. Credit and depository accounts require different handling.

---

## Data Model

### New table: `plaid_items`

One row per successful institution connection.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `household_id` | FK → `households` | |
| `user_id` | FK → `users` | who connected it |
| `plaid_item_id` | string | Plaid's Item ID; used to match webhooks |
| `plaid_access_token` | string | **encrypted at rest** (Fernet/AES-256); never returned to frontend |
| `plaid_institution_id` | string | e.g. `"ins_3"` |
| `institution_name` | string | e.g. `"Chase"` |
| `institution_logo_url` | string? | |
| `institution_color` | string? | Plaid brand color |
| `cursor` | string? | `/transactions/sync` bookmark; `null` = initial sync pending |
| `status` | enum | `good` \| `degraded` \| `login_required` \| `error` |
| `error_code` | string? | Plaid error code when `status = error` |
| `last_synced_at` | timestamp? | |
| `consent_expires_at` | timestamp? | some institutions require periodic re-consent |
| `is_deleted` | bool | soft-delete on disconnect |
| `created_at`, `updated_at` | timestamps | |

### New table: `plaid_accounts`

One row per Plaid account within an Item (e.g. a Chase Item may have checking + two credit cards).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `plaid_item_id` | FK → `plaid_items` CASCADE | |
| `household_id` | FK → `households` | |
| `plaid_account_id` | string | Plaid's stable account ID |
| `bank_account_id` | FK → `bank_accounts`? | set when account type is depository |
| `card_id` | FK → `cards`? | set when account type is credit |
| `name` | string | Plaid's account name |
| `official_name` | string? | |
| `mask` | string? | last 4 digits |
| `type` | enum | `depository` \| `credit` \| `investment` \| `loan` \| `other` |
| `subtype` | string | e.g. `"checking"`, `"credit card"` |
| `current_balance` | numeric? | |
| `available_balance` | numeric? | |
| `credit_limit` | numeric? | for credit accounts |
| `currency_code` | string | default `"USD"` |
| `is_active` | bool | |
| `created_at`, `updated_at` | timestamps | |

### New table: `plaid_sync_log`

Debugging and audit trail for sync runs.

| Column | Type |
|---|---|
| `id` | UUID PK |
| `plaid_item_id` | FK → `plaid_items` |
| `sync_type` | enum: `cron` \| `manual` |
| `cursor_before` | string? |
| `cursor_after` | string? |
| `added_count` | int |
| `modified_count` | int |
| `removed_count` | int |
| `error` | string? |
| `started_at` | timestamp |
| `completed_at` | timestamp? |

### Changes to existing tables

| Table | Change |
|---|---|
| `bank_accounts` | Add nullable `plaid_account_id` (string, indexed) |
| `cards` | Add nullable `plaid_account_id` (string, indexed) |
| `transactions` | Add nullable `plaid_transaction_id` (string, unique-per-household, indexed) |
| `transactions` | Add nullable `pending` (bool) |
| `transactions.source` | Add `"plaid"` enum value |

All migrations are nullable-only — no table rewrites, no downtime.

---

## Backend Module: `apps/api/src/app/modules/plaid/`

```
modules/plaid/
  __init__.py
  client.py          # Plaid SDK wrapper; all calls to Plaid go here
  crypto.py          # Fernet encrypt/decrypt for access tokens
  models.py          # PlaidItem, PlaidAccount, PlaidSyncLog
  schemas.py         # Pydantic request/response shapes
  service.py         # Link token creation, token exchange, account provisioning
  sync.py            # Cursor-based sync: add/modify/remove + category mapping
  router.py          # HTTP endpoints (thin, delegates to service/sync)
  dependencies.py    # FastAPI DI helpers
```

### `client.py`

Wraps `plaid-python`. Reads `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (sandbox / development / production) from config. Translates Plaid exceptions to Moneywise `ServiceError` types. All Plaid API calls go through here — nothing else imports `plaid` directly.

### `crypto.py`

Fernet symmetric encryption using a key from `PLAID_TOKEN_ENCRYPTION_KEY` env var. Provides `encrypt_token(plaintext) -> str` and `decrypt_token(ciphertext) -> str`. Key is never stored in the database.

### `sync.py` — cursor sync algorithm

```
load PlaidItem by item_id
cursor = item.cursor  # None on first sync

loop:
  response = plaid.transactions_sync(access_token, cursor)

  for tx in response.added:
    account = look up PlaidAccount by plaid_account_id
    upsert transaction: INSERT ... ON CONFLICT (plaid_transaction_id) DO UPDATE
    set source="plaid", pending=tx.pending

  for tx in response.modified:
    UPDATE transactions SET ... WHERE plaid_transaction_id = tx.transaction_id

  for tx in response.removed:
    soft-delete WHERE plaid_transaction_id = tx.transaction_id

  cursor = response.next_cursor
  save cursor to PlaidItem  # persist after each page

  if not response.has_more:
    break

update item.last_synced_at
write PlaidSyncLog row
```

### Endpoints in `router.py`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/plaid/link/token` | JWT | Create link token; frontend calls this before opening Plaid Link |
| `POST` | `/api/v1/plaid/items` | JWT | Exchange `public_token`; provisions accounts; queues background sync |
| `GET` | `/api/v1/plaid/items` | JWT | List all connected institutions for the household |
| `DELETE` | `/api/v1/plaid/items/{id}` | JWT | Disconnect; calls Plaid `/item/remove`; soft-deletes Item |
| `POST` | `/api/v1/plaid/items/{id}/sync` | JWT | Manual sync trigger; returns `{ queued: true }` |

Webhook endpoint is explicitly excluded from MVP. See Phase 2.

---

## Frontend Components: `apps/web/src/features/plaid/`

```
features/plaid/
  plaidApi.ts                    # API client functions
  usePlaid.ts                    # TanStack Query hooks
  PlaidLinkButton.tsx            # Opens Plaid Link modal on click
  PlaidItemCard.tsx              # One connected institution: logo, status, actions
  ConnectedAccountsSection.tsx   # Lists all items; added to Wallet page
  DisconnectDialog.tsx           # Confirmation before unlinking
```

### `PlaidLinkButton.tsx` — lazy token fetch pattern

```
onClick:
  1. POST /plaid/link/token  → link_token
  2. initialize usePlaidLink({ token: link_token, onSuccess, onExit })
  3. when ready === true → call open()

onSuccess(publicToken, metadata):
  POST /plaid/items { public_token, institution_id, institution_name }
  invalidate ["plaid-items"] query
  show success toast

onExit(error):
  if error → show error toast
```

The `@plaid/react` `usePlaidLink` hook must receive a non-null token before `open()` can be called. Fetching the token lazily on click (rather than on mount) prevents 30-min expiry before the user interacts.

### Wallet page changes

- New `ConnectedAccountsSection` below existing Cards and Bank Accounts sections.
- Each `PlaidItemCard` shows: institution logo, name, status badge, last synced time, account list, Refresh button, Disconnect button.
- "login_required" items show an inline warning with a **Reconnect** button. Reconnect flow passes `access_token` to `link/token/create` on the backend, which puts Plaid Link into update-mode (credentials only, no institution selection).

### Transaction page changes

- Add `"plaid"` to the source filter alongside `"statement"` and `"manual"`.
- `pending` transactions display with a visual indicator (e.g. muted color or italic) until they post.

---

## Transaction Source Coexistence

Plaid does not deliver PDF statements. The existing upload pipeline (`source = "statement"`) remains intact. Both paths produce rows in the same `transactions` table and are filtered by `source`.

**Duplicate risk:** if a user manually uploaded a statement for Chase and then connects Chase via Plaid, the same charges appear twice. Mitigation:

1. `cards.plaid_account_id` links a card to a Plaid account. If set, show a warning on the statement-upload screen: *"This card is connected via Plaid. Uploading a statement may create duplicate transactions."*
2. No automatic dedup between `source = "statement"` and `source = "plaid"` — reconciliation is the user's responsibility in V1.

---

## Environment & Configuration

Three Plaid environments — select via `PLAID_ENV`:

| Env | Purpose | Credentials |
|---|---|---|
| `sandbox` | Fake data, no real banks | `user_good` / `pass_good` |
| `development` | Real banks, limited items | Real bank credentials |
| `production` | Full access, usage-billed | Real bank credentials |

New env vars (add to `.env.example`):

```
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
PLAID_TOKEN_ENCRYPTION_KEY=   # Fernet key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
# PLAID_WEBHOOK_URL=          # deferred to Phase 2; requires a publicly reachable HTTPS URL (use ngrok in dev)
```

---

## Implementation Phases

### Phase 1 — MVP ✅ Implemented

**Backend:**
- [x] Add `plaid-python` and `cryptography` to `pyproject.toml`
- [x] Add env vars to `core/config.py` and `.env.example`
- [x] `modules/plaid/crypto.py` — Fernet encryption helpers
- [x] `modules/plaid/client.py` — Plaid SDK wrapper
- [x] `modules/plaid/models.py` — `PlaidItem`, `PlaidAccount`, `PlaidSyncLog`
- [x] Alembic migration: new tables + columns on `bank_accounts`, `cards`, `transactions`
- [x] `modules/plaid/service.py` — link token creation, token exchange, account provisioning
- [x] `modules/plaid/sync.py` — cursor sync with add/modify/remove handling, category mapping
- [x] `modules/plaid/router.py` — `POST /link/token`, `POST /items`, `GET /items`, `DELETE /items/{id}`, `POST /items/{id}/sync`
- [x] Wire into `api/v1/router.py`
- [ ] Celery worker + Celery Beat configured (hourly cron sync) — deferred; initial sync uses FastAPI `BackgroundTasks`

**Frontend:**
- [x] Install `@plaid/react`
- [x] `features/plaid/plaidApi.ts`
- [x] `features/plaid/PlaidLinkButton.tsx`
- [x] `features/plaid/ConnectedAccountsSection.tsx` + `PlaidItemCard.tsx`
- [x] `features/plaid/DisconnectDialog.tsx`
- [x] Wallet page: add Connected Accounts section
- [x] Transaction filters: bank-account filter + `source` filter (manual / plaid)
- [x] Status badge (`good` / `login_required` / `error`), last synced time, Refresh and Disconnect buttons
- [x] Reconnect flow (Plaid Link update mode) for `login_required` items
- [ ] "login required" warning banner on Wallet page — deferred to Phase 2
- [ ] Pending transaction visual indicator — deferred to Phase 2

### Phase 2 — Webhooks & user notifications (post-MVP)

**Backend:**
- [ ] `POST /api/v1/plaid/webhook` with `Plaid-Verification` signature check
- [ ] Route `SYNC_UPDATES_AVAILABLE` → queue Celery sync task
- [ ] Route `ITEM_ERROR` / `ITEM_LOGIN_REQUIRED` → update `PlaidItem.status`
- [ ] Route `PENDING_EXPIRATION` → set `PlaidItem.consent_expires_at`
- [ ] User notification dispatch after sync (email / push / in-app) when new transactions arrive

**Frontend:**
- [ ] In-app notification badge or toast when sync finds new transactions

### Phase 3 — Liabilities + Investments (future)

**Backend:**
- [ ] Add `liabilities` product to link token; sync credit card due dates, minimums from `/liabilities/get` back to `Card` fields
- [ ] Add `investments` product; new `PlaidInvestmentHolding` and `PlaidInvestmentTransaction` models

**Frontend:**
- [ ] Auto-populated due date / minimum fields on card detail
- [ ] Investment holdings page (new route)

---

## API Contract

The frontend exclusively calls Moneywise's own API — never Plaid directly.

```
POST /api/v1/plaid/link/token
  Request:  (no body — user from JWT)
  Response: { link_token: string }

POST /api/v1/plaid/items
  Request:  { public_token: string, institution_id: string, institution_name: string }
  Response: PlaidItem { id, institution_name, status, last_synced_at, accounts: PlaidAccount[] }

GET /api/v1/plaid/items
  Response: PlaidItem[]

DELETE /api/v1/plaid/items/{id}
  Response: 204 No Content

POST /api/v1/plaid/items/{id}/sync
  Response: { queued: true }

# POST /api/v1/plaid/webhook — deferred to Phase 2
```

---

## Acceptance Criteria

- User links a major US bank; up to 24 months of transactions appear within 5 minutes of connection.
- Subsequent hourly cron syncs pull only deltas and never create duplicates (`plaid_transaction_id` unique constraint).
- Pending transactions appear with a visual indicator and are updated/removed when they post.
- Items with expired/invalid tokens surface a reconnect banner; user can re-authenticate via Plaid Link update mode.
- Disconnecting stops future syncs and removes the access token; historical transactions are preserved.
- All Plaid access tokens are encrypted at rest; none appear in logs or API responses.

---

## Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Access token leakage** | Fernet encryption at rest; never logged or returned from any endpoint; encryption key in env var only |
| **Plaid environment confusion** | `PLAID_ENV` must be explicit; sandbox credentials are public (`user_good`/`pass_good`); dev/prod require Plaid account setup |
| **Missed syncs** | Hourly cron is the sole trigger for MVP; cursor ensures no double-processing if a run is skipped |
| **Pending tx sign-convention bugs** | Amount normalization tested in sandbox with known test transactions before prod |
| **Duplicate transactions (Plaid + statement uploads)** | UI warning when `card.plaid_account_id` is set and user tries to upload; no auto-merge in V1 |
| **Plaid cost at scale** | Usage-based pricing; forecast per-user cost before production launch; consider caching balance calls |
| **Institution coverage gaps** | Statement upload remains fully intact as the fallback for unsupported institutions |
| **Reconciliation after mid-stream link** | User has 12 months of uploaded statements then links the same card; V1 leaves reconciliation manual with a source filter to compare |

## Dependencies

- **Blocked by:** Full MVP shipping (Epics 01–09 complete).
- **Blocks:** F02 AI budget recommendations (needs reliable spending data), F05 Subscription tracking (synced data improves detection accuracy).
