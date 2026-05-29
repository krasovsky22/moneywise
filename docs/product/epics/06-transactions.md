# Epic 06 — Transactions: Browse, Search, Edit

## Goal

A single, fast, trustworthy place to view, search, filter, and correct every transaction in the household. This is the screen power users will live in. It must feel like a *ledger they own*, not a black box of AI output.

## Personas

- **Member doing weekly review** — scrolls, scans, corrects categories.
- **Member investigating a charge** — "what was that $48.32 from last Saturday?"
- **Member doing taxes / reconciliation** — exports.

## In scope (MVP)

- A paginated, sortable, filterable transactions list view.
- Filters:
  - Date range (presets: this cycle, last cycle, this month, last 3 months, this year, custom).
  - Card (multi-select).
  - Category (multi-select, including "uncategorized").
  - Amount range.
  - Confirmation status (confirmed / needs-review).
  - Source (statement / manual).
  - Transaction type (expense / income / transfer / refund).
- Full-text search on merchant string and notes.
- Per-row inline edit of category (one-click); modal edit for amount, date, merchant, notes.
- Manual transaction entry (for cash purchases or to correct missing rows).
- Split a transaction into N rows (e.g., Costco $200 = Groceries $130 + Household $70). Split preserves the original total.
- Bulk actions: recategorize, delete (with strong confirmation, soft-delete with undo for 7 days).
- CSV export of the filtered view.

## Out of scope (MVP — defer)

- Saved searches (V1).
- Custom columns / column reordering (V2).
- Free-form tags (V1).
- Receipts attached to transactions (V1, depends on receipt-photo feature).
- Multi-currency display (V2).
- Reconcile-to-statement-total view per card (V1).

## User stories

- As a member I want to find every transaction at a specific merchant in seconds.
- As a member I want to recategorize 30 transactions at once when I realize they're all wrong.
- As a member I want to split a charge so my reports are accurate.
- As a member I want to enter a $40 cash transaction so it counts in our spending.
- As a member I want to delete a wrong transaction without removing the whole statement.
- As a member I want to export this filter to a CSV for my accountant.

## Key flows

### Browse & filter
- Default view: current cycle, all cards, sorted by date desc.
- Filter chips visible at top; clicking opens a popover.
- Pagination (page size ~50). Virtual scroll is V1; pagination is fine for MVP.

### Inline category edit
- Click category chip → small dropdown of categories → select → save.
- If the change matches a "would you like a rule?" pattern, offer it (Epic 04).

### Modal edit
- Open a transaction → full detail view.
- Shows source statement (link), confidence, raw merchant string, parsed value, history of edits.
- Edit any field. Save logs an audit entry.

### Split transaction
- From modal: **"Split"** → N rows where amounts must sum to the original.
- Original transaction becomes a "parent" with `is_split = true`; children have `parent_transaction_id`.
- Dashboard / reports use the children, not the parent.

### Manual entry
- "**Add transaction**" button on the list.
- Form: date, amount, merchant, category, card (or "cash"), notes.
- Manual transactions are flagged `is_user_confirmed = true` and have `source_statement_id = null`.

### Delete
- Soft-delete (status flag) with 7-day undo banner.
- After 7 days, hard-deleted by a background job.

### Export
- "**Export CSV**" exports the currently filtered view.
- Columns: date, card, merchant, amount, category, notes, source.

## Data model implications

Extends `Transaction` (introduced in Epic 04):

- `transaction_type` (enum: expense | income | transfer | refund, default expense) — set by the AI pipeline (Epic 04); user-overridable via the same inline edit flow as category. `transfer` rows are excluded from all spending totals, cashflow formula inputs, and category reports (see Epic 02b).
- `is_split` (bool, default false), `parent_transaction_id` (nullable self-FK), `is_deleted` (bool), `deleted_at`.
- `TransactionAudit` — id, transaction_id, changed_by_user_id, changed_at, change_kind (enum: created, edited, categorized, split, deleted, undeleted), before (jsonb), after (jsonb).

## API surface (high-level)

- List transactions (filterable, paginated, sortable).
- Get transaction (incl. children if split, audit history).
- Create manual transaction.
- Update transaction.
- Split transaction (creates children, marks parent).
- Bulk update (recategorize many).
- Soft-delete / undo.
- Export CSV.

## Acceptance criteria

- Filter, search, and sort on 5,000+ transactions returns in under 300 ms on a normal connection.
- Splitting a $200 charge into 3 parts produces 3 child rows that sum to $200 (no float drift).
- A manual cash transaction shows up in dashboard totals immediately.
- CSV export reflects the current filter exactly.
- Audit trail captures every edit; the audit view in the modal makes sense to a non-developer.

## Risks & open questions

- **Performance at scale:** denormalize a `cycle_id` onto transactions so cycle-based queries are O(index). Decision in tech spec.
- **Undo window:** 7 days might be too long (clutter) or too short (vacations). MVP picks 7; tune later.
- **Cash account modeling:** "cash" is treated as a virtual card (or "no card") on the transaction. Cashflow (Epic 08) doesn't subtract cash transactions from "money left" because we don't track cash on hand in MVP. **This is a deliberate simplification — document it in the UI tooltip.**
- **Split + recategorize interaction:** when a split's children are recategorized, the parent's category becomes "Split" (read-only). Make this visually obvious.

## Dependencies

- Blocked by: AI Parsing (Epic 04), Categories (Epic 05), Cards (Epic 02), Bank Accounts (Epic 02b).
- Blocks: Cashflow accuracy (Epic 08), Dashboard rollups (Epic 09).
