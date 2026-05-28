# Epic F03 — AI Money-Allocation Recommendations (V2)

## Goal

Once we know there is **leftover money** at the end of a cycle, help the household decide what to do with it. The system suggests an allocation mix grounded in the household's stated goals (build emergency fund, pay down a specific card faster, save for a vacation, contribute to retirement, etc.).

This is the *constructive* counterpart to F02's *reductive* recommendations.

## Personas

- **Household with surplus** — has been disciplined, wants to make the surplus matter.
- **Household paying down debt** — wants smart suggestions on which card to attack.

## In scope (V2)

- **Goals**: user defines financial goals (emergency fund target, debt payoff target on specific cards, savings target with date, vacation fund, etc.) with priorities.
- **Allocation suggestion**: at cycle close (or on-demand), AI proposes a percentage breakdown of the leftover surplus across goals, plus the dollar amounts.
- **Rationale**: each allocation comes with a short explanation ("Card X has the highest APR; paying $200 here saves $Y in interest over the next year").
- **One-tap "log allocation"**: records that the user did the action (transferred to savings, made an extra card payment). We don't move money — but we mark the allocation as fulfilled so progress on the goal updates.
- **Goal progress dashboard widget**.

## Out of scope (V2 — defer)

- Auto-transfers / actually moving money (out forever, see roadmap "permanently out of scope").
- Tax-advantaged account modeling (401k, IRA) beyond a generic "Retirement" bucket — V3.
- Cross-household comparison or social goals — V3+.

## User stories

- As a member I want to declare "we want $10k in emergency savings by year-end" and have the system tell me how this cycle's surplus moves us toward that.
- As a member I want the system to recommend "pay an extra $200 toward Chase Sapphire this cycle" with the reasoning written out.
- As a member I want to mark an allocation as done so the goal progress updates.

## Key flows

### Define a goal
- Goals page → **"New goal"**.
- Type (emergency fund, debt payoff [pick a card], savings with target date, custom bucket), target amount, priority.

### Get an allocation suggestion
- At cycle close, dashboard banner: "You have $X left this cycle. Here's a suggested allocation."
- Cards listing each goal with proposed amount + rationale.
- User can edit numbers before logging.

### Log allocation
- Click **"Log $X to Card payoff"** → records an `AllocationAction`.
- Goal's `progress_amount` increases by $X.

## Data model implications

- `Goal` — id, household_id, kind (enum), title, target_amount, target_date (nullable), priority (int), linked_card_id (nullable, for debt-payoff goals), is_active, created_at.
- `AllocationSuggestion` — id, household_id, cycle_id, goal_id, suggested_amount, rationale, model_used, created_at, status (proposed, accepted, dismissed).
- `AllocationAction` — id, household_id, cycle_id, goal_id, amount_logged, occurred_on, recorded_by_user_id, suggestion_id (nullable), notes.

## API surface (high-level)

- CRUD goals.
- Generate allocation suggestions for a cycle.
- Log allocation action.
- Get goal progress over time.

## Acceptance criteria

- A user with three goals receives a coherent suggestion that sums to ≤ their leftover surplus.
- Goal progress charts update immediately when an allocation is logged.
- Debt-payoff rationale references actual APR if known (user enters it on the card); otherwise references "high-interest card" generically.

## Risks & open questions

- **Truthfulness of math** — interest projections must be correct or trust collapses. Use deterministic math for the numbers; LLM only for prose.
- **Pretending to be a financial advisor** — keep copy and tone careful. Add a disclaimer.
- **APR data** — needed for debt-payoff rationale. User-entered, optional.
- **Allocation vs. reality** — we log intentions; reality may diverge. Periodic prompts: "Did you actually transfer this?"

## Dependencies

- Blocked by: F02 (the plan-for-next-month surface is a natural home).
- Improved by: F01 (account balances confirm money actually moved).
