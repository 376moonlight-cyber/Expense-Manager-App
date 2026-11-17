# PaisaPal Design System

Visual language for the personal finance app: clean, calm, trustworthy, lightly playful. Prefer `components/ui` and shared chrome over one-off styles.

## Brand

- **Name:** PaisaPal
- **Primary:** deep emerald/teal `#0F766E`
- **Accent:** warm amber `#F59E0B` (sparingly)
- **Income:** `#16A34A` · **Expense:** `#EF4444`
- **Background:** soft gray-white `#F6F8FA` · **Cards:** white

## Color tokens

Defined in `app/globals.css` (light + `.dark`). Tailwind maps them as `bg-primary`, `text-income`, `border-border`, etc.

| Token | Use |
| --- | --- |
| `primary` / `primary-muted` / `primary-foreground` | Brand actions, nav active, focus |
| `accent` / `accent-muted` | Amber callouts |
| `income` / `income-muted` | Money in / positive |
| `expense` / `expense-muted` | Money out / destructive |
| `background` / `surface` / `foreground` | Page canvas |
| `card` / `card-foreground` | Panels |
| `muted` / `muted-foreground` | Quiet surfaces & helper text |
| `border` / `ring` | Borders & focus rings |
| `shadow-card` / `shadow-soft` | Soft elevation |

**Dark mode:** slate background (`#0F172A`), softer cards (`#1E293B`). Preference is stored in `localStorage` under `theme` (`light` | `dark` | `system`) and follows the OS by default. Toggle lives in the shell header / sidebar.

## Typography

- **Headings:** Plus Jakarta Sans (`font-heading` / `--font-heading`)
- **Body:** Inter (`font-sans` / `--font-body`)
- **Money:** always `tabular-nums`

## Shape & depth

- Cards: `rounded-2xl`, `border-border`, `shadow-card`, generous spacing
- Inputs / buttons: `rounded-xl`–`rounded-2xl`, clear focus rings

## Icons & categories

Use **lucide-react** for actions and navigation. Category chips via `CategoryIcon` + `getCategoryStyle()`:

| Category | Icon | Tint |
| --- | --- | --- |
| Food | `UtensilsCrossed` | orange |
| Transport | `Car` | sky |
| Bills | `Receipt` | violet |
| Shopping | `ShoppingBag` | pink |
| Health | `HeartPulse` | emerald |
| Other | `MoreHorizontal` | slate |
| *(default / new)* | `Tag` | teal |

## UI components (`components/ui`)

| Component | Notes |
| --- | --- |
| `Button` | `primary` · `secondary` · `ghost` · `danger`; sizes `sm` / `md` / `lg` / `icon` |
| `Card` | + `CardHeader` / `CardTitle` / `CardDescription` / `CardBody` |
| `Input` | Shared focus ring; `error` border |
| `Select` | Native select, same focus treatment |
| `Badge` | `neutral` · `primary` · `accent` · `income` · `expense` |
| `ProgressBar` | 0–100; tones primary / income / expense / accent |
| `Modal` | Esc + backdrop close |
| `EmptyState` | Dashed empty placeholder + optional action |
| `Skeleton` | Pulse blocks + list/summary/page helpers |
| `Toast` | Sonner (`Toaster` + `showToast` / `toast`) |
| `CategoryIcon` | Round colored category glyph |
| `ConfirmDialog` | Imperative confirm via `useConfirm` |
| `CountUpMoney` | Animated money display |

## Shared chrome

- **`AppShell`** — desktop sidebar + mobile bottom tabs, theme toggle, page title/actions
- **`AppHeader`** — lighter brand + horizontal nav (optional alternative)
- **`MonthSwitcher`** — previous / next month control
- **`ThemeProvider` / `ThemeToggle` / `ThemeScript`** — class-based dark mode without FOUC

## Scope

Design system + navigation chrome first. Page bodies can adopt the same tokens and components next.
