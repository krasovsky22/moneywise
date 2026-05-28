# Epic F04 — Reminders & Notifications (V1)

## Goal

Stop relying on the user remembering to check the dashboard. Proactively notify the household about bill due dates, missed income, statements needing review, and (in V2) anomalies and overspending.

## Personas

- **Forgetful user** — needs the nudge before the bill is due, not after.
- **Couple coordinating** — both members want to know "is this already handled?"

## In scope (V1)

- **Channels**: email (always), in-app banner/inbox, optionally push (if mobile/PWA ready by then).
- **Reminder types**:
  - Bill due in N days (configurable per card; default 3 days).
  - Statement uploaded and ready for review.
  - Statement processing failed.
  - Expected income not received past its date.
  - Weekly summary digest (optional).
- **Notification preferences** per user (not per household — both members tune their own channels).
- **In-app inbox**: a notification center listing recent items with read/unread state.
- **Quiet hours** — no notifications outside a window the user sets.

## Out of scope (V1 — defer)

- SMS (cost + carrier compliance) — V2.
- Anomaly alerts (separate epic F06).
- "Both spouses see who acknowledged what" — V2.
- Slack / Discord / iCal integrations — V3+.

## User stories

- As a member I want an email 3 days before each card is due so I never get a late fee.
- As a member I want push notifications on my phone when my spouse marks a bill paid, so we don't both try to do it.
- As a member I want to silence notifications between 10pm and 7am.
- As a member I want to see all recent notifications in one place inside the app.

## Key flows

### Configure preferences
- Settings → Notifications.
- Per type: toggle email, push, in-app. Set quiet hours.

### Daily scheduler
- A scheduled job runs daily (per household time zone), evaluates each reminder type, queues deliveries.
- Each delivery has a deduplication key — same reminder for the same event isn't sent twice.

### In-app inbox
- Bell icon in header with unread badge.
- Click → notification list, sortable, with "mark all read."

## Data model implications

- `NotificationPreference` — id, user_id, channel (email, push, in_app), type (enum of reminder kinds), enabled (bool), quiet_hours_start, quiet_hours_end, time_zone.
- `Notification` — id, user_id, household_id, type, payload (jsonb), created_at, read_at (nullable), delivered_at_email (nullable), delivered_at_push (nullable).
- Outbound delivery handled via a transactional email provider; push via a service worker / FCM in V1.

## API surface (high-level)

- Get/update preferences.
- List notifications.
- Mark read / unread.
- Manually trigger digest (admin / for testing).

## Acceptance criteria

- A bill due in 3 days produces exactly one email per opted-in user, no duplicates.
- Quiet hours suppress push and email; in-app remains.
- Preference changes take effect on the next scheduled run, not retroactively.
- The in-app inbox shows all notifications, even ones the user has dismissed via email.

## Risks & open questions

- **Deliverability** — picking a transactional email provider with good reputation matters. Track bounce/complaint rates.
- **Notification fatigue** — sending too many erodes trust. Default settings should be conservative; let users opt in to more.
- **Time-zone correctness** — bill-due-in-3-days is calendar math, time zones matter. Store the user's tz; do scheduling at the user's local midnight.
- **Spam compliance** — every email needs unsubscribe + a clear sender identity.

## Dependencies

- Blocked by: MVP shipping (needs cards, statements, income data).
- Useful prerequisite for: F05 subscription tracking, F06 anomaly detection (both deliver via this channel).
