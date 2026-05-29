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

## Data model implications

New entities:

- `Statement` — id, household_id, card_id (nullable FK), bank_account_id (nullable FK), uploaded_by_user_id, file_hash, file_storage_key, file_mime, file_size_bytes, file_original_name, period_start (nullable until parsed), period_end (nullable), status (enum), failure_reason (nullable enum), uploaded_at, processed_at, ai_cost_cents (nullable, for telemetry). Exactly one of card_id / bank_account_id must be non-null — enforced at the application layer.
- `Transaction` (created here, owned conceptually by Epic 06) gets `source_statement_id` (nullable — null for manual).

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
