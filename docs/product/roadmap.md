# Moneywise — Product Roadmap

> Last updated: 2026-05-28

## North star

A household has a single, trustworthy place to answer:
**"After we pay our credit-card bills this cycle, how much money do we actually have left, and is anything weird happening with our spending?"**

Everything we build should make answering that question faster, more accurate, or more actionable.

---

## Release phases

| Phase | Theme | Duration target | Status |
|---|---|---|---|
| **MVP** | Manual ingestion + AI parsing + cashflow truth | ~10–12 weeks | In progress (auth shipped) |
| **V1** | Trust, automation, and proactive insight | ~8–10 weeks | Planned |
| **V2** | Recommendations and optimization | ~10–12 weeks | Planned |
| **V3+** | Wealth-building / household OS | TBD | Idea backlog |

Durations are coarse planning estimates, not commitments.

---

## MVP — "Upload, see truth, know what's left"

**Goal:** A single user (or one head-of-household) can upload PDF credit-card statements, see all transactions automatically extracted and categorized, manually log deposits, and see a reliable "money left this cycle" number on a dashboard.

**MVP scope:**

| # | Epic | One-line value |
|---|---|---|
| 01 | [Household & Member Management](epics/01-household-and-members.md) | Two adults in a family can share the same data set. |
| 02 | [Credit Cards & Billing Cycles](epics/02-credit-cards-and-billing-cycles.md) | Configure each card's statement-close and payment-due dates. |
| 03 | [Statement Upload & Ingestion](epics/03-statement-upload-and-ingestion.md) | Upload a PDF/CSV statement and track its processing lifecycle. |
| 04 | [AI Parsing & Categorization](epics/04-ai-parsing-and-categorization.md) | Extract transactions from statements and assign categories using LLMs. |
| 05 | [Categories](epics/05-categories.md) | A useful default taxonomy plus user-defined categories and rules. |
| 06 | [Transactions: Browse, Search, Edit](epics/06-transactions.md) | Filter, search, correct, split, and manually add transactions. |
| 07 | [Manual Income](epics/07-manual-income.md) | Log deposits and recurring income without bank integration. |
| 08 | [Cashflow & "Money Left"](epics/08-cashflow-and-money-left.md) | Compute remaining cash per cycle accounting for bills due. |
| 09 | [Dashboard & Overview](epics/09-dashboard.md) | One screen that ties the system together for daily use. |

**MVP success criteria (PM-level):**

- A user can upload a statement and within ~2 minutes see transactions in the system.
- ≥ 90 % of transactions are extracted correctly (amount, date, merchant) on supported issuers.
- ≥ 80 % of transactions are auto-categorized into a sensible category on first pass.
- The "money left" number on the dashboard agrees with a hand calculation on a test household.
- A second household member can log in and see the same data.

**Explicit MVP non-goals:**

- No bank or card-issuer API integrations (no Plaid, no Amex sync, no Open Banking).
- No mobile-native app (web-responsive only).
- No AI-driven recommendations or savings plans.
- No subscription detection or anomaly alerts.
- No multi-currency support (USD only; flag others for V2).
- No tax-report exports.

---

## V1 — "Trust, automation, proactive insight"

Goal: reduce the manual work and start surfacing useful patterns.

| # | Epic | Why now |
|---|---|---|
| F01 | [Bank & Card Provider Sync](epics/future/F01-bank-and-card-sync.md) | Removes the largest friction point (manual statement upload). |
| F04 | [Reminders & Notifications](epics/future/F04-reminders-and-notifications.md) | Bill-due reminders are the natural follow-on to cycle tracking. |
| F05 | [Subscription Tracking](epics/future/F05-subscription-tracking.md) | Sets up V2 anomaly detection and is high-value on its own. |
| F06 | [Anomaly Detection](epics/future/F06-anomaly-detection.md) | "Why did Dropbox just charge me 2× normal?" — concrete trust moment. |

V1 should also include:

- **Recurring-transaction detection** (rules engine fallback, no AI required).
- **Receipt-photo upload** (mobile capture + OCR) as a complement to statements.
- **Audit log / undo** for AI corrections.

---

## V2 — "Recommendations and optimization"

Goal: move from descriptive ("here is what you spent") to prescriptive ("here is what to do").

| # | Epic | Why |
|---|---|---|
| F02 | [AI Budget Recommendations](epics/future/F02-ai-budget-recommendations.md) | Cut-back suggestions, projected savings, plan for next month. |
| F03 | [AI Money-Allocation Recommendations](epics/future/F03-ai-money-allocation.md) | "What should we do with the $850 left over?" |

Plus:

- **Goals & savings targets** — link allocations to user-defined goals.
- **Debt-payoff planner** — avalanche/snowball strategies on cards.
- **Net-worth tracker** — assets + liabilities snapshot over time.

---

## V3+ — "Household OS" (idea backlog)

Beyond V2 we have several candidate directions; sequencing depends on what V1/V2 teaches us.

- Investment / brokerage account tracking.
- Tax-prep export (CSV per category, mapped to Schedule A/C lines).
- Multi-currency and travel mode.
- Shared-expense splitting (roommates, divorced co-parents).
- Per-member spending controls (kid debit cards, allowances).
- Mobile PWA / native app shell.
- Open-banking / PSD2 support for non-US users.
- "Financial wellness score" gamification.

---

## Additional ideas worth capturing now

Features the original brief did **not** call out, but that we think will be valuable. These are candidates — not commitments.

### Trust & accuracy

- **Statement-format auto-detection** per issuer. Maintain a library of issuer-specific layouts to improve parsing reliability and cost.
- **Confidence scores** on every AI-extracted field, with a "review queue" for low-confidence rows.
- **Reconciliation against issuer-reported totals** — the parsed sum should equal the statement's stated total; flag if it doesn't.
- **Duplicate-transaction detection** across overlapping statement re-uploads (e.g., user uploads two months that share a transaction near the close date).

### Privacy & sharing

- **Per-member privacy controls** — option to hide certain accounts or transactions from a spouse (relevant for surprise gifts, individual discretionary spending).
- **Read-only viewer role** — accountant / financial advisor access.
- **Data export & deletion** — full export (CSV/JSON) and GDPR-style account deletion.

### Power-user features

- **Transaction tagging** (free-form, in addition to categories) — supports projects, trips, tax events.
- **Split transactions** — one charge across multiple categories (e.g., Costco run = groceries + household).
- **Notes per transaction** — context for future self.
- **Saved searches and custom views** — "all Amazon spending > $50 this year".
- **Bulk edit** — recategorize many transactions matching a filter at once.

### Onboarding & retention

- **First-statement onboarding wizard** — collect first card, upload first statement, see first dashboard within 5 minutes.
- **Sample data mode** — explore the product with fake data before committing real statements.
- **Monthly digest email** — recap, top categories, anomalies.

### Operational

- **Background job dashboard** — visibility into statement-processing status across the household, with retry.
- **Cost telemetry on AI calls** — per-statement cost tracking so we can detect runaway spend.
- **Feature flags** — needed once we have paying users; bake into V1 if not earlier.

---

## Out of scope, permanently (for now)

To keep focus, the following are explicitly off the table unless a strong reason emerges:

- **Lending, investing, or financial advice products** — regulatory burden is enormous; we are an organizational tool, not an RIA.
- **Acting as a payment rail** — we do not move money or pay bills on the user's behalf.
- **Crypto custody** — read-only tracking is a maybe; custody is a no.

---

## How phase boundaries get decided

- An epic ships when its acceptance criteria are met, not when its tickets close.
- A phase ships when **all** of its epics ship and the cross-phase success criteria hold for a real test household for at least two billing cycles.
- We will reorder ruthlessly based on what users tell us — this roadmap is the current best guess, not a contract.
