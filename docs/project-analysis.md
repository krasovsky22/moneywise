# MoneyWise — Project Analysis, Refactor Plan & Feature Roadmap

> Date: 2026-07-02
> Scope: full-codebase review of implemented features, technical debt, and recommended next steps.

---

## 1. Current state

A pnpm/Turborepo monorepo:

- **`apps/api`** — FastAPI backend (Python 3.12, uv, async SQLAlchemy, Postgres + Redis, Alembic)
- **`apps/web`** — React 19 + Vite + TypeScript (TanStack Router/Query, shadcn/ui, Zustand)
- **`packages/shared-types`** — shared TS types
- **`playwright-tests/`** — root-level E2E suites
- **`docs/product/`** — roadmap + per-epic requirements (product source of truth)

The MVP roadmap defines 9 epics. Most have shipped; the project also jumped ahead
to V1's headline feature (Plaid bank sync, Epic F01) while **abandoning the original
MVP statement-upload pipeline** (Epics 03/04), whose artifacts still litter the repo.

### Feature inventory

| Area | Epic | Status | Notes |
|---|---|---|---|
| Auth | — | ✅ Done | Register/login/logout/refresh (cookie refresh token), change password, Typer CLI password reset |
| Household & members | 01 | ✅ Done | Household CRUD, roles, invitations (create/list/revoke/accept), leave; all data household-scoped |
| Credit cards & billing cycles | 02 | ✅ Done | CRUD + archive/unarchive, statement-close/payment-due days, color/icon, wallet UI |
| Bank accounts | 02b | ✅ Done | CRUD + archive, linked to Plaid accounts |
| Statement upload & ingestion | 03 | ❌ Removed | Replaced by Plaid; dead artifacts remain (see §2.4) |
| AI parsing & categorization | 04 | ⚠️ Replaced | Now a static Plaid `personal_finance_category` → category map in `modules/plaid/sync.py`; no LLM involved |
| Categories | 05 | ✅ Done | System + household categories, merchant→category rules, settings UI |
| Transactions | 06 | ✅ Done | List/filter/search/sort/paginate, create, edit, split, bulk update, soft delete/restore, CSV export |
| Manual income | 07 | ⚠️ Partial | Income loggable as a transaction type; **no recurring income** |
| Cashflow / "money left" | 08 | ❌ Not built | No cashflow engine; nothing accounts for billing cycles or bills due — this is the roadmap's north-star metric |
| Dashboard | 09 | ⚠️ Partial | Stat cards, 6-month cashflow chart, recent activity — all computed client-side (see §2.1); "Export Report" is a disabled stub |
| Plaid bank sync | F01 (V1) | ✅ Mostly | Link flow, Fernet-encrypted access tokens, cursor-based incremental sync, item management, manual re-sync. **No webhooks, no scheduled sync** — data updates only on connect or manual button click |

---

## 2. Refactor plan (prioritized)

> **Status (2026-07-02): all items below are implemented** — summary endpoint +
> dashboard rewire (2.1), sync guard for user-confirmed edits (2.2), rules in
> sync (2.3), dead-code removal (2.4), sync logging + per-page commits (2.5),
> tests for sync/transactions/summary (2.6), streaming CSV export (2.7). Tests
> now also run against an isolated `<dbname>_test` database instead of the dev
> database (the old conftest dropped all dev tables at session end).

### 2.1 Move dashboard aggregation server-side ⚠️ correctness bug

`apps/web/src/routes/secure/dashboard.tsx` fires **7 parallel transaction-list
queries**, each capped at `page_size ≤ 200`
(`apps/api/src/app/modules/transactions/router.py:166`), and sums the first page
client-side. Once a household exceeds 200 transactions in a month (trivially
reachable with Plaid sync), "Monthly Spent" / "Balance" / the chart silently
under-report.

**Fix:** add `GET /api/v1/transactions/summary` (SQL `GROUP BY` month/type,
household-scoped) and shrink the dashboard to ~2 queries. This endpoint also
becomes the natural home of the Epic-08 cashflow engine.

### 2.2 Stop Plaid sync clobbering user edits ⚠️ data-loss bug

The upsert in `modules/plaid/sync.py` (`on_conflict_do_update`, ~line 232)
unconditionally overwrites `category_id`, `merchant_clean`, and
`transaction_type` on "modified" transactions, ignoring `is_user_confirmed`.
A user recategorizes a transaction; Plaid marks it modified (e.g., pending →
posted); the correction is lost.

**Fix:** guard the update set-list with `WHERE NOT is_user_confirmed`, or
exclude user-editable fields from the conflict update.

### 2.3 Apply household category rules during sync

The categories module has a merchant-rules engine, but `sync.py` only consults
the hardcoded `CATEGORY_MAP`. Synced transactions bypass user-defined rules
entirely.

**Fix:** during upsert, try household rules first, then fall back to the Plaid
category map.

### 2.4 Delete dead statement-pipeline remnants

- `apps/api/tests/test_statements.py` — tests a removed `/statements` API
- `docs/technical/statement-processing.md` — documents the removed flow
- `pyproject.toml` ruff override for `statements/pipeline.py` (file no longer exists)
- Statement-related fields lingering in `cards` / `transactions` models & schemas
- `playwright-tests/statements/` and `playwright-tests/epic04-ai-parsing/`
- Unused deps: `pdfplumber`, `openai`, `aiofiles`, `python-multipart`

### 2.5 Sync robustness

In `sync.py`, a mid-pagination Plaid failure flags the item `error`, but flushed
pages and cursor advancement share the caller's transaction — a crash could
persist a cursor past unsaved transactions, permanently skipping them. Make each
page (or the whole sync) explicitly transactional. Also: the bare
`except Exception` swallows errors into a string with no structlog output.

### 2.6 Test coverage

Backend tests cover only auth, cards, health (plus the dead statements suite).
Zero coverage for: transactions service (442 lines, most complex), categories/
rules, household invitations, Plaid sync. Frontend has exactly one Vitest test.

**Priority:** `plaid/sync.py` unit tests (faked client) → transactions service
tests → MSW-based tests for the transactions page.

### 2.7 Minor

- CSV export uses `page_size=100_000` as an "all rows" hack (`transactions/router.py:97`) — stream instead.
- Dashboard reimplements month/date-range math in three hand-rolled helpers — consolidate when adding the summary endpoint.

### Suggested first PR

Items **2.1 + 2.2 + 2.4** together — independent, well-scoped, and they fix both
correctness bugs while clearing the dead code.

---

## 3. Next features (recommended order)

1. **Cashflow & "Money Left" (Epic 08)** — the north star and the only MVP epic
   entirely missing. All inputs exist: cards with close/due dates, Plaid
   balances, income transactions. Builds directly on the §2.1 summary endpoint.
2. **Automatic background sync + Plaid webhooks** — add a `/plaid/webhook`
   endpoint (`SYNC_UPDATES_AVAILABLE`) and/or a periodic job. Forces the "real
   worker/scheduler" decision (arq or APScheduler on the existing Redis).
3. **Recurring manual income (Epic 07 completion)** — small; completes the MVP;
   feeds the cashflow number ("expected paycheck on the 15th").
4. **Bill-due reminders (F04)** — cheap once cycles + cashflow exist; digest
   email or in-app banner for "payment due in 3 days".
5. **Review queue for low-confidence categorizations** — `is_low_confidence` is
   already set on every synced transaction; a "needs review" filter +
   bulk-categorize flow (bulk update exists) raises categorization quality and
   can generate rules from user corrections.
6. **Subscription / recurring-transaction detection (F05)** — Plaid raw metadata
   is stored per transaction (`plaid_raw_metadata`); a rules-based detector over
   merchant + amount + cadence is feasible without AI.
7. **Dashboard "Export Report"** — the disabled button + existing CSV export
   endpoint just need wiring. Quick win.
