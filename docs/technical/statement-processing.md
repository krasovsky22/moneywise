# Statement Upload & Parsing — Technical Reference

This document explains end-to-end how a statement file goes from the user's browser to a list of categorized transactions in the database.

---

## Table of Contents

1. [Upload flow](#1-upload-flow)
2. [Background pipeline stages](#2-background-pipeline-stages)
   - [Stage 0 — Queued](#stage-0--queued)
   - [Stage 1 — Parsing (extract rows)](#stage-1--parsing-extract-rows)
   - [Stage 2 — Categorizing (AI call)](#stage-2--categorizing-ai-call)
   - [Stage 3 — Write & finalize](#stage-3--write--finalize)
3. [Status state machine](#3-status-state-machine)
4. [Review & confirm flow](#4-review--confirm-flow)
5. [Category rules engine](#5-category-rules-engine)
6. [Data model overview](#6-data-model-overview)
7. [Code map](#7-code-map)

---

## 1. Upload flow

The user picks a file and associates it with a card or bank account. The HTTP request is handled synchronously up to the point of saving the file; the heavy parsing work runs in a background task so the HTTP response returns immediately.

```mermaid
sequenceDiagram
    participant Browser
    participant Vite as Vite proxy (:3000)
    participant API as FastAPI (:8000)
    participant DB as PostgreSQL
    participant FS as Local filesystem

    Browser->>Vite: POST /api/v1/statements (multipart form)
    Vite->>API: proxied request
    API->>API: validate MIME type (PDF or CSV only)
    API->>API: read bytes, check ≤ 25 MB
    API->>API: SHA-256 hash of file bytes
    API->>DB: SELECT statements WHERE file_hash = ? AND household_id = ?
    alt duplicate found
        DB-->>API: existing statement row
        API-->>Browser: 201 { duplicate: true, existing_statement_id }
    else new file
        DB-->>API: no rows
        API->>DB: INSERT statements (status = queued)
        DB-->>API: new statement.id (UUID)
        API->>FS: write bytes to data/statements/{household_id}/{statement_id}/{filename}
        API->>DB: UPDATE statements SET file_storage_path = ?
        API->>DB: COMMIT
        API->>API: enqueue process_statement(id) as BackgroundTask
        API-->>Browser: 201 { duplicate: false, statement: {...} }
    end
```

**Key files:**
- Upload handler: [`apps/api/src/app/modules/statements/router.py`](../../apps/api/src/app/modules/statements/router.py) — `upload_statement()`
- File save + hash: [`apps/api/src/app/modules/statements/service.py`](../../apps/api/src/app/modules/statements/service.py) — `compute_file_hash()`, `save_file()`
- Frontend uploader: [`apps/web/src/features/statements/StatementUploader.tsx`](../../apps/web/src/features/statements/StatementUploader.tsx)
- Frontend API call: [`apps/web/src/features/statements/statementsApi.ts`](../../apps/web/src/features/statements/statementsApi.ts) — `uploadStatement()`

---

## 2. Background pipeline stages

`process_statement()` is the main orchestrator. It runs in a FastAPI `BackgroundTask` — no separate worker process or queue. Each stage commits to the DB so the frontend's status-polling endpoint always reflects the current stage.

```mermaid
flowchart TD
    START([process_statement called]) --> S0[Set status = parsing]
    S0 --> FORMAT{File format?}

    FORMAT -- PDF --> PDF1[Split into pages\npdfplumber]
    PDF1 --> PDF2{Any page matches\ndate + amount regex?}
    PDF2 -- No --> FAIL_UNREADABLE[status = failed\nfailure_reason = unreadable_pdf]
    PDF2 -- Yes --> PDF3[Extract tables/text from\ntransaction pages only]
    PDF3 --> ROWS[raw rows list]

    FORMAT -- CSV --> CSV1[Read with csv.DictReader]
    CSV1 --> CSV2[SHA-256 of sorted column headers\n= column fingerprint]
    CSV2 --> CSV3{IssuerSchema cached\nfor this fingerprint?}
    CSV3 -- Yes --> CSV4[Apply stored column_mapping\nrename fields to canonical names]
    CSV3 -- No --> CSV5[Let AI detect schema\non next stage]
    CSV4 --> ROWS
    CSV5 --> ROWS

    ROWS --> S1[Set status = categorizing]
    S1 --> KEY{OPENAI_API_KEY set?}
    KEY -- No --> MOCK[_mock_parse\nreturn 0 transactions]
    KEY -- Yes --> CHUNK{rows > 100?}
    CHUNK -- Yes --> MULTI[Split into 100-row chunks\ncall AI per chunk\nmerge results]
    CHUNK -- No --> SINGLE[Single AI call]
    MULTI --> AI_OUT[JSON: transactions\nstatement_total_observed\nstatement_period]
    SINGLE --> AI_OUT
    MOCK --> WRITE

    AI_OUT --> RULES[Apply category rules\nper merchant_clean\nrule match overrides AI category]
    RULES --> CONF{Any transaction\nconfidence < 0.7?}
    CONF -- Yes --> NR[status = needs_review]
    CONF -- No --> READY[status = ready]
    NR --> WRITE[INSERT transactions\nUPDATE statement\nCOMMIT]
    READY --> WRITE
    WRITE --> DONE([Done])

    FAIL_UNREADABLE --> DONE
```

### Stage 0 — Queued

The statement row exists in the DB with `status = queued`. The frontend's `StatementCard` polls `GET /api/v1/statements/{id}/status` every 3 seconds and updates the UI badge in real time.

**Polling:** [`apps/web/src/features/statements/useStatements.ts`](../../apps/web/src/features/statements/useStatements.ts) — `useStatementStatus()` with `refetchInterval: 3000`

---

### Stage 1 — Parsing (extract rows)

Sets `status = parsing`, then extracts a flat list of raw rows from the file. What "a row" looks like differs by format.

#### PDF path

```mermaid
flowchart LR
    PDF[PDF file] --> PAGES[iterate pages]
    PAGES --> HEURISTIC["is_transaction_page(text)\ndate regex near amount regex\nwithin 300 chars"]
    HEURISTIC -- transaction page --> EXTRACT["pdfplumber:\nextract_tables() first\nfall back to extract_text()"]
    HEURISTIC -- boilerplate page --> SKIP[skip]
    EXTRACT --> ROWDICT["{ _source: 'table', _cells: [...] }\nor { _source: 'text', _line: '...' }"]
```

The heuristic that classifies pages:

```python
DATE_PATTERN  = re.compile(r"\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b")   # MM/DD or MM/DD/YY(YY)
AMOUNT_PATTERN = re.compile(r"\$[\d,]+\.\d{2}|\b-?\d{1,3}(?:,\d{3})*\.\d{2}\b")

def is_transaction_page(text: str) -> bool:
    # a date and an amount must appear within 300 characters of each other
```

Real-world examples this handles:
- **Amex (18 pages):** pages 3–8 are transaction pages; 9–17 are legal boilerplate; 18 is blank
- **Chase checking (4 pages):** page 1 has all 7 transactions; pages 2–4 are disclosures

If zero pages pass the heuristic → `status = failed`, `failure_reason = unreadable_pdf`.

**Code:** [`apps/api/src/app/modules/statements/pipeline.py`](../../apps/api/src/app/modules/statements/pipeline.py) — `is_transaction_page()`, `extract_pdf_pages()`

#### CSV path

```mermaid
flowchart LR
    CSV[CSV file] --> READ[csv.DictReader]
    READ --> HEADERS[sorted lowercase headers]
    HEADERS --> FP[SHA-256 fingerprint]
    FP --> LOOKUP[SELECT issuer_schemas\nWHERE column_fingerprint = ?]
    LOOKUP -- hit --> MAP[rename columns\nvia column_mapping dict]
    LOOKUP -- miss --> PASSTHROUGH[pass raw headers to AI\nAI detects column roles\nnew IssuerSchema saved]
    MAP --> ROWS[canonical rows]
    PASSTHROUGH --> ROWS
```

**Code:** [`apps/api/src/app/modules/statements/pipeline.py`](../../apps/api/src/app/modules/statements/pipeline.py) — `compute_column_fingerprint()`, `extract_csv_rows()`  
**Model:** [`apps/api/src/app/modules/statements/models.py`](../../apps/api/src/app/modules/statements/models.py) — `IssuerSchema`

---

### Stage 2 — Categorizing (AI call)

Sets `status = categorizing`, then sends the extracted rows to OpenAI. Rows are chunked at 100 per call to stay within context limits; results are merged in order.

```mermaid
sequenceDiagram
    participant Pipeline
    participant OpenAI

    Pipeline->>Pipeline: build system prompt (rules + output schema)
    Pipeline->>Pipeline: inject: card_info, file_format, category list, raw rows (≤100)
    Pipeline->>OpenAI: POST /v1/chat/completions\nmodel: gpt-4o-mini\nresponse_format: { type: json_object }
    OpenAI-->>Pipeline: JSON response (no markdown fences needed)
    Pipeline->>Pipeline: parse JSON
    Pipeline->>Pipeline: record usage.prompt_tokens + completion_tokens → ai_cost_cents
```

**System prompt instructs the model to:**
- Normalize merchant names (`SQ *COFFEE BAR #1234` → `Coffee Bar`)
- Assign a category from the household's category list only
- Use sign convention: negative = expense, positive = credit/payment
- Skip section headers, balance rows, summary rows
- Output ISO 8601 dates
- Return a `confidence_per_field` object (0.0–1.0) for `date`, `amount`, `merchant`, `category`

**Output schema:**
```json
{
  "transactions": [
    {
      "date_iso": "2026-04-14",
      "amount": -45.20,
      "merchant_clean": "Whole Foods",
      "merchant_raw": "WHOLEFDS #10423 AUSTIN TX",
      "transaction_type": "charge",
      "category": "Groceries",
      "confidence_per_field": { "date": 0.99, "amount": 0.99, "merchant": 0.90, "category": 0.85 },
      "notes": null
    }
  ],
  "statement_total_observed": 3337.50,
  "statement_period": { "start": "2026-04-22", "end": "2026-05-22" }
}
```

`response_format: json_object` (JSON mode) guarantees valid JSON — no markdown fence stripping.

**Code:** [`apps/api/src/app/modules/statements/pipeline.py`](../../apps/api/src/app/modules/statements/pipeline.py) — `normalize_with_ai()`, `SYSTEM_PROMPT`, `USER_PROMPT_TEMPLATE`

---

### Stage 3 — Write & finalize

```mermaid
flowchart TD
    AI[AI transactions list] --> EACH[for each transaction]
    EACH --> RULE{category rule\nmatches merchant_clean?}
    RULE -- Yes --> USE_RULE[use rule's category_id\nincrement rule.hit_count]
    RULE -- No --> USE_AI[use AI's category name\nlookup id in categories table]
    USE_RULE --> ROW[build Transaction ORM object]
    USE_AI --> ROW
    ROW --> CONF{min confidence\nacross all fields < 0.7?}
    CONF -- Yes --> FLAG[is_low_confidence = true]
    CONF -- No --> NOFLAG[is_low_confidence = false]
    FLAG --> INSERT
    NOFLAG --> INSERT
    INSERT[session.add_all transactions] --> STATUS{any low\nconfidence rows?}
    STATUS -- Yes --> NR[statement.status = needs_review]
    STATUS -- No --> READY[statement.status = ready]
    NR --> COMMIT[UPDATE statement\nprocessed_at = now\nCOMMIT]
    READY --> COMMIT
```

**Cost telemetry** — recorded on every parse:
```
ai_cost_cents = (input_tokens × $0.15 + output_tokens × $0.60) / 1,000,000 × 100
```
Visible via `GET /api/v1/statements/{id}` → `ai_cost_cents` field.

**Code:** [`apps/api/src/app/modules/statements/pipeline.py`](../../apps/api/src/app/modules/statements/pipeline.py) — `process_statement()` (write section)  
**Transaction model:** [`apps/api/src/app/modules/transactions/models.py`](../../apps/api/src/app/modules/transactions/models.py)

---

## 3. Status state machine

```mermaid
stateDiagram-v2
    [*] --> queued : upload accepted

    queued --> parsing : pipeline starts
    parsing --> categorizing : rows extracted
    parsing --> failed : unreadable_pdf / exception

    categorizing --> ready : all confidence ≥ 0.7
    categorizing --> needs_review : any confidence < 0.7
    categorizing --> failed : exception

    failed --> queued : POST /reprocess
    needs_review --> queued : POST /reprocess (re-runs full pipeline)
    needs_review --> ready : POST /confirm (user confirms all rows)

    ready --> [*]
```

**Transitions triggered by:**
| From | To | Trigger |
|------|----|---------|
| upload | `queued` | `upload_statement()` |
| `queued` | `parsing` | `process_statement()` start |
| `parsing` | `categorizing` | rows extracted successfully |
| `parsing` | `failed` | `unreadable_pdf` or unhandled exception |
| `categorizing` | `ready` | all transaction confidence ≥ threshold |
| `categorizing` | `needs_review` | any transaction confidence < threshold |
| `failed` / `needs_review` | `queued` | `POST /api/v1/statements/{id}/reprocess` |
| `needs_review` | `ready` | `POST /api/v1/statements/{id}/confirm` |

**Router:** [`apps/api/src/app/modules/statements/router.py`](../../apps/api/src/app/modules/statements/router.py)  
**Transactions router:** [`apps/api/src/app/modules/transactions/router.py`](../../apps/api/src/app/modules/transactions/router.py)

---

## 4. Review & confirm flow

When a statement lands in `needs_review`, the user must inspect and approve the extracted transactions.

```mermaid
sequenceDiagram
    actor User
    participant UI as StatementReview.tsx
    participant API

    User->>UI: clicks "Review →" on StatementCard
    UI->>API: GET /api/v1/statements/{id}
    UI->>API: GET /api/v1/statements/{id}/transactions
    UI->>API: GET /api/v1/categories
    API-->>UI: statement + transactions + category tree

    UI->>User: table of transactions\nlow-confidence rows highlighted amber

    User->>UI: edits merchant name on a row
    UI->>API: PATCH /api/v1/transactions/{id}\n{ merchant_clean: "New Name" }
    API-->>UI: updated transaction

    User->>UI: changes category on a row
    UI->>User: "Always categorize 'New Name' as 'Groceries'?" dialog
    User->>UI: Accept
    UI->>API: POST /api/v1/categories/rules\n{ pattern: "New Name", category_id: "..." }
    API-->>UI: new rule

    User->>UI: clicks "Confirm All (N remaining)"
    UI->>API: POST /api/v1/statements/{id}/confirm
    API->>API: UPDATE transactions SET is_user_confirmed = true
    API->>API: UPDATE statement SET status = ready
    API-->>UI: { confirmed_count: N }
    UI->>UI: invalidate statement + transaction queries
```

**Frontend components:**
- Detail page: [`apps/web/src/routes/secure/statements.$statementId.tsx`](../../apps/web/src/routes/secure/statements.$statementId.tsx)
- Review table: [`apps/web/src/features/statements/StatementReview.tsx`](../../apps/web/src/features/statements/StatementReview.tsx)
- Editable row: [`apps/web/src/features/transactions/TransactionRow.tsx`](../../apps/web/src/features/transactions/TransactionRow.tsx)
- Category picker: [`apps/web/src/features/transactions/CategoryPicker.tsx`](../../apps/web/src/features/transactions/CategoryPicker.tsx)

**API hooks:**
- [`apps/web/src/features/transactions/useTransactions.ts`](../../apps/web/src/features/transactions/useTransactions.ts) — `useTransactions`, `useUpdateTransaction`, `useConfirmStatement`
- [`apps/web/src/features/categories/useCategories.ts`](../../apps/web/src/features/categories/useCategories.ts) — `useCategories`, `useCreateRule`

---

## 5. Category rules engine

Rules let users teach the system: "whenever you see this merchant, always use this category." They are applied **before** the AI category is written to the DB, so the rule always wins.

```mermaid
flowchart LR
    TX[transaction from AI] --> RULES[apply_rules\nmerchant_clean vs all rules\ncase-insensitive substring match]
    RULES -- match found --> OVERRIDE[use rule.category_id\nhit_count++\nlast_applied_at = now]
    RULES -- no match --> AI_CAT[use AI category]
    OVERRIDE --> WRITE[write Transaction]
    AI_CAT --> WRITE
```

Rule creation happens in two ways:
1. **Review dialog** — user changes a category, UI prompts "Always categorize X as Y?", user clicks Accept → `POST /api/v1/categories/rules`
2. **Settings** (future) — user manages rules directly

**Rule matching** is a simple in-memory loop — no DB query per transaction:
```python
def apply_rules(rules: list[CategoryRule], merchant_clean: str) -> CategoryRule | None:
    merchant_lower = merchant_clean.lower()
    for rule in rules:
        if rule.pattern.lower() in merchant_lower:
            return rule
    return None
```

First match wins. Multiple matching rules → the first rule in insertion order wins (most recently created is at the end, so oldest rule wins — this is intentional for predictability).

**Code:** [`apps/api/src/app/modules/categories/service.py`](../../apps/api/src/app/modules/categories/service.py) — `apply_rules()`  
**Model:** [`apps/api/src/app/modules/categories/models.py`](../../apps/api/src/app/modules/categories/models.py) — `CategoryRule`

---

## 6. Data model overview

```mermaid
erDiagram
    households ||--o{ statements : "has"
    households ||--o{ categories : "owns"
    households ||--o{ category_rules : "owns"
    statements ||--o{ transactions : "produces"
    cards ||--o{ statements : "linked to"
    bank_accounts ||--o{ statements : "linked to"
    issuer_schemas ||--o{ statements : "classifies"
    categories ||--o{ transactions : "categorizes"
    categories ||--o{ category_rules : "target of"
    categories ||--o{ categories : "parent of (self-ref)"

    statements {
        uuid id PK
        uuid household_id FK
        uuid card_id FK "nullable"
        uuid bank_account_id FK "nullable"
        uuid issuer_schema_id FK "nullable"
        string file_hash "SHA-256, dedup key"
        string file_storage_path
        string status "queued|parsing|categorizing|needs_review|ready|failed"
        string failure_reason "nullable"
        int ai_cost_cents "nullable"
        date period_start "nullable"
        date period_end "nullable"
        datetime uploaded_at
        datetime processed_at "nullable"
    }

    transactions {
        uuid id PK
        uuid statement_id FK
        uuid household_id FK
        uuid category_id FK "nullable"
        date date
        decimal amount "negative=expense"
        string merchant_clean
        string merchant_raw
        string transaction_type "charge|payment|credit|refund"
        float confidence_date
        float confidence_amount
        float confidence_merchant
        float confidence_category
        bool is_low_confidence
        bool is_user_confirmed
    }

    categories {
        uuid id PK
        uuid household_id FK
        uuid parent_id FK "nullable, self-ref"
        string name
        string icon
        string color
        bool is_system
        string kind "spending|income|transfer"
    }

    category_rules {
        uuid id PK
        uuid household_id FK
        uuid category_id FK
        string pattern "substring to match"
        int hit_count
        datetime last_applied_at "nullable"
    }

    issuer_schemas {
        uuid id PK
        string issuer_name
        string file_format "pdf|csv"
        string column_fingerprint "SHA-256 of sorted headers"
        json column_mapping "raw_col -> canonical_col"
        int usage_count
    }
```

---

## 7. Code map

| Concern | File |
|---------|------|
| Upload HTTP handler | [`apps/api/src/app/modules/statements/router.py`](../../apps/api/src/app/modules/statements/router.py) |
| File save, hash, duplicate check | [`apps/api/src/app/modules/statements/service.py`](../../apps/api/src/app/modules/statements/service.py) |
| Full pipeline orchestrator | [`apps/api/src/app/modules/statements/pipeline.py`](../../apps/api/src/app/modules/statements/pipeline.py) |
| PDF page classifier | `pipeline.py` → `is_transaction_page()` |
| PDF row extractor | `pipeline.py` → `extract_pdf_pages()` |
| CSV row extractor + fingerprint | `pipeline.py` → `extract_csv_rows()`, `compute_column_fingerprint()` |
| AI call (OpenAI) | `pipeline.py` → `normalize_with_ai()` |
| Transaction write + status update | `pipeline.py` → `process_statement()` (write section) |
| Statement ORM model | [`apps/api/src/app/modules/statements/models.py`](../../apps/api/src/app/modules/statements/models.py) |
| Transaction ORM model | [`apps/api/src/app/modules/transactions/models.py`](../../apps/api/src/app/modules/transactions/models.py) |
| Category + CategoryRule models | [`apps/api/src/app/modules/categories/models.py`](../../apps/api/src/app/modules/categories/models.py) |
| Category seeding (52 defaults) | [`apps/api/src/app/modules/categories/service.py`](../../apps/api/src/app/modules/categories/service.py) → `seed_categories()` |
| Rule matching | `categories/service.py` → `apply_rules()` |
| Confirm statement endpoint | [`apps/api/src/app/modules/transactions/router.py`](../../apps/api/src/app/modules/transactions/router.py) |
| Status polling hook | [`apps/web/src/features/statements/useStatements.ts`](../../apps/web/src/features/statements/useStatements.ts) → `useStatementStatus()` |
| Statement detail page | [`apps/web/src/routes/secure/statements.$statementId.tsx`](../../apps/web/src/routes/secure/statements.$statementId.tsx) |
| Review table + confirm button | [`apps/web/src/features/statements/StatementReview.tsx`](../../apps/web/src/features/statements/StatementReview.tsx) |
| Editable transaction row | [`apps/web/src/features/transactions/TransactionRow.tsx`](../../apps/web/src/features/transactions/TransactionRow.tsx) |
| Category picker | [`apps/web/src/features/transactions/CategoryPicker.tsx`](../../apps/web/src/features/transactions/CategoryPicker.tsx) |
| DB migration | [`apps/api/alembic/versions/76d03a4c761b_add_categories_rules_transactions.py`](../../apps/api/alembic/versions/76d03a4c761b_add_categories_rules_transactions.py) |
