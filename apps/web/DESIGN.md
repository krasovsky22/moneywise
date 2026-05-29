# Moneywise — UI Design System

Reference screenshots: FinTrack dashboard (light mode, responsive).

---

## Color Palette

### Brand

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--primary` | `243 75% 59%` | `#5B5FEF` | Active nav, primary buttons, badges |
| `--primary-hover` | `243 75% 52%` | `#4348D6` | Button hover state |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text on primary backgrounds |
| `--primary-subtle` | `243 100% 96%` | `#EEEFFE` | Pill/badge backgrounds, nav icon tint |

### Page & Surface

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--background` | `230 40% 96%` | `#ECEEF8` | Outer page background (lavender tint) |
| `--surface` | `0 0% 100%` | `#FFFFFF` | Sidebar, cards, modals |
| `--surface-raised` | `220 20% 98%` | `#F8F9FB` | Hover rows, input fills |

### Text

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--foreground` | `228 39% 14%` | `#171B35` | Primary text, headings |
| `--muted-foreground` | `220 9% 46%` | `#6B7280` | Labels, secondary text, timestamps |
| `--placeholder` | `220 9% 70%` | `#9CA3AF` | Input placeholders |

### Border & Divider

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--border` | `220 20% 91%` | `#E4E7EF` | Card borders, dividers |
| `--input` | `220 20% 91%` | `#E4E7EF` | Input borders |

### Semantic — Financial

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--success` | `142 72% 40%` | `#18A34A` | Positive delta (income up, expense down) |
| `--success-bg` | `142 76% 93%` | `#D1FAE5` | Success badge background |
| `--danger` | `0 72% 51%` | `#DC2626` | Negative delta (expense up, income down) |
| `--danger-bg` | `0 93% 94%` | `#FEE2E2` | Danger badge background |
| `--warning` | `38 92% 50%` | `#F59E0B` | Expense chart line, savings goals |

### Chart Colors

| Role | Hex | Usage |
|---|---|---|
| Expense line | `#F59E0B` | Cash flow chart — expense series |
| Income line | `#818CF8` | Cash flow chart — income series |
| Savings bar 1 | `#6366F1` | Education, primary goal |
| Savings bar 2 | `#F59E0B` | Marriage, secondary goal |
| Savings bar 3 | `#EF4444` | Motorcycle, tertiary goal |
| Savings bar 4 | `#22C55E` | Car, quaternary goal |

---

## Typography

Font stack: `'Inter', system-ui, -apple-system, sans-serif`

| Scale | Size | Weight | Line-height | Usage |
|---|---|---|---|---|
| `display` | 28px / 1.75rem | 700 | 1.2 | Page title (Welcome Back…) |
| `heading-lg` | 22px / 1.375rem | 700 | 1.3 | Section headings (Recent Activity, Savings) |
| `heading-md` | 16px / 1rem | 600 | 1.4 | Card titles (My Balance) |
| `body` | 14px / 0.875rem | 400 | 1.5 | General body text, nav items |
| `body-sm` | 12px / 0.75rem | 400 | 1.5 | Timestamps, captions |
| `amount-xl` | 28px / 1.75rem | 700 | 1.1 | Large stat numbers ($30,234.12) |
| `amount-lg` | 20px / 1.25rem | 600 | 1.1 | Medium numbers (savings totals) |
| `label` | 11px / 0.6875rem | 600 | 1.4 | ALL-CAPS labels, percentage badges |
| `nav` | 14px / 0.875rem | 500 | 1.4 | Sidebar navigation items |

Number formatting: commas for thousands, 2 decimal places. Currency symbol prefix ($).

---

## Spacing & Radius

```
--radius-sm:   6px   /* pills, tags */
--radius-md:   10px  /* inputs, small cards */
--radius-lg:   16px  /* primary cards */
--radius-xl:   20px  /* sidebar, modals */
--radius-full: 9999px /* avatar, icon circles */
```

Spacing scale (multiples of 4px): 4, 8, 12, 16, 20, 24, 32, 40, 48.

---

## Layout

### Shell

```
┌─────────────────────────────────────────────┐
│ Sidebar (280px fixed)  │  Main (flex-1)      │
│                        │  ┌──────────────┐   │
│  Logo                  │  │ Top Header   │   │
│  ─────────────         │  └──────────────┘   │
│  Menu                  │  │ Page Content │   │
│    Overview            │  │  (scrollable)│   │
│    My Wallet           │  └──────────────┘   │
│    Activity            │                     │
│      Expenses          │                     │
│      Income            │                     │
│    Cryptocurrency      │                     │
│    Messages  [2]       │                     │
│    Report              │                     │
│  ─────────────         │                     │
│  Help & Setting        │                     │
│    Setting             │                     │
│    Feedback            │                     │
│    Help & Center       │                     │
│  ─────────────         │                     │
│  Dark Mode  [toggle]   │                     │
│  Logout                │                     │
└─────────────────────────────────────────────┘
```

- **Page background**: `--background` (lavender)
- **Sidebar**: `--surface` white, `border-right: 1px solid --border`
- **Main**: `--background` fill, padding 24px

### Top Header

```
[ Search input (flex-1) ]  [ Bell icon ]  [ Avatar + Name + Chevron ]
```

- Height: 64px
- Background: transparent (page background shows through) or white card
- Search bar: rounded-full, `--surface-raised` fill

### Dashboard Grid (main content area)

```
Row 1:  Welcome heading                [Export Report button]
Row 2:  [Stat Card]  [Stat Card]  [Stat Card]   ← 3 equal columns
Row 3:  [Cash Flow Chart (2/3)]        [Recent Activity (1/3)]
Row 4:  [Savings Section (2/3)]        [Recent Activity cont. (1/3)]
```

Breakpoints (mobile handling TBD per phase):
- `lg` (1024px+): full 3-column layout
- `md` (768px–1023px): sidebar collapses to icon-only, 2-column content
- `sm` (<768px): sidebar hidden (hamburger), single-column stack

---

## Component Inventory

### Sidebar Navigation

- **Logo block**: colored square icon + "Moneywise" wordmark, 16px font, semi-bold
- **Section label**: 11px uppercase, `--muted-foreground`, letter-spacing 0.08em
- **Nav item**: icon (20px) + label, full-width, `--radius-md` rounding, 10px v-padding
  - Default: transparent bg, `--foreground` text
  - Active: `--primary` bg, `--primary-foreground` text, icon tinted white
  - Hover: `--primary-subtle` bg, `--primary` text
- **Unread badge**: `--primary` circle, 18px, white text, 11px font
- **Collapsible group**: chevron rotates on open; sub-items indented 16px

### Stat Card

```
┌───────────────────────────────┐
│ Label  (i)           [∨ May] │
│                               │
│  $30,234.12                   │
│                               │
│  ↑ 27.3%  Compared with last │
│           month               │
└───────────────────────────────┘
```

- Background: `--surface` white
- Border: 1px `--border`, `--radius-lg`
- Shadow: `0 1px 4px rgba(0,0,0,0.06)`
- Period selector: pill button, `--border` outline, `--radius-full`
- Delta badge: icon + percentage, `--success-bg` / `--danger-bg` fill, `--radius-full`

### Cash Flow Chart Card

- Recharts `LineChart` with two series (Expense, Income)
- Legend: colored dot + label, top-left of card
- Period selector: pill button top-right
- Point labels: colored pill on notable peaks (`--radius-full`)
- Y-axis: plain numbers (10K, 20K, 30K), no gridlines fill
- X-axis: month abbreviations

### Recent Activity List

```
[Logo circle]  Merchant Name              -$9.99
               May 12, 2025 at 10:23 PM
```

- Date group heading: `--muted-foreground`, `body-sm`, top border separator
- Logo: 36px circle, brand color fill, white icon or brand image
- Merchant: `body` weight 500
- Time: `body-sm` `--muted-foreground`
- Amount: `body` weight 600, `--success` for income, `--foreground` for expense

### Savings Goal Card

```
Goal Name            Target: $55,900.00
$40,326.12
[████████████████░░░░] 72%
```

- Progress bar: `--radius-full` track, colored fill per goal
- Percentage label: overlaid on fill, white, `label` scale
- Layout: 2-column grid inside Savings section

### Period Selector Pill

- `--radius-full`, 1px `--border` border, transparent bg
- `∨` chevron, `body-sm`, `--muted-foreground`
- Hover: `--surface-raised`

### Delta Badge

- `--radius-full`, 6px h-padding, 3px v-padding
- Icon: `↑` or `↗` (trending-up SVG) for positive; `↘` for negative
- Positive: `--success` text, `--success-bg` background
- Negative: `--danger` text, `--danger-bg` background
- Font: `label` scale (11px, 600)

### Dark Mode Toggle

- shadcn `Switch` component
- `--primary` thumb on active, `--muted` track off

### Export Report Button

- Filled `--primary` background, white text
- Left icon: download arrow
- `--radius-md`, padding 10px 16px

---

## Iconography

Use **Lucide React** (already standard with shadcn).

Key icons used:
| Area | Icon |
|---|---|
| Overview | `LayoutDashboard` |
| My Wallet | `Wallet` |
| Activity | `ArrowLeftRight` |
| Expenses | `TrendingDown` |
| Income | `TrendingUp` |
| Cryptocurrency | `Bitcoin` |
| Messages | `MessageSquare` |
| Report | `BarChart2` |
| Settings | `Settings` |
| Feedback | `UserCheck` |
| Help | `HelpCircle` |
| Dark Mode | `Moon` |
| Logout | `LogOut` |
| Notifications | `Bell` |
| Search | `Search` |
| Positive delta | `TrendingUp` |
| Negative delta | `TrendingDown` |
| Export | `Download` |
| Add new | `Plus` |

Icon sizes: 18px in nav items, 20px in header actions, 16px in badges/pills.

---

## Shadow Scale

```css
--shadow-card:   0 1px 4px rgba(0, 0, 0, 0.06);
--shadow-raised: 0 4px 16px rgba(0, 0, 0, 0.08);
--shadow-modal:  0 8px 32px rgba(0, 0, 0, 0.12);
```

---

## Dark Mode

Dark mode is user-toggled (sidebar switch). Token overrides follow shadcn's `.dark` class convention.

| Light | Dark equivalent |
|---|---|
| `--background` `#ECEEF8` | `#0F1020` (deep navy) |
| `--surface` `#FFFFFF` | `#1A1D30` (dark card) |
| `--foreground` `#171B35` | `#F0F1FF` |
| `--muted-foreground` `#6B7280` | `#8B92A9` |
| `--border` `#E4E7EF` | `#2A2D45` |
| `--primary` unchanged | `#6366F1` |

---

## globals.css Token Updates

The following CSS variables replace the current shadcn defaults in `src/styles/globals.css`:

```css
:root {
  /* Brand */
  --primary: 243 75% 59%;           /* #5B5FEF */
  --primary-foreground: 0 0% 100%;
  --primary-subtle: 243 100% 96%;   /* #EEEFFE */

  /* Surfaces */
  --background: 230 40% 96%;        /* #ECEEF8 lavender page bg */
  --foreground: 228 39% 14%;        /* #171B35 */
  --card: 0 0% 100%;                /* white cards */
  --card-foreground: 228 39% 14%;
  --popover: 0 0% 100%;
  --popover-foreground: 228 39% 14%;

  /* Secondary / muted */
  --secondary: 220 20% 96%;
  --secondary-foreground: 228 39% 14%;
  --muted: 220 20% 96%;
  --muted-foreground: 220 9% 46%;   /* #6B7280 */
  --accent: 243 100% 96%;           /* --primary-subtle */
  --accent-foreground: 243 75% 59%;

  /* Semantic */
  --destructive: 0 72% 51%;         /* #DC2626 */
  --destructive-foreground: 0 0% 100%;
  --success: 142 72% 40%;           /* #18A34A */
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;            /* #F59E0B */

  /* Border / inputs */
  --border: 220 20% 91%;            /* #E4E7EF */
  --input: 220 20% 91%;
  --ring: 243 75% 59%;

  /* Radius */
  --radius: 1rem;                   /* base = 16px (--radius-lg) */
}

.dark {
  --background: 232 40% 9%;         /* #0F1020 */
  --foreground: 240 40% 95%;        /* #F0F1FF */
  --card: 232 32% 15%;              /* #1A1D30 */
  --card-foreground: 240 40% 95%;
  --popover: 232 32% 15%;
  --popover-foreground: 240 40% 95%;
  --primary: 243 75% 64%;
  --primary-foreground: 0 0% 100%;
  --secondary: 232 28% 20%;
  --secondary-foreground: 240 40% 95%;
  --muted: 232 28% 20%;
  --muted-foreground: 226 15% 58%;  /* #8B92A9 */
  --accent: 232 28% 20%;
  --accent-foreground: 243 75% 75%;
  --destructive: 0 72% 45%;
  --destructive-foreground: 0 0% 100%;
  --border: 232 24% 26%;            /* #2A2D45 */
  --input: 232 24% 26%;
  --ring: 243 75% 64%;
}
```

---

## File Locations

| Artifact | Path |
|---|---|
| Global CSS tokens | `apps/web/src/styles/globals.css` |
| Tailwind config | `apps/web/tailwind.config.ts` |
| shadcn components | `apps/web/src/components/ui/` |
| Layout shell | `apps/web/src/components/layout/` |
| Route pages | `apps/web/src/routes/secure/` |
| Feature components | `apps/web/src/features/<name>/` |
