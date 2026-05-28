# Moneywise — Product Documentation

This directory is the **product source of truth** for Moneywise: a family-oriented spending tracker that ingests credit-card statements, uses AI to extract and categorize transactions, and helps a household answer the question *"how much money do we actually have left this month?"*

These documents define **what** we are building and **why**. They do **not** specify implementation details (those live in technical specs alongside the code).

## Audience

- **Product / founders** — to align on scope, sequence, and trade-offs.
- **Engineering** — to translate user value into work without re-deriving intent.
- **AI/ML** — to understand accuracy targets, cost envelopes, and human-in-the-loop boundaries.

## Reading order

1. **[roadmap.md](roadmap.md)** — the phased plan: MVP, V1, V2, and "additional ideas".
2. **[risks-and-open-questions.md](risks-and-open-questions.md)** — cross-cutting issues that affect multiple epics. Read before doing any epic that touches AI, file parsing, or money math.
3. **[epics/](epics/)** — one Markdown file per epic. MVP epics are numbered `01-…` through `09-…`. Post-MVP epics live in `epics/future/` prefixed `F##-…`.

## Document conventions

Each epic file follows the same structure so the docs stay grep-able and comparable:

- **Goal** — the user outcome in one paragraph.
- **Personas** — who is affected.
- **In scope (MVP)** / **Out of scope** — explicit boundary.
- **User stories** — "As a … I want … so that …" bullets.
- **Key flows** — happy-path and important edge-case flows in plain English.
- **Data model implications** — entities and relationships *introduced or changed*.
- **API surface (high-level)** — capability list, not endpoint definitions.
- **Acceptance criteria** — what a PM would check to declare the epic "done".
- **Risks & open questions** — items that need decisions before or during build.
- **Dependencies** — other epics this one needs (or blocks).

## What this directory is *not*

- Not an architectural reference — see `CLAUDE.md` and `apps/*/README.md` for that.

- Not an API spec — the FastAPI OpenAPI document at `/docs` is authoritative.
- Not a backlog tracker — issues / tickets live in the issue tracker, not here. Epics are stable; tickets are not.

## How to evolve these docs

- When scope changes for an epic, edit that epic file and update the roadmap status.
- When a new feature idea appears, add it to the "Additional Ideas" section of the roadmap first. Promote to an epic only when there is intent to build.
- When a risk is resolved, move it from `risks-and-open-questions.md` into the relevant epic with the decision recorded.
