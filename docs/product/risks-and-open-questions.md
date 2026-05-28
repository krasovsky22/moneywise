# Cross-Cutting Risks & Open Questions

Issues that span multiple epics, plus decisions that need explicit owners. Each item lists the **risk**, **impact**, **current best guess**, and **what would resolve it**.

When a risk is resolved, move the decision into the relevant epic and remove it from this file.

---

## 1. Statement-format variability

**Risk.** Credit-card statement PDFs vary enormously across issuers (Amex, Chase, Citi, Capital One, Discover, store cards, credit-union cards). Some are text-based, some are image-based scans, some are encrypted, multi-column, multi-page, with transactions split across pages and totals that don't line up with the visible rows (returns, fees, FX adjustments).

**Impact.** If parsing accuracy is below ~95 % on common issuers, users will not trust the system and the AI cost may also balloon (retries, manual fix-ups). This is the single biggest threat to MVP success.

**Current best guess.**
- Start with **2–3 reference issuers** (e.g., Amex, Chase, Capital One) and measure accuracy honestly.
- Use a layered approach: PDF text extraction first, fall back to LLM-vision for image-based statements.
- Maintain an issuer "fingerprint" library so we route to the best parser for each.
- Always run a **total reconciliation check** (sum of extracted transactions vs. statement's stated total).

**Resolved by.** Building a test corpus of ~30 statements across 5+ issuers with known correct outputs, and measuring real accuracy before declaring MVP done.

---

## 2. AI cost per statement

**Risk.** A naive "send the whole PDF to a frontier model" approach can cost meaningful dollars per statement, especially with vision. With a free MVP, runaway cost is an existential risk.

**Impact.** Either we bleed money on free users, or we throttle aggressively and degrade UX.

**Current best guess.**
- Cap LLM tokens per statement; refuse to process statements over a size limit until paid.
- Use the cheapest viable model (Haiku-class) for text-extracted statements; reserve larger models for vision and error correction.
- Cache parsed transactions by file hash — re-uploads must never re-bill.
- Track per-statement cost in telemetry from day one.

**Resolved by.** A cost model spreadsheet that projects: at 100 users × 4 statements/month × ${cost}, what does this cost? If the answer is "too much," redesign before launch.

---

## 3. AI accuracy and user trust

**Risk.** Even at 95 % extraction accuracy, users will notice the 5 % wrong rows — especially if those rows affect "money left." Trust is binary, not gradient.

**Impact.** A single wrong transaction at the top of the dashboard can sink confidence in the entire product.

**Current best guess.**
- Every AI-derived field has a **confidence score**.
- Low-confidence rows go into a **review queue**, not the main ledger, until the user confirms.
- The dashboard always shows the number of "unreviewed" items so users know what is and isn't trusted.
- Manual corrections feed back into rules ("always categorize Starbucks as Coffee").

**Resolved by.** A clear UX pattern for "this is AI's guess vs. this is confirmed" and a feedback loop that demonstrably improves over time.

---

## 4. Duplicate detection

**Risk.** A user uploads two overlapping statements (e.g., they re-upload because they thought the first failed; or two statements share boundary days because of timezones / posting dates). Without dedup, transactions appear twice and "money left" is wrong.

**Impact.** Direct correctness bug visible in the most-watched number.

**Current best guess.**
- Dedup on `(card_id, transaction_date, amount, merchant_signature)` with a small fuzzy window on merchant string.
- Always show duplicate-candidate review to the user before merging — never silently delete.
- On re-upload of the same file (by hash), skip processing entirely.

**Resolved by.** Decided dedup algorithm + UI surface in the [Statement Ingestion epic](epics/03-statement-upload-and-ingestion.md).

---

## 5. PII / financial data security

**Risk.** We are storing the most sensitive non-medical personal data a US household has: credit-card transactions, statements, balances, and (likely soon) bank balances.

**Impact.** A breach is catastrophic — reputationally, legally, and emotionally for users.

**Current best guess.**
- Statements stored at rest are **encrypted server-side** with per-tenant keys.
- No card numbers stored ever — when statements contain PANs they are redacted on ingest.
- LLM provider must have a **zero-retention / no-training** agreement (or run locally).
- Logs must never include statement contents or full transaction descriptions.
- Authentication: see existing auth spec; add **2FA in V1 at the latest.**

**Resolved by.** A short security policy document covering data classification, encryption, log scrubbing, and incident response — before MVP launch to any external user.

---

## 6. "Money left" semantics

**Risk.** What does "money left after paying credit-card bills" actually mean? Several legitimate definitions exist:
  - Cash on hand right now, minus the sum of all statement balances currently due.
  - Projected cash at end of current cycle, accounting for income that hasn't arrived yet.
  - Cash available to spend *discretionarily* (subtracting recurring fixed bills).

**Impact.** The flagship number on the dashboard means different things to different users, and is the easiest place to lose trust.

**Current best guess.**
- MVP defines this precisely in the [Cashflow epic](epics/08-cashflow-and-money-left.md), with the formula visible on hover.
- Pick **one default definition**, show it prominently, allow the user to switch view modes.

**Resolved by.** A single, written, agreed-upon formula in the cashflow epic, signed off before the dashboard is built.

---

## 7. Family / household boundaries

**Risk.** A household has fuzzy edges: married couples, partners, adult kids, divorced co-parents, accountants. The data model and permissions have to handle this without overbuilding.

**Impact.** Get this wrong early and we either build a single-user product that can't scale, or a multi-tenant beast we don't need.

**Current best guess.**
- MVP: one **Household** has many **Members**. All members see all data in MVP — no per-card privacy.
- V1: add per-card visibility flags so a spouse can keep one card private if desired.
- V2: add roles (owner, member, viewer).

**Resolved by.** Sign-off on the [Household epic](epics/01-household-and-members.md) data model.

---

## 8. Income modeling without bank sync

**Risk.** Without bank integration, "income" is whatever the user types in. People will forget to log deposits, double-log them, or be inconsistent about gross vs. net.

**Impact.** "Money left" is unreliable for the very users who would benefit most.

**Current best guess.**
- Support both **one-off deposits** and **recurring income templates** (e.g., "biweekly $2,800 on the 1st and 15th").
- Use templates to auto-populate expected income for the cycle, with clear "expected vs. received" indicators.
- In V1 we add receipt-photo + paystub OCR; in V2 bank sync resolves this entirely.

**Resolved by.** UX pattern in [Manual Income epic](epics/07-manual-income.md) for "expected" vs. "confirmed" income.

---

## 9. Categorization taxonomy

**Risk.** No category list satisfies everyone. Too few = useless; too many = decision fatigue and low auto-categorization accuracy.

**Impact.** Affects every downstream feature: budgets, recommendations, anomaly detection.

**Current best guess.**
- Ship with ~12 top-level categories (food, groceries, transport, housing, utilities, entertainment, shopping, personal care, health, travel, fees, other).
- Allow user-defined sub-categories from day one.
- Track top-level categories for system-wide analytics; sub-categories are per-household.

**Resolved by.** A frozen MVP taxonomy in the [Categories epic](epics/05-categories.md).

---

## 10. Regulatory posture

**Risk.** Once we touch real money and store financial data, we attract regulatory scrutiny — even as a passive tracker. State data-privacy laws (CCPA, CPA, NYDFS for NY users), and eventually GDPR if we go international.

**Impact.** Legal cost, forced product changes, possible enforcement actions.

**Current best guess.**
- MVP: stay US-only, free, no payments. This minimizes regulatory exposure.
- V1: introduce a real privacy policy and ToS; designate a data-deletion process.
- Before charging: consult counsel on state-by-state requirements.

**Resolved by.** A "go/no-go on monetization" decision point before V1 ships, with legal review.

---

## 11. Mobile experience

**Risk.** The natural moment to capture a receipt or check "money left" is on a phone. A web-only product loses these moments.

**Impact.** Lower engagement, lower retention.

**Current best guess.**
- MVP web app is responsive but desktop-first.
- V1 adds PWA + receipt-photo capture.
- Native app is deferred until we have demand signal.

**Resolved by.** Engagement data after MVP — if mobile sessions are < 30 % of usage we have a problem.

---

## 12. Offline / failure modes

**Risk.** Statement processing is asynchronous and AI-backed — many things can fail. If the user can't see clear status, they re-upload, double-process, lose trust.

**Impact.** Direct UX failure on the most important workflow.

**Current best guess.**
- Every statement has a visible **status**: queued, parsing, categorizing, needs-review, ready, failed.
- Failed statements explain why and offer retry.
- Re-uploads of the same file hash are no-ops with a clear message.

**Resolved by.** UX in the [Statement Ingestion epic](epics/03-statement-upload-and-ingestion.md).
