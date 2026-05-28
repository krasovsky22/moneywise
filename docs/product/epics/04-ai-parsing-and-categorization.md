# Epic 04 — AI Parsing & Categorization

## Goal

Given a stored statement file, produce a clean list of transactions in the database, each with:

- date, amount, merchant string, raw description,
- a category assignment (from Epic 05's taxonomy),
- a confidence score on every AI-derived field,
- a link back to its source statement.

This epic owns the **AI pipeline**: prompts, models, fallback logic, accuracy validation, and the human-in-the-loop review surface. The user-visible lifecycle wrapper lives in Epic 03.

## Personas

- **Member** — primarily indirect; they care that it works, not how.
- **Operator / future PM** — needs telemetry to know whether the pipeline is healthy.

## In scope (MVP)

- **Stage 1: extract structured transactions from the PDF.**
  - Prefer cheap, deterministic PDF text extraction first.
  - If text extraction yields no usable content (image PDFs), the pipeline fails with the `unreadable_pdf` reason. **Vision-based extraction is V1 — not MVP.**
- **Stage 2: send extracted rows to an LLM for normalization + categorization in a single call** where reasonable, with structured JSON output.
  - Normalize merchant strings (e.g., `SQ *COFFEE BAR #1234` → `Coffee Bar`).
  - Assign a category from the predefined taxonomy.
  - Output a confidence score per field.
- **Total reconciliation check:** the sum of extracted transactions must equal the statement's stated total (within a small tolerance for fees/credits we may miss). If it doesn't, statement goes to `needs_review`.
- **Confidence threshold:** rows below a confidence threshold (e.g., 0.7) are flagged. If any row is flagged, the statement goes to `needs_review`.
- **Review UI:** a per-statement view shows extracted rows, highlights low-confidence ones, lets the user correct date / amount / merchant / category, and confirm.
- **User corrections feed a rules engine** (Epic 05): "always categorize Starbucks as Coffee" is learned from a single correction.
- **Cost telemetry:** every AI call records token usage, model used, and dollar cost into `Statement.ai_cost_cents`.

## Out of scope (MVP — defer)

- Vision-model fallback for scanned PDFs (V1).
- Per-issuer prompt specialization (V1, once we have data on which issuers fail).
- Active learning loop that re-trains a small model on user corrections (V2+).
- Categorizing across multiple cards in one pass for de-duplication (V1).
- Streaming partial results to the UI as parsing happens (V1, nice-to-have).

## User stories

- As a member I want the system to do the boring work of typing in transactions — but I want to spot-check the result.
- As a member I want to correct a wrong category once and have similar future transactions categorized correctly.
- As a member I want to know when the system is *unsure* so I can verify rather than blindly trust.
- As an operator I want to know how much each statement costs to process so I can manage unit economics.

## Key flows

### Standard processing
1. Statement ingestion (Epic 03) enqueues a parse job.
2. Worker extracts text from the PDF. If empty, fail with `unreadable_pdf`.
3. Worker sends extracted lines to LLM with a structured prompt:
   - Input: statement text, known card metadata, predefined category list.
   - Output: JSON array of `{date, amount, merchant_clean, merchant_raw, category, confidence_fields, notes}` plus `statement_total_observed` and `statement_period`.
4. Worker validates: schema, total reconciliation, date ranges.
5. Worker writes transactions, sets statement status:
   - All confidences ≥ threshold and total matches → `ready`.
   - Otherwise → `needs_review`.

### Review
- User opens a statement in `needs_review`.
- Sees a table: each row has its parsed values, with red/yellow markers on low-confidence fields.
- User can edit inline, change category from a picker.
- User clicks **Confirm** to move statement → `ready`. All transactions become "user-confirmed."

### Learned rules
- When a user changes a category for a transaction, offer: *"Always categorize 'Starbucks' as 'Food & Drink → Coffee'?"*
- On accept, save a `CategoryRule` (Epic 05). Future transactions matching the rule bypass the LLM category and use the rule.

## Data model implications

- `Transaction` — id, household_id, card_id, source_statement_id (nullable), occurred_on (date), amount (money, signed: positive=charge, negative=credit/return), merchant_clean, merchant_raw, category_id (nullable), notes, is_user_confirmed (bool), confidence (jsonb: per-field scores), created_at, updated_at.
- `CategoryRule` (defined fully in Epic 05).
- Reuses `Statement.ai_cost_cents`, `Statement.status`, `Statement.failure_reason` from Epic 03.

## API surface (high-level)

- Trigger / retry processing of a statement.
- List transactions for a statement (with confidence metadata).
- Update a transaction (corrects merchant, category, amount, date).
- Confirm a statement (bulk-mark all its transactions as user-confirmed).
- Get telemetry per statement (admin only).

## Acceptance criteria

- On a test corpus of 30 statements across 3+ issuers, ≥ 90 % of transactions are extracted correctly (correct amount, date, merchant string up to normalization).
- ≥ 80 % of transactions get a sensible category on first pass.
- Total reconciliation check correctly flags ≥ 95 % of statements where extraction missed rows.
- Average AI cost per statement is below a target threshold (TBD; tracked from day one).
- Correcting a category and accepting the rule prompt causes future matching transactions to be categorized via the rule, not the LLM.

## Risks & open questions

- See cross-cutting risks #1 (variability), #2 (cost), #3 (trust). These are this epic's core threats.
- **Model choice:** start with a Haiku-class model for text-extracted statements. Validate accuracy first; switch up if needed. **Decision needed before build.**
- **Hallucinated transactions:** the LLM can invent rows. The reconciliation check is our primary defense; a secondary check would compare merchant strings to actual substrings of the source text.
- **Date parsing across locales:** US-only MVP — but issuers sometimes use ambiguous formats. Always require the LLM to also output an ISO date and validate it falls within the statement period.
- **Privacy:** LLM provider contract must include zero-retention. Open question: do we still send the *whole* statement, or pre-redact PANs first? Recommend pre-redact.

## Dependencies

- Blocked by: Statement Ingestion (Epic 03), Categories (Epic 05) — needs the taxonomy.
- Blocks: Transactions browse (Epic 06) usefulness, Dashboard (Epic 09).
