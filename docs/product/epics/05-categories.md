# Epic 05 — Categories

## Goal

Every transaction has a **category** so the household can answer "how much are we spending on X?" — the foundation for the dashboard, the budget, and (later) the AI recommendations.

A useful category system is small enough that users don't get decision fatigue, large enough to capture meaningful distinctions, and flexible enough that users can adjust it for their life.

## Personas

- **Member assigning a category** during review or manually.
- **Member viewing rollups** on the dashboard or in reports.
- **AI** consuming the category list to assign categories during parsing.

## In scope (MVP)

- A frozen **default taxonomy** of ~12 top-level categories with sensible defaults. Initial proposal:
  - Food & Drink (subcategories: Groceries, Restaurants, Coffee, Alcohol)
  - Transportation (Gas, Rideshare, Transit, Parking, Tolls, Auto Maintenance)
  - Housing (Rent/Mortgage, Utilities, Internet, Home Maintenance, HOA)
  - Health (Pharmacy, Doctor, Insurance, Fitness)
  - Shopping (Clothing, Electronics, Home Goods, General)
  - Entertainment (Streaming, Events, Hobbies, Books/Media)
  - Travel (Flights, Hotels, Transport, Other)
  - Personal Care (Salon, Toiletries, Self-care)
  - Kids & Family (Childcare, Education, Activities)
  - Financial (Fees, Interest, Transfers)
  - Gifts & Donations
  - Other (catch-all)
- Top-level categories are **system-defined** and stable. They are the units of system analytics.
- **User-defined sub-categories** under any top-level category (or stand-alone).
- **Category rules** — if `merchant_clean` matches `X` (substring or regex, MVP: substring), assign category `Y`. Created either explicitly in Settings or via the "Always categorize X as Y?" prompt in review.
- **Manual recategorization** — user can change any transaction's category at any time.
- Categories have color + icon for the UI.

## Out of scope (MVP — defer)

- Hierarchical depth > 2 (no sub-sub-categories).
- Budgeting per category (V1).
- AI-assisted "create a new category for me" (V2+).
- Cross-household category sharing (categories are household-scoped; we may seed defaults but each household owns its own).
- Importing categories from other apps (Mint, YNAB).

## User stories

- As a member I want sensible default categories the moment I sign up so I'm not staring at a blank screen.
- As a member I want to create custom sub-categories like "Date Nights" under Food & Drink, because they matter to *my* household.
- As a member I want a rule that says "always categorize Whole Foods as Groceries" without re-clicking every transaction.
- As a member I want to bulk-recategorize a filtered list (e.g., move all "Costco" from Groceries to a new "Bulk Shopping").
- As an AI parser I want the canonical category list so I can pick from it.

## Key flows

### First-run seeding
- On household creation, the default top-level categories are inserted with system flags. They are protected from deletion (only editable name/icon).

### Create a sub-category
1. Settings → Categories.
2. Click a top-level → **"Add sub-category"**.
3. Name, icon, optional color. Save.

### Create a rule
- Via review prompt (Epic 04 flow): one-click acceptance.
- Or via Settings → Rules → **"New rule"**: match string (case-insensitive substring), target category, scope (this household only — MVP).

### Bulk recategorize
- From Transactions list (Epic 06): filter, select all, choose category, confirm.

### Delete a sub-category
- Confirm modal: "X transactions currently use this sub-category. They will move to its parent category." Then delete.

## Data model implications

- `Category` — id, household_id (nullable for system defaults — but for simplicity, MVP duplicates defaults per household so all categories are household-owned), parent_id (nullable; self-referential), name, icon, color, is_system (bool — system defaults can't be deleted), kind (enum: spending, income, transfer), created_at.
- `CategoryRule` — id, household_id, pattern (string), match_type (enum: substring; regex is V1), category_id, created_by_user_id, created_at, hit_count, last_applied_at.
- `Transaction.category_id` (from Epic 04).

## API surface (high-level)

- List categories (tree).
- Create / update / delete sub-categories.
- List / create / delete rules.
- Bulk-recategorize transactions matching a filter.

## Acceptance criteria

- A new household sees the full default taxonomy on first login.
- Creating a rule from review causes ≥ 95 % of matching future transactions to be auto-categorized by the rule rather than the LLM.
- Deleting a sub-category moves orphan transactions back to its parent (never leaves them uncategorized).
- The AI prompt (Epic 04) is fed the up-to-date category list per household.

## Risks & open questions

- See cross-cutting risk #9: *Categorization taxonomy.* Default list is a strong default but not gospel — be ready to iterate based on user data after MVP.
- **System vs. user categories:** simplest is "everything is household-owned but flagged is_system=true." That sidesteps cross-household sync but creates churn if we change defaults later. Decision: ship household-owned, accept the churn.
- **Rule conflict:** what if two rules match? MVP: most-recently-created rule wins. Show the matching rule in the transaction detail UI.
- **Regex injection / safety:** rules in MVP are plain substrings only — no regex until V1.

## Dependencies

- Blocked by: Household (Epic 01).
- Blocks: AI Parsing (Epic 04), Transactions (Epic 06), Dashboard (Epic 09).
