# Authentication Specification

## Overview

Email/password authentication with JWT tokens. No email verification. All authenticated frontend routes live under `/secure/*`.

---

## Route Map

### Public Routes

| Route | Page | Status | Notes |
|---|---|---|---|
| `/` | Landing page | ✅ | Hero section + Login / Sign Up CTAs in header |
| `/login` | Login | ✅ | Redirects to `/secure/dashboard` if already authenticated |
| `/signup` | Sign Up | ✅ | Redirects to `/secure/dashboard` if already authenticated |

### Secure Routes (`/secure/*`)

All routes under this prefix require a valid session. Unauthenticated access redirects to `/login?redirect=<original-path>`. After successful login the user is sent back to the originally requested path.

| Route | Page | Status | Notes |
|---|---|---|---|
| `/secure/dashboard` | Dashboard | ✅ | First page after login; placeholder for now |
| `/secure/settings` | User Settings | ✅ | Profile display + change password |

---

## Pages

### Landing Page (`/`) ✅

- Placeholder hero section with app name and tagline
- Header includes **Login** and **Sign Up** buttons
- No authentication state required

### Login (`/login`) ✅

Fields:
- Email (required)
- Password (required)

Behavior:
- Submit → `POST /api/v1/auth/login`
- On success: store access token in memory, redirect to `/secure/dashboard` (or `redirect` query param if present)
- On failure: inline error below the form ("Invalid email or password")
- Link to `/signup` for new users

### Sign Up (`/signup`) ✅

Fields:
- Email (required)
- Password (required, min 8 characters)
- Confirm Password (required, must match)

Behavior:
- Submit → `POST /api/v1/auth/register`
- On success: store access token in memory, redirect to `/secure/dashboard`
- On failure: inline field-level errors
- Link to `/login` for existing users

### Dashboard (`/secure/dashboard`) ✅

- Placeholder page for now
- Shows "Welcome, {email}" as a heading
- Will host the main app features in future milestones

### User Settings (`/secure/settings`) ✅

Two sections:

**Profile**
- Read-only display of logged-in user's email
- No editing for now

**Security**
- Change password form
- Fields: Current Password, New Password (min 8 chars), Confirm New Password
- Submit → `POST /api/v1/auth/change-password`
- On success: inline confirmation message; session remains active
- On failure: inline error (e.g., "Current password is incorrect")

---

## Header ✅

Conditionally renders based on auth state.

**Logged out** (public routes):
- Logo (links to `/`)
- "Login" button → `/login`
- "Sign Up" button (primary CTA) → `/signup`

**Logged in** (secure routes):
- Logo (links to `/secure/dashboard`)
- User email chip / avatar
- "Logout" button → triggers logout flow, redirects to `/`

---

## Auth State & Token Strategy

### Access Token ✅
- Stored in memory (Zustand auth store) — never in `localStorage`
- Short-lived (15 minutes)
- Attached to API requests as `Authorization: Bearer <token>`

### Refresh Token ✅
- Stored in an `httpOnly` cookie — not accessible by JavaScript
- Long-lived (7 days)
- Auto-sent by the browser on requests to `/api/v1/auth/refresh`
- Rotated on every use (old token invalidated, new token issued)
- Server stores SHA-256 hash of token (raw token never persisted)

### Session Restore on Page Reload ✅
1. App boots → calls `POST /api/v1/auth/refresh` (cookie sent automatically)
2. If success: populate Zustand store with new access token → render app
3. If failure (expired/missing cookie): redirect to `/login`

### Route Guard (TanStack Router `beforeLoad`) ✅
- Applied to the `/secure` route subtree
- Checks Zustand store for a valid access token
- If missing: redirect to `/login?redirect=<current-path>`

### Silent Refresh on 401 ✅
- `api-client.ts` intercepts 401 responses
- Attempts `POST /api/v1/auth/refresh`; if success, retries the original request
- Race condition guard prevents concurrent refresh calls
- If refresh fails: clears auth store, redirects to `/login`

---

## Backend API Endpoints

| Method | Path | Auth | Status | Description |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | No | ✅ | Create account; returns access token + sets refresh cookie |
| POST | `/api/v1/auth/login` | No | ✅ | Verify credentials; returns access token + sets refresh cookie |
| POST | `/api/v1/auth/logout` | Yes | ✅ | Invalidates refresh token server-side; clears cookie |
| POST | `/api/v1/auth/refresh` | Cookie | ✅ | Issues new access token + rotates refresh token |
| GET | `/api/v1/users/me` | Yes | ✅ | Returns current user (`id`, `email`, `created_at`) |
| POST | `/api/v1/auth/change-password` | Yes | ✅ | Requires `current_password` + `new_password` |

### Request / Response Shapes

**POST `/api/v1/auth/register`**
```json
// Request
{ "email": "user@example.com", "password": "hunter12" }

// Response 200
{ "access_token": "<jwt>", "token_type": "bearer" }
// + Set-Cookie: refresh_token=<jwt>; HttpOnly; SameSite=Strict
```

**POST `/api/v1/auth/login`**
```json
// Request
{ "email": "user@example.com", "password": "hunter12" }

// Response 200 — same shape as register
```

**POST `/api/v1/auth/logout`**
```json
// Request — no body (refresh token read from cookie)
// Response 204 No Content
// + Set-Cookie: refresh_token=; Max-Age=0  (clears cookie)
```

**POST `/api/v1/auth/refresh`**
```json
// Request — no body (refresh token read from cookie)
// Response 200
{ "access_token": "<jwt>", "token_type": "bearer" }
// + Set-Cookie: refresh_token=<new-jwt>; HttpOnly; SameSite=Strict
```

**GET `/api/v1/users/me`**
```json
// Response 200
{ "id": "uuid", "email": "user@example.com", "created_at": "2026-01-01T00:00:00Z" }
```

**POST `/api/v1/auth/change-password`**
```json
// Request
{ "current_password": "hunter12", "new_password": "better_password" }

// Response 204 No Content
// Error 400 — { "detail": "Current password is incorrect" }
```

---

## Database Schema ✅

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `email` | VARCHAR(255) | unique, indexed |
| `hashed_password` | VARCHAR(255) | bcrypt |
| `is_active` | BOOLEAN | default true |
| `created_at` | TIMESTAMPTZ | server default |
| `updated_at` | TIMESTAMPTZ | server default, updated on change |

### `refresh_tokens`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `user_id` | UUID | FK → `users.id` ON DELETE CASCADE |
| `token_hash` | VARCHAR(64) | SHA-256 hex of raw token, unique |
| `expires_at` | TIMESTAMPTZ | now + 7 days |
| `revoked` | BOOLEAN | default false; set on rotation/logout |
| `created_at` | TIMESTAMPTZ | server default |

---

## Error Handling

| Scenario | Behavior | Status |
|---|---|---|
| Wrong credentials on login | Inline error: "Invalid email or password" | ✅ |
| Email already registered | Inline error on signup: "An account with this email already exists" | ✅ |
| Passwords don't match (signup/change) | Client-side inline error before submit | ✅ |
| Current password wrong (change) | Inline error: "Current password is incorrect" | ✅ |
| Network / server error | Toast notification: "Something went wrong. Please try again." | ✅ |
| Session expired mid-session | Silent refresh attempt; if fails, redirect to `/login` | ✅ |

---

## Implementation Notes

- bcrypt pinned to `<4.0` for passlib compatibility (bcrypt 5.x dropped `__about__`)
- Test suite uses `NullPool` + session-scoped event loop (`asyncio_default_test_loop_scope = "session"`) to avoid asyncpg connection reuse across loop boundaries
- `secure=False` on refresh cookie (dev/WSL); TODO: set `secure=True` behind HTTPS in production

---

## Open Questions

1. Should signup collect a display name, or just email + password for now?
2. Should "remember me" affect the refresh token TTL (e.g., 7 days vs 30 days)?
3. Is social login (Google OAuth) in scope for a future milestone?
