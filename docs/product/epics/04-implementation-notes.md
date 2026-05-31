# Epic 04 — AI Parsing & Categorization: Implementation Notes

## Status: Complete (MVP)

## What was built

### Backend

**New Python packages** (`apps/api/pyproject.toml`):
- `pdfplumber>=0.11` — PDF page extraction and table parsing
- `openai>=1.0` — OpenAI Chat Completions API for normalization + categorization

**New settings** (`apps/api/src/app/core/config.py`):
- `OPENAI_API_KEY` — must be set in `.env` to enable AI (falls back to empty-transaction mock)
- `CONFIDENCE_THRESHOLD` — default 0.7; rows below this are flagged as low-confidence
- `AI_MODEL` — default `gpt-4o-mini`; any OpenAI model supporting `response_format: json_object`

**New module: `categories`** (`src/app/modules/categories/`):
- `Category` model — id, household_id, parent_id (self-referential), name, icon, color, is_system, kind
- `CategoryRule` model — id, household_id, pattern, match_type (substring), category_id, hit_count
- 12 top-level system categories with subcategories seeded on household creation (52 total per household)
- CRUD endpoints: `GET /api/v1/categories`, `GET/POST/DELETE /api/v1/categories/rules`

**New module: `transactions`** (`src/app/modules/transactions/`):
- `Transaction` model — full field set per epic spec including per-field confidence scores
- Amount sign convention: negative = expense/charge, positive = credit/payment
- Endpoints: `GET /api/v1/statements/{id}/transactions`, `PATCH /api/v1/transactions/{id}`, `POST /api/v1/statements/{id}/confirm`

**AI Pipeline** (`src/app/modules/statements/pipeline.py`):
- **Stage 1 (PDF)**: page classifier via heuristic regex (date pattern near amount pattern); pdfplumber table/text extraction on transaction pages only; raises `unreadable_pdf` if no transaction pages found
- **Stage 1 (CSV)**: column fingerprint lookup against `IssuerSchema`; cache hit skips AI schema detection
- **Stage 2 (AI)**: single Anthropic call per 100-row chunk; structured JSON output with per-field confidence
- **Stage 3 (Write)**: category rules applied first (override LLM); transactions inserted; statement status set to `needs_review` (any low confidence) or `ready`
- Graceful fallback to empty-transaction mock when `ANTHROPIC_API_KEY` is unset
- Cost telemetry: `Statement.ai_cost_cents` recorded per processing run

**Replaced stub**: `process_statement_stub` in `service.py` replaced by real `process_statement` pipeline.

**Migration**: `76d03a4c761b_add_categories_rules_transactions.py` — creates `categories`, `category_rules`, `transactions` tables with all indexes and FK constraints.

### Frontend

**New API clients**:
- `src/features/categories/categoriesApi.ts` — listCategories, listRules, createRule, deleteRule
- `src/features/transactions/transactionsApi.ts` — listTransactions, updateTransaction, confirmStatement

**New React Query hooks**:
- `src/features/categories/useCategories.ts` — useCategories (5 min staleTime), useCreateRule, useDeleteRule
- `src/features/transactions/useTransactions.ts` — useTransactions, useUpdateTransaction, useConfirmStatement

**New components**:
- `src/features/transactions/CategoryPicker.tsx` — Select-based category picker with tree flattening (parent + indented children)
- `src/features/transactions/TransactionRow.tsx` — inline-editable row with debounced merchant edit, amber highlight for low-confidence rows
- `src/features/statements/StatementReview.tsx` — transaction table with summary, "Confirm All" button, and rule-suggestion dialog
- `src/routes/secure/statements.$statementId.tsx` — statement detail page

**Route fix**: `statements.tsx` converted to layout route (`<Outlet />`); list page moved to `statements.index.tsx`. Required because TanStack Router requires parent routes to render `<Outlet />` for child routes to mount.

**StatementCard updated**: "Review →" button for `needs_review` statements; "View →" for `ready` statements.

## Bugs found and fixed during QA

1. **Chase `MM/DD` date format** — `DATE_PATTERN` regex in `pipeline.py` required a year (`MM/DD/YY`). Chase statements use `MM/DD` without year. Fixed by making year optional: `r"\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b"`.

2. **Statement detail route hidden by parent** — `statements.tsx` rendered its own component without `<Outlet />`, so child route `statements.$statementId.tsx` never mounted. Fixed by converting `statements.tsx` to a layout route and creating `statements.index.tsx` for the list page.

## Tested behavior (without ANTHROPIC_API_KEY)

- Upload PDF → pipeline runs → statement reaches `ready` status
- `View →` button links to detail page
- Detail page loads: statement name, status badge, "0 transactions — 0 need review"
- "Confirm All" button disabled when no transactions
- Duplicate upload detection works
- Page classifier correctly identifies Chase and Amex transaction pages

## To enable full AI parsing

Set `OPENAI_API_KEY` in `apps/api/.env`:
```
OPENAI_API_KEY=sk-proj-...
```

Optionally override the model (default `gpt-4o-mini`):
```
AI_MODEL=gpt-4o-mini
```

The pipeline uses OpenAI's JSON mode (`response_format: json_object`), so output is always valid JSON — no markdown fence stripping required. Cost for gpt-4o-mini: $0.15/1M input + $0.60/1M output tokens.

## Known limitations (by design — deferred to V1)

- Vision-model fallback for scanned/image PDFs
- Per-issuer prompt specialization
- Active learning loop on user corrections
- Streaming partial results to UI
- Per-authorized-user attribution in multi-cardholder statements (all linked to primary card)
