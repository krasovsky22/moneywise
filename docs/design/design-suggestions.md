# Design Review & Suggested Updates

_Reviewed 2026-07-02 against `apps/web` (dashboard, wallet, transactions, layout components, token system)._

## Current state

The app has a solid foundation: an HSL token system in `src/styles/globals.css` (indigo primary `243 75% 59%`, light + dark themes, semantic `success`/`warning`/`destructive` tokens), Inter as the type face, a radius scale driven by `--radius: 1rem`, elevation tokens (`shadow-card/raised/modal`), and shadcn/ui primitives in `components/ui/`. The problems are mostly **drift away from that system**, not the system itself.

## Suggested updates (priority order)

### 1. Charts bypass the chart color tokens — HIGH

`tailwind.config.ts` defines `chart.income` (`#818CF8`), `chart.expense` (`#F59E0B`) and savings series colors, but the dashboard cash-flow chart (`routes/secure/dashboard.tsx`) hardcodes different values: `#3b82f6` (blue) for income bars, `#fbbf24` for expense, `#8b5cf6` for the net line, plus `bg-blue-500`/`bg-amber-400`/`bg-violet-500` legend dots. Income is indigo in one place and blue in another.

**Fix:** use the `chart-*` Tailwind tokens for bars, line, legend dots, and tooltip dots; add a `chart.net` token. Consider moving chart colors into CSS variables (`--chart-1..n`, the shadcn convention) so they can differ in dark mode.

### 2. Money semantics use raw Tailwind greens/reds — HIGH

Income/expense amounts are colored with ad-hoc `text-emerald-600 dark:text-emerald-400` / `text-rose-600 dark:text-rose-400` in the dashboard activity rows and tooltip, even though `--success` and `--destructive` tokens exist. Every new surface has to remember both light and dark class pairs.

**Fix:** either use `text-success`/`text-destructive`, or add dedicated `--positive`/`--negative` money tokens if you want them distinct from status colors. One decision, applied everywhere (dashboard, transactions list, wallet).

### 3. Dead template navigation — HIGH (trust/polish)

`components/layout/Sidebar.tsx` still ships template leftovers: **Cryptocurrency**, **Report**, **Feedback**, **Help & Center** are permanently disabled "coming soon" rows, and **Messages** shows a hardcoded fake unread badge (`badge: 2`). A fake notification count in a finance app erodes trust.

**Fix:** remove items that aren't on the roadmap; drop the fake badge; fix labels ("Setting" → "Settings", "Help & Center" → "Help Center").

### 4. Non-functional header controls — MEDIUM

In `components/layout/AppHeader.tsx`, the "Search for everything..." input and the bell button do nothing. The bell also lacks an `aria-label`.

**Fix:** wire search to the transactions search (it's the only searchable data today) or remove it until it works; same for the bell.

### 5. Hand-rolled dropdown instead of a primitive — MEDIUM

The user menu in `AppHeader.tsx` is a custom `div` with a mousedown-outside listener: no Escape-to-close, no focus management, no keyboard navigation. A `dropdown-menu` shadcn primitive (or the existing `popover`) gives all of that for free; the dark-mode row's hand-built toggle could be a `switch` primitive.

### 6. Responsiveness — MEDIUM

The sidebar is a fixed `w-[280px]` with no mobile behavior — below ~1024px the app is effectively desktop-only. **Fix:** collapse the sidebar to a drawer/hamburger under `lg`, and audit the dashboard middle row (`flex-[4]`/`flex-[1]`) at tablet widths.

### 7. Hardcoded stat-card trends — LOW

`StatCard` on the dashboard always shows trend "down" for Monthly Spent and "up" for Monthly Income regardless of data. Compute vs. the prior month (the summary query already covers 13 months) or remove the arrows.

### 8. Radius drift — LOW

Nav rows use `rounded-[10px]` while the scale defines `xs`–`xl` off `--radius`. Replace arbitrary values with scale steps.

### 9. Empty states — LOW

"No transactions this month." is plain text. For a finance app the empty state is the onboarding moment: show a small illustration/icon + primary CTA ("Connect a bank" via Plaid when no accounts exist, "Add a transaction" otherwise). Define one `EmptyState` component and reuse it on dashboard/transactions/wallet.

## Syncing to Claude Design

`/design consent` was granted, but pushing tokens/components to a claude.ai/design project also needs `/design-login` in the session. After that, the token system (colors, radius, shadows, type) and `components/ui/` previews can be synced with `/design-sync` for visual review.
