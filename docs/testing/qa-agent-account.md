# QA Agent Account

> **AI agents: you MUST use this account for every authenticated QA/test flow in this repo. Do not sign up a new user, do not use any other email, do not skip this file.** The only exceptions are listed under [Exceptions](#exceptions) below.

Dedicated account for **AI agents only** (the `qa-playwright` sub-agent, Claude Code sessions, and generated Playwright specs). Humans should log in with their own accounts; never put real financial data in this household.

## Credentials (local dev only)

| Field | Value |
|---|---|
| Email | `qa-agent@moneywise.dev` |
| Password | `QaAgent!Sandbox2026` |
| Household | `QA Agent Household` |
| Plaid mode | **Sandbox, always** (`households.is_plaid_sandbox = TRUE`, re-asserted on every migration run) — bank login `user_good` / `pass_good` |

Never create this account in a production environment — the credentials are intentionally checked into the repo and only make sense in local/dev/sandbox contexts.

> Note: the backend rejects reserved TLDs (`.test`, `.example`, …) via Pydantic `EmailStr`, which is why the domain is `moneywise.dev`. Older docs/specs referencing `qa@moneywise.test` point to an account that cannot be registered.

## It is seeded automatically — no manual setup

Alembic migration [`e4a18b2f9af0_seed_qa_agent_account.py`](../../apps/api/alembic/versions/e4a18b2f9af0_seed_qa_agent_account.py) creates this user + household on every `alembic upgrade head` (i.e. `make migrate`, and any fresh environment bootstrap). It is idempotent and self-healing:

- If the account doesn't exist yet, it's created.
- If it already exists, the migration **re-asserts the known password** and **forces `is_plaid_sandbox = TRUE`** every time it runs — so the account can never silently drift into a locked-out or non-sandbox state.

This means: **any environment where migrations have been run has this account ready to use.** Agents should never need to bootstrap it manually. If login fails with these credentials, that's a bug (or migrations haven't been run) — not a signal to create a different account.

## Rules for agents

1. **Always use this account** for authenticated flows — dashboard, transactions, wallet, cards, categories, household, everything. Do not sign up a fresh user per test.
2. **Exceptions:**
   - The auth suite itself (signup / duplicate-email / logout tests) uses timestamped emails — that's what it's testing.
   - Multi-user scenarios (e.g. household invitations) may create a second timestamped account scoped to that one test, in addition to logging in as the QA agent for the primary actor.
3. **All data in this household is disposable.** Any agent may reset it at any time; never rely on state left by a previous session unless the current test just created it.
4. **Never disable sandbox mode** on this household. If you need to test production-Plaid-specific behavior, use a separate throwaway household — never flip `is_plaid_sandbox` off on the QA agent account.

## Maintenance

```bash
# Ensure the account exists / is healthy (idempotent — safe to run anytime)
make migrate

# Reset the password manually if needed (migration will also re-assert it next run)
make set-password EMAIL=qa-agent@moneywise.dev

# Wipe all household data (transactions, Plaid items, bank accounts, cards) —
# does NOT delete the account/household itself
make reset-data EMAIL=qa-agent@moneywise.dev YES=1
```

To remove the account entirely (e.g. to test the seed migration itself): `uv run alembic downgrade -1` from `apps/api` will drop it (cascades to all household-scoped data), and the next `alembic upgrade head` recreates it fresh.

## Known inconsistencies in existing specs (cleanup candidates)

- `playwright-tests/transactions/transactions-page.spec.ts` uses `qa@moneywise.test` — unregistrable (reserved TLD).
- `playwright-tests/bank-accounts/bank-accounts.spec.ts` uses `qa_moneywise@gmail.com`.
- `playwright-tests/wallet/wallet.spec.ts` signs up a timestamped `@example.com` user per run.

These predate this account and should be migrated to the credentials above (via shared constants or Playwright `storageState`) next time they're touched.
