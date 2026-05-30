# Epic 03 — Statement Upload & Ingestion

## Goal

The user uploads a credit-card statement (PDF, possibly CSV) and the system reliably runs it through the parsing pipeline, surfacing **clear status** at every step. By the end, the statement's transactions are in the database — either confirmed or queued for review — and the user knows whether the upload was successful.

This epic owns the **lifecycle and UX** of statement processing. The AI parsing/categorization itself lives in Epic 04.

## Personas

- **Member uploading** — typically once per cycle, per card.
- **Member browsing later** — checks if an old statement processed cleanly.

## In scope (MVP)

- Drag-and-drop or file-picker upload, one file at a time (multi-file in V1).
- Accept PDF (primary) and CSV (secondary). Reject other formats with clear error copy.
- File size cap (e.g., 25 MB) with clear message.
- Associate upload with one **account** (card or bank account, selected from a unified picker).
- Optional: user labels the statement period (auto-detected after parsing, but user can override).
- Server-side: store the file (encrypted at rest), enqueue parsing job, return immediately.
- A **Statement** record has a clear status: `queued → parsing → categorizing → needs_review → ready` (or `failed` at any step).
- Live status updates on the upload page (polling is acceptable for MVP; SSE/websocket is V1+).
- Re-upload of the exact same file (by hash) is detected and short-circuited — no re-processing, no double transactions, clear UX message.
- A **review queue** UI surfaces statements in `needs_review` state.
- Per-statement detail view: show the source file, parsed transactions, parsing logs (basic), and a "delete & re-import" action.

## Out of scope (MVP — defer)

- Multi-file / bulk upload.
- Image-based statement scans (only text-extractable PDFs in MVP). Scanned/image PDFs fail gracefully and tell the user we can't process them yet.
- Encrypted/password-protected PDFs (fail gracefully).
- Auto-detecting which card a statement belongs to (user picks it manually in MVP).
- Background email-attachment ingestion ("forward your statement to upload@…") — V1+.

## User stories

- As a member I want to drag a statement onto the upload area, pick the card it's from, and submit — and then come back later to see it processed.
- As a member I want to see clear, non-technical status messages so I know whether to wait, retry, or fix something.
- As a member I want a way to re-upload the same statement without creating duplicates if the first attempt failed.
- As a member I want to delete a statement (and its transactions) if I uploaded it to the wrong card or it processed badly.
- As a member I want to see a single place that lists statements needing my review.

## Key flows

### Happy path
1. User opens **Upload**.
2. Picks card from dropdown (cards from Epic 02).
3. Drags PDF onto drop zone.
4. Frontend uploads file with progress bar.
5. Server stores file, returns `Statement {id, status: queued}`.
6. Background job runs (Epic 04): status progresses through `parsing` → `categorizing`.
7. If everything has high confidence → status `ready`. User sees a success toast and the transactions appear in Transactions and Dashboard.
8. If some rows are low-confidence → status `needs_review`. User is prompted to review.

### Re-upload of the same file
- Server hashes the file (SHA-256).
- If hash matches an existing statement in the same household:
  - Show: *"You already uploaded this on YYYY-MM-DD. We didn't re-process it. [View statement]"*
  - No new Statement row, no new transactions.

### Failed parse
- Status `failed` with a categorical reason: `unreadable_pdf | encrypted | unsupported_format | parsing_error | ai_unavailable`.
- UI shows what to do (e.g., "This PDF appears to be a scan — text extraction failed. Try saving the PDF as text from your issuer's site.").
- User can delete the statement to start over.

### Delete statement
- Removes the Statement and **all transactions linked to it** (transactions know their source statement).
- Confirm modal explicitly states how many transactions will be removed.
- Manual transactions are unaffected.

## Decisions

The following are locked for MVP and must not drift in implementation:

### D1 — Issuer schema caching
When a statement is parsed for the first time from an unknown issuer format, the detected column mapping is stored in the `IssuerSchema` table and keyed by a fingerprint of the raw column headers (SHA-256 of sorted, lowercased headers). On any subsequent upload whose headers produce the same fingerprint, the cached mapping is applied directly — no AI call needed for schema detection. This applies to CSV files; PDF fingerprinting is deferred to V1.

`IssuerSchema` records are **global** (not per-household). If one user uploads a Chase CSV, the next user's Chase CSV benefits automatically.

### D2 — Amount sign convention
Stored amounts are always from the account-holder's perspective:
- **Negative** = money leaving the account (purchases, fees, cash advances).
- **Positive** = money entering the account (refunds, credits, cashback, payment received).

This is the opposite of how most bank PDFs present charges (they show purchases as positive). The parsing pipeline is responsible for flipping the sign before writing to the database. All downstream math (Dashboard, cashflow) must assume this convention without any additional sign logic.

### D3 — Currency
MVP supports **USD only**. The `currency` column exists on `Transaction` for future-proofing but is always written as `USD` and never exposed as a user-editable field. A statement containing non-USD amounts fails with `unsupported_format` until multi-currency is scoped.

### D4 — File storage
Uploaded statement files are stored on the **local filesystem** in dev (path: `data/statements/{household_id}/{statement_id}/{original_filename}`). The `Statement` row stores the relative path in `file_storage_path`. In production this path will point to an S3-compatible object key (e.g., Cloudflare R2) — the column name stays the same, only the value format changes. The UI retrieves the file via a signed download endpoint; the path is never exposed directly in API responses.

---

## Data model implications

### `IssuerSchema`

Stores detected column layouts so repeat uploads from the same issuer are parsed without an AI schema-detection call.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| issuer_name | varchar(100) | Human-readable label, e.g. `Chase`, `Amex`. Set by AI on first detection; editable by operator. |
| file_format | enum `pdf\|csv` | |
| column_fingerprint | varchar(64) | SHA-256 of sorted, lowercased raw column headers (CSV). For PDF, reserved for V1. |
| column_mapping | jsonb | Maps canonical field names → raw header names. E.g. `{"date": "Transaction Date", "amount": "Amount", "description": "Description"}`. |
| raw_headers | text[] | Original header strings as-found, stored for debugging. |
| usage_count | int default 0 | Incremented each time this schema is applied. |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| last_used_at | timestamptz | |

Canonical field names in `column_mapping`: `date`, `posted_date`, `description`, `amount`, `debit`, `credit`, `reference`, `type`.

When `debit` and `credit` are both present (split-column issuers like Citi), the parser merges them: `amount = -(debit ?? 0) + (credit ?? 0)` to produce the signed value per D2.

---

### `Statement`

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| household_id | uuid FK | |
| card_id | uuid nullable FK | Exactly one of card_id / bank_account_id must be non-null (app-layer constraint). |
| bank_account_id | uuid nullable FK | |
| uploaded_by_user_id | uuid FK | |
| issuer_schema_id | uuid nullable FK → IssuerSchema | Populated when a matching schema is found or created during parsing. |
| file_hash | varchar(64) | SHA-256 of raw file bytes. Used for duplicate detection. |
| file_storage_path | varchar(500) | Relative path on disk (dev) or object key (prod). Never returned raw in API responses. |
| file_mime | varchar(100) | `application/pdf` or `text/csv`. |
| file_size_bytes | int | |
| file_original_name | varchar(255) | Original filename from the upload. |
| period_start | date nullable | Null until parsed; can be overridden by user. |
| period_end | date nullable | Null until parsed; can be overridden by user. |
| status | enum | `queued → parsing → categorizing → needs_review → ready → failed` |
| failure_reason | enum nullable | `unreadable_pdf \| encrypted \| unsupported_format \| parsing_error \| ai_unavailable` |
| uploaded_at | timestamptz | |
| processed_at | timestamptz nullable | Set when status reaches `ready` or `failed`. |
| ai_cost_cents | int nullable | Sum of all LLM call costs for this statement, in USD cents × 100. |

---

### `Transaction` *(additions relevant to this epic)*

Full definition lives in Epic 06. Columns added or constrained here:

| Column | Type | Notes |
|---|---|---|
| source_statement_id | uuid nullable FK → Statement | Null for manually-entered transactions. |
| occurred_on | date | Transaction date (from statement). |
| posted_on | date nullable | Posted/settlement date if the statement provides it separately. |
| amount | numeric(12,2) | Signed per D2: negative = expense, positive = credit/refund. |
| currency | varchar(3) default `USD` | Always `USD` in MVP (see D3). |
| transaction_type | enum | `purchase \| payment \| fee \| cash_advance \| credit \| refund`. Payments to the card are stored but excluded from expense aggregations. |
| merchant_raw | varchar(500) | Verbatim string from the statement. |
| merchant_clean | varchar(255) nullable | AI-normalized name, e.g. `Coffee Bar`. Null until Epic 04 runs. |
| category_id | uuid nullable FK | |
| is_user_confirmed | bool default false | Set to true when user confirms via review UI. |
| confidence | jsonb nullable | Per-field confidence scores from AI, e.g. `{"amount": 0.99, "category": 0.72}`. |

## API surface (high-level)

- Upload statement (multipart, returns Statement).
- List statements (paginated, filterable by card, status).
- Get statement detail (includes linked transactions).
- Delete statement.
- Get/poll statement status.
- Re-trigger processing (admin or self, for failed statements).

## Acceptance criteria

- A 5-page Amex PDF uploads, processes, and lands in the dashboard within 2 minutes on a normal day.
- Uploading the same file twice never creates duplicate transactions.
- A failed statement's reason is human-readable and actionable.
- The list of pending statements is visible on the dashboard until they're processed.
- Deleting a statement removes exactly its transactions and nothing else.

## Risks & open questions

- **Storage choice:** local filesystem for dev; S3-compatible (e.g., R2, MinIO) for prod. To be decided in tech spec.
- **Encryption at rest:** required for prod. See cross-cutting risk #5.
- **Job runner:** in-process background tasks are tempting but fragile. A real queue (Redis-backed, e.g., RQ or Arq) is preferable from day one.
- **Polling vs. push:** polling every 3s is fine for MVP single-user load; revisit at V1.
- **Cost cap:** statement processing cost feeds into the AI cost risk. Track per-statement `ai_cost_cents`.

## Dependencies

- Blocked by: Cards (Epic 02) and Bank Accounts (Epic 02b) — a statement must belong to one or the other.
- Blocks: AI Parsing (Epic 04), Transactions (Epic 06).
- Hard interaction with: Dashboard (Epic 09) — must surface pending statements.
