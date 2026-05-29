# Epic 02b — Bank Accounts

## Goal

Let the household register each checking or savings account they use, so that:

1. Bank statements can be uploaded and associated with the right account.
2. Transaction history (purchases, withdrawals, deposits, transfers) is captured alongside credit card data.
3. Credit card payments and inter-account transfers are properly identified and excluded from spending totals — preventing double-counting with credit card statements.

This is a peer to Epic 02 (Credit Cards). Together they define every account type the household can attach a statement to.

## Personas

- **Account creator** setting up the household — adds the checking/savings accounts the family uses.
- **Secondary member** — adds their own accounts once they join.

## In scope (MVP)

- CRUD for bank accounts: nickname, institution (free text), account type (checking | savings | money market | other), optional last-4 digits, color/icon for UI.
- No billing cycle or payment due date — bank accounts are not billed.
- Soft-delete / archive an account (transactions remain; it stops appearing in upload pickers and dashboards).
- A bank account can be marked **shared** (counts in household view) or **personal** (same semantics as cards).

## Out of scope (MVP — defer)

- Live balance sync (future epic F01).
- Investment or brokerage accounts.
- Loan or mortgage accounts.
- Multiple currencies per account.
- Per-account spending limits or balance alerts.

## User stories

- As a member I want to register my Chase Checking account so I can upload its statements.
- As a member I want to give the account a recognizable name and color so I can tell it apart from my cards at a glance.
- As a member I want to archive an old account without losing its history.

## Key flows

### Add a bank account
1. Settings → Accounts → **"Add bank account"**.
2. Enter: nickname, institution, account type, optional last-4.
3. Save. Account appears in the list alongside credit cards.

### Edit a bank account
- Standard form. No cycle-day logic; no edge cases.

### Archive a bank account
- Confirm modal: "Existing statements and transactions remain. The account stops appearing in new uploads and dashboards."

## Data model implications

New entity:

- `BankAccount` — id, household_id, nickname, institution, account_type (enum: checking | savings | money_market | other), last4 (nullable, 4 chars, display only), color, icon, is_shared (bool, default true), is_archived (bool), created_at, archived_at.

`Statement` (Epic 03) gains a nullable `bank_account_id` FK alongside the existing nullable `card_id`. Exactly one of the two must be set per statement row — enforced at the application layer.

`Transaction` (Epic 06) gains `transaction_type` (enum: **expense | income | transfer | refund**). This field is populated by the AI parsing pipeline (Epic 04) and is the mechanism that prevents double-counting:

- Credit card payments, inter-account transfers, and loan payments parsed from bank statements are tagged `transfer`.
- `transfer` transactions are excluded from all spending totals, cashflow formula inputs, and category reports.
- The dashboard shows `transfer` transactions in a separate "Transfers" section (Epic 09, informational only).

## API surface (high-level)

- List bank accounts (household-scoped, excludes archived by default).
- Get bank account.
- Create bank account.
- Update bank account.
- Archive / unarchive bank account.

## Acceptance criteria

- A user can add a checking and a savings account; both appear in the statement upload picker alongside their credit cards.
- Archived accounts do not appear in the upload card/account picker.
- A credit card payment transaction parsed from a bank statement is tagged `transfer` and does not appear in spending totals or the cashflow formula.
- Uploading both the credit card statement and the bank statement for the same payment does not double-count the charge in "Money Left."

## Risks & open questions

- **Transfer detection accuracy:** the AI must reliably identify credit card payments and inter-account transfers as `transfer` type. False negatives (labeling a transfer as `expense`) inflate spending; false positives suppress real expenses. This is a critical accuracy requirement for Epic 04.
- **User-overridable transfer type:** should users be able to re-type a `transfer` as `expense` (e.g., a Venmo payment that's really a purchase split)? Yes — same inline edit flow as category. Log the override in `TransactionAudit`.
- **Ambiguous P2P payments (Zelle, Venmo):** default to `expense` at parse time; user re-types to `transfer` if needed. Document this in the UI with a tooltip.
- **Balance display:** we do not model the account's running balance in MVP — we only capture transactions. "What's my checking balance?" is out of scope until bank sync (F01).

## Dependencies

- Blocked by: Household (Epic 01).
- Blocks: Statement Ingestion (Epic 03) — a statement must be attachable to either a card or a bank account.
- Blocks: AI Parsing (Epic 04) — must classify `transaction_type` for bank transactions.
- Blocks: Transactions (Epic 06) — `transaction_type` field must be in the model.
- Blocks: Cashflow (Epic 08) — transfer exclusion must be in place before the formula is meaningful.
