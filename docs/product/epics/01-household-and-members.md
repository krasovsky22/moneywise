# Epic 01 — Household & Member Management

## Goal

A Moneywise account models a **household**, not a single user. Two or more adult family members can authenticate independently, but they see a shared set of cards, transactions, income records, and the household-level "money left" number.

Authentication primitives (email/password, JWT) already exist in `docs/auth-spec.md`. This epic introduces the **household** as the unit of data ownership and lets a user invite a second member.

## Personas

- **Primary user (account creator)** — sets up the household, adds the first card, uploads the first statement.
- **Secondary member** — typically a spouse or partner; accepts an invite and shares the same data.

## In scope (MVP)

- Auto-create a `Household` for every new sign-up.
- The signing-up user is the sole member at first.
- Invite a second member by email.
- A member can log in and see all household data.
- A member can leave (or be removed) — their account remains, but they no longer see household data.
- Display household name in the header.

## Out of scope (MVP — defer)

- Roles / permissions (everyone is "owner" in MVP).
- More than two active members (technically allowed but not optimized for).
- Per-card privacy (e.g., "hide this card from my spouse"). → V1.
- Accountant / advisor read-only access. → V2.
- Splitting a household, moving data between households, account merging.

## User stories

- As a new user I want my account to "just work" without thinking about the household concept — it should be created for me invisibly.
- As the account creator I want to invite my spouse so we both track the same finances.
- As an invited member I want to accept the invite by clicking a link in my email and then sign up (or log in) and immediately see the shared data.
- As a household member I want to leave the household without losing my login (in case I rejoin later, or want my own household).
- As a household member I want to see who else is in the household.

## Key flows

### Sign-up
1. User signs up with email + password (existing flow).
2. Server creates a `Household` with a default name like *"<First name>'s household"*, owned by the new user.
3. User lands on dashboard; "household" is invisible UX-wise — just feels like their own account.

### Invite a member
1. From Settings → Household, primary clicks **"Invite member"**.
2. Enters email → server creates an `Invitation` row with a token, expiry (7 days), and the inviter's household_id.
3. Email sent with accept link `/secure/join-household?token=…`.
4. Recipient clicks link:
   - If logged out → directed to sign-up or login with the invite token preserved.
   - On successful auth, the user is added to the inviter's household; their old (empty) household, if any, is deleted.
5. Inviter sees the member listed in Settings → Household.

### Leave household
1. Member opens Settings → Household → **"Leave household"**.
2. Confirmation modal explains the consequence (they lose access to shared cards, transactions, etc.).
3. On confirm: user is removed from the household; a new empty household is auto-created for them.

### Edge: last member leaves
- A household with zero members is soft-deleted after a grace period (data retained 30 days for recovery, then purged).

## Data model implications

New entities:

- `Household` — id, name, created_at.
- `HouseholdMember` — household_id, user_id, joined_at. Composite unique on (household_id, user_id).
- `Invitation` — id, household_id, invited_by_user_id, email, token (hashed), expires_at, status (pending / accepted / revoked / expired).

Existing entities (cards, transactions, statements, income) all get a `household_id` foreign key and are scoped by it in every query.

## API surface (high-level)

- Create / update / view household (limited fields — name only in MVP).
- List members.
- Create invitation, list pending invitations, revoke invitation.
- Accept invitation (by token).
- Leave household.
- Every authenticated request implicitly scopes by the caller's current household_id.

## Acceptance criteria

- Two users with different emails, after one invites the other, both see exactly the same dashboard.
- A user removed from a household loses access on next request (no stale data leak via cached pages).
- Invitations expire after 7 days and cannot be accepted thereafter.
- The household concept is invisible to single users who never invite anyone — they should never see the word "household" unless they look for it.

## Risks & open questions

- **What identifies a household member to humans?** Email seems obvious but is sensitive. Show display name + initials avatar by default; email visible on hover.
- **Account-merging case:** if both spouses already had separate accounts with their own data, accepting an invite means losing one side's data. UX must warn explicitly.
- **Should we let users create multiple households?** MVP: no. A user belongs to exactly one household at a time. We can revisit if real demand appears (e.g., divorced co-parents).
- See cross-cutting risk: *Family / household boundaries* in `risks-and-open-questions.md`.

## Dependencies

- Builds on the existing auth module.
- Blocks: every other MVP epic — all data is household-scoped.
